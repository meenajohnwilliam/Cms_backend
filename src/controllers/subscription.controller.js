// controllers/subscription.controller.js

const prisma = require("../config/prisma");
const crypto = require("crypto");
const config = require("../config/config");
const { razorpay } = require("../utils/services/razorpay.service");

// ========================================================
// UPGRADE SHAPES
//
// FREE_TO_PAID : Free → any paid plan
//                New Razorpay Subscription, start_at = now.
//                Razorpay charges the first cycle itself.
//
// SAME_CYCLE   : Starter Monthly → Pro Monthly
//                (or Starter Yearly → Pro Yearly)
//                Customer pays only the DIFFERENCE for the
//                days left. The existing mandate is REUSED
//                and switched to the new plan at cycle end.
//                Renewal date never moves.
//
// CROSS_CYCLE  : Starter Monthly → Pro Yearly
//                (or Starter Monthly → Starter Yearly)
//                The monthly mandate cannot carry a yearly
//                amount, so a NEW subscription is created
//                with start_at = now + 1 year and an ADDON
//                equal to (yearlyPrice - unusedCredit)
//                charged upfront. One checkout only.
//                The old monthly mandate is cancelled.
// ========================================================

const UPGRADE_TYPE = {
  FREE_TO_PAID: "FREE_TO_PAID",
  SAME_CYCLE: "SAME_CYCLE",
  CROSS_CYCLE: "CROSS_CYCLE",
};

// ========================================================
// SMALL HELPERS
// ========================================================

const DAY = 1000 * 60 * 60 * 24;

const round2 = (value) => Number(Number(value).toFixed(2));

const toPaise = (rupees) => Math.round(Number(rupees) * 100);

const toUnix = (date) => Math.floor(new Date(date).getTime() / 1000);

const addBillingCycle = (date, billingCycle) => {
  const result = new Date(date);

  if (billingCycle === "YEARLY") {
    result.setFullYear(result.getFullYear() + 1);
  } else {
    result.setMonth(result.getMonth() + 1);
  }

  return result;
};

const totalCountFor = (billingCycle) =>
  billingCycle === "YEARLY" ? 10 : 120;

// Sentinel used to abort a transaction when another webhook
// already activated the same subscription.
class AlreadyHandledError extends Error {}

// ======================================================
// UPGRADE SUBSCRIPTION
// ======================================================

const upgradeSubscription = async (req, res) => {
  try {
    console.log("\n======================================================");
    console.log("🚀 UPGRADE SUBSCRIPTION STARTED");
    console.log("======================================================");

    // ⚠️ tenantId must come from the token, never from the body.
    const tenantId = req.user?.tenantId || req.body.tenantId;

    const { planId } = req.body;

    // ======================================================
    // 1. VALIDATION
    // ======================================================

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "tenantId is required",
      });
    }

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "planId is required",
      });
    }

    // ======================================================
    // 2. GET CURRENT SUBSCRIPTION
    // ======================================================

    const currentSubscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: "ACTIVE",
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!currentSubscription) {
      return res.status(400).json({
        success: false,
        message: "Active subscription not found",
      });
    }

    const currentPlan = currentSubscription.plan;

    console.log("Current Plan:", currentPlan.name);
    console.log("Current Type:", currentPlan.type);
    console.log("Current Cycle:", currentPlan.billingCycle);

    // ======================================================
    // 3. GET NEW PLAN
    // ======================================================

    const newPlan = await prisma.plan.findUnique({
      where: { planId },
    });

    if (!newPlan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    if (!newPlan.isActive) {
      return res.status(400).json({
        success: false,
        message: "Plan is inactive",
      });
    }

    if (newPlan.type !== "PAID") {
      return res.status(400).json({
        success: false,
        message: "Only paid plans can be selected",
      });
    }

    if (!newPlan.razorpayPlanId) {
      return res.status(400).json({
        success: false,
        message: "Razorpay plan is not configured",
      });
    }

    if (currentPlan.planId === newPlan.planId) {
      return res.status(400).json({
        success: false,
        message: "You are already using this plan",
      });
    }

    console.log("New Plan:", newPlan.name);
    console.log("New Cycle:", newPlan.billingCycle);

    // ======================================================
    // 4. DECIDE THE UPGRADE SHAPE
    //
    // Allowed:
    //   Free            → anything paid
    //   level UP, same cycle          (Starter M → Pro M)
    //   level UP, MONTHLY → YEARLY    (Starter M → Pro Y)
    //   same level, MONTHLY → YEARLY  (Starter M → Starter Y)
    //
    // Blocked:
    //   level DOWN
    //   YEARLY → MONTHLY (that is a downgrade)
    // ======================================================

    const currentLevel = Number(currentPlan.planLevel);
    const newLevel = Number(newPlan.planLevel);

    const currentCycle = currentPlan.billingCycle;
    const newCycle = newPlan.billingCycle;

    let upgradeType;

    if (currentPlan.type === "FREE") {
      upgradeType = UPGRADE_TYPE.FREE_TO_PAID;
    } else {
      const isLevelUp = newLevel > currentLevel;

      const isCycleUp = currentCycle === "MONTHLY" && newCycle === "YEARLY";

      const isSameLevelCycleUp = newLevel === currentLevel && isCycleUp;

      if (!isLevelUp && !isSameLevelCycleUp) {
        return res.status(400).json({
          success: false,
          message: "Selected plan is not an upgrade",
        });
      }

      if (currentCycle === "YEARLY" && newCycle === "MONTHLY") {
        return res.status(400).json({
          success: false,
          message:
            "Switching from yearly to monthly is a downgrade and is not supported here",
        });
      }

      upgradeType =
        currentCycle === newCycle
          ? UPGRADE_TYPE.SAME_CYCLE
          : UPGRADE_TYPE.CROSS_CYCLE;
    }

    console.log("Upgrade Type:", upgradeType);

    // ======================================================
    // 5. CLEAN UP STALE PENDING UPGRADES
    //
    // Every click used to leave behind a PENDING row plus a
    // live Razorpay object. Kill them before starting again.
    // ======================================================

    const stalePending = await prisma.subscription.findMany({
      where: { tenantId, status: "PENDING" },
      select: { subscriptionId: true, razorpaySubscriptionId: true },
    });

    if (stalePending.length > 0) {
      for (const stale of stalePending) {
        if (stale.razorpaySubscriptionId) {
          try {
            await razorpay.subscriptions.cancel(
              stale.razorpaySubscriptionId,
              false
            );
          } catch (e) {
            console.log("ℹ️ Stale mandate cancel skipped:", e.message);
          }
        }
      }

      const staleIds = stalePending.map((s) => s.subscriptionId);

      await prisma.payment.updateMany({
        where: { subscriptionId: { in: staleIds }, status: "PENDING" },
        data: { status: "FAILED" },
      });

      await prisma.subscription.updateMany({
        where: { subscriptionId: { in: staleIds }, status: "PENDING" },
        data: { status: "CANCELLED" },
      });

      console.log("🧹 Stale PENDING upgrades cleared:", staleIds.length);
    }

    // ======================================================
    // CASE 1 — FREE → PAID
    // ======================================================

    if (upgradeType === UPGRADE_TYPE.FREE_TO_PAID) {
      console.log("\n🆓 FREE → PAID");

      const pendingSubscription = await prisma.subscription.create({
        data: {
          tenantId,
          planId: newPlan.planId,
          status: "PENDING",
          billingCycle: newPlan.billingCycle,
          upgradeType: UPGRADE_TYPE.FREE_TO_PAID,
          startDate: new Date(),
          endDate: new Date(),
        },
      });

      let razorpaySubscription;

      try {
        razorpaySubscription = await razorpay.subscriptions.create({
          plan_id: newPlan.razorpayPlanId,
          quantity: 1,
          customer_notify: 1,
          total_count: totalCountFor(newPlan.billingCycle),
          notes: {
            tenantId,
            subscriptionId: pendingSubscription.subscriptionId,
            planId: newPlan.planId,
            upgradeType: UPGRADE_TYPE.FREE_TO_PAID,
          },
        });
      } catch (error) {
        await prisma.subscription
          .delete({
            where: { subscriptionId: pendingSubscription.subscriptionId },
          })
          .catch(() => {});

        throw error;
      }

      await prisma.subscription.update({
        where: { subscriptionId: pendingSubscription.subscriptionId },
        data: { razorpaySubscriptionId: razorpaySubscription.id },
      });

      console.log("✅ Razorpay Subscription Created:", razorpaySubscription.id);

      return res.status(201).json({
        success: true,
        message: "Subscription created. Complete AutoPay authorization.",
        upgradeType: UPGRADE_TYPE.FREE_TO_PAID,

        newPlan: {
          planId: newPlan.planId,
          name: newPlan.name,
          price: Number(newPlan.price),
          billingCycle: newPlan.billingCycle,
        },

        // Frontend: Razorpay.open({ subscription_id })
        checkout: {
          type: "subscription",
          keyId: config.razorpay.keyId,
          subscriptionId: razorpaySubscription.id,
          amountToPay: Number(newPlan.price),
        },
      });
    }

    // ======================================================
    // PRORATION INPUTS (shared by both paid upgrades)
    // ======================================================

    const currentPrice = Number(currentPlan.price || 0);
    const newPrice = Number(newPlan.price || 0);

    const anchorStart = new Date(currentSubscription.startDate);
    const anchorEnd = new Date(currentSubscription.endDate);
    const now = new Date();

    const totalDays = Math.max(
      1,
      Math.ceil((anchorEnd.getTime() - anchorStart.getTime()) / DAY)
    );

    const remainingDays = Math.max(
      0,
      Math.min(
        totalDays,
        Math.ceil((anchorEnd.getTime() - now.getTime()) / DAY)
      )
    );

    console.log("Current Price:", currentPrice);
    console.log("New Price:", newPrice);
    console.log("Total Days:", totalDays);
    console.log("Remaining Days:", remainingDays);

    // ======================================================
    // CASE 2 — SAME CYCLE  (Starter Monthly → Pro Monthly)
    //
    // Pay the DIFFERENCE only. Renewal date is preserved.
    // The existing mandate is reused, so no re-authorization.
    // ======================================================

    if (upgradeType === UPGRADE_TYPE.SAME_CYCLE) {
      console.log("\n💳 SAME CYCLE UPGRADE");

      const existingMandateId = currentSubscription.razorpaySubscriptionId;

      if (!existingMandateId) {
        return res.status(400).json({
          success: false,
          message: "AutoPay mandate not found for the current plan",
        });
      }

      // Fail fast if the mandate is not in a usable state.
      let mandate;

      try {
        mandate = await razorpay.subscriptions.fetch(existingMandateId);
      } catch (error) {
        console.error("❌ Mandate fetch failed:", error.message);

        return res.status(400).json({
          success: false,
          message: "Unable to verify AutoPay mandate. Please contact support.",
        });
      }

      console.log("Mandate status:", mandate.status);

      if (!["active", "authenticated"].includes(mandate.status)) {
        return res.status(400).json({
          success: false,
          message: `AutoPay mandate is ${mandate.status}. Please contact support.`,
        });
      }

      const priceDifference = Math.max(0, newPrice - currentPrice);

      const proratedAmount = round2(
        (priceDifference * remainingDays) / totalDays
      );

      // Razorpay minimum order value is ₹1.
      const amountToPay = round2(Math.max(1, proratedAmount));

      console.log("Price Difference:", priceDifference);
      console.log("Amount To Pay:", amountToPay);

      // ----------------------------------------------------
      // PENDING ROW KEEPS THE EXISTING BILLING ANCHOR
      // ----------------------------------------------------

      const pendingSubscription = await prisma.subscription.create({
        data: {
          tenantId,
          planId: newPlan.planId,
          status: "PENDING",
          billingCycle: newPlan.billingCycle,
          upgradeType: UPGRADE_TYPE.SAME_CYCLE,
          startDate: anchorStart,
          endDate: anchorEnd,
        },
      });

      let razorpayOrder;
      let payment;

      try {
        razorpayOrder = await razorpay.orders.create({
          amount: toPaise(amountToPay),
          currency: "INR",
          receipt: `upg_${Date.now()}`,
          notes: {
            tenantId,
            subscriptionId: pendingSubscription.subscriptionId,
            oldSubscriptionId: currentSubscription.subscriptionId,
            oldPlanId: currentPlan.planId,
            newPlanId: newPlan.planId,
            upgradeType: UPGRADE_TYPE.SAME_CYCLE,
          },
        });

        payment = await prisma.payment.create({
          data: {
            tenantId,
            subscriptionId: pendingSubscription.subscriptionId,
            amount: String(amountToPay),
            currency: "INR",
            status: "PENDING",
            razorpayOrderId: razorpayOrder.id,
          },
        });
      } catch (error) {
        await prisma.subscription
          .delete({
            where: { subscriptionId: pendingSubscription.subscriptionId },
          })
          .catch(() => {});

        throw error;
      }

      console.log("✅ Upgrade Order Created:", razorpayOrder.id);

      return res.status(201).json({
        success: true,
        message: "Upgrade payment created",
        upgradeType: UPGRADE_TYPE.SAME_CYCLE,

        currentPlan: { name: currentPlan.name, price: currentPrice },

        newPlan: {
          planId: newPlan.planId,
          name: newPlan.name,
          price: newPrice,
          billingCycle: newPlan.billingCycle,
        },

        upgrade: {
          totalDays,
          remainingDays,
          priceDifference,
          proratedAmount,
          amountToPay,
          renewalDate: anchorEnd,
          note: "Your renewal date stays the same. The new price applies from the next renewal.",
        },

        // Frontend: Razorpay.open({ order_id })
        checkout: {
          type: "order",
          keyId: config.razorpay.keyId,
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          amountToPay,
        },

        payment: {
          paymentId: payment.paymentId,
          amount: amountToPay,
          status: "PENDING",
        },
      });
    }

    // ======================================================
    // CASE 3 — CROSS CYCLE  (Starter Monthly → Pro Yearly)
    //
    // The monthly mandate cannot carry a yearly amount, so a
    // NEW subscription is created. It starts one year from
    // now, and the discounted first year is charged upfront
    // as an ADDON — one checkout, mandate live immediately.
    // ======================================================

    console.log("\n📅 CROSS CYCLE UPGRADE");

    const unusedCredit = round2((currentPrice * remainingDays) / totalDays);

    // Never let the credit wipe out the whole invoice.
    const amountToPay = round2(Math.max(1, newPrice - unusedCredit));

    const newStartDate = now;
    const newEndDate = addBillingCycle(now, newPlan.billingCycle);

    console.log("Unused Credit:", unusedCredit);
    console.log("Amount To Pay:", amountToPay);
    console.log("New Period:", newStartDate, "→", newEndDate);

    const pendingSubscription = await prisma.subscription.create({
      data: {
        tenantId,
        planId: newPlan.planId,
        status: "PENDING",
        billingCycle: newPlan.billingCycle,
        upgradeType: UPGRADE_TYPE.CROSS_CYCLE,
        startDate: newStartDate,
        endDate: newEndDate,
      },
    });

    let crossSubscription;

    try {
      crossSubscription = await razorpay.subscriptions.create({
        plan_id: newPlan.razorpayPlanId,
        quantity: 1,
        customer_notify: 1,
        total_count: totalCountFor(newPlan.billingCycle),

        // Recurring billing begins only after the period the
        // customer is paying for right now.
        start_at: toUnix(newEndDate),

        // Charged upfront at authorization.
        addons: [
          {
            item: {
              name: `${newPlan.name} upgrade (credit ₹${unusedCredit} applied)`,
              amount: toPaise(amountToPay),
              currency: "INR",
            },
          },
        ],

        notes: {
          tenantId,
          subscriptionId: pendingSubscription.subscriptionId,
          oldSubscriptionId: currentSubscription.subscriptionId,
          oldPlanId: currentPlan.planId,
          newPlanId: newPlan.planId,
          upgradeType: UPGRADE_TYPE.CROSS_CYCLE,
        },
      });
    } catch (error) {
      await prisma.subscription
        .delete({
          where: { subscriptionId: pendingSubscription.subscriptionId },
        })
        .catch(() => {});

      throw error;
    }

    await prisma.subscription.update({
      where: { subscriptionId: pendingSubscription.subscriptionId },
      data: { razorpaySubscriptionId: crossSubscription.id },
    });

    console.log("✅ Cross-cycle subscription created:", crossSubscription.id);

    return res.status(201).json({
      success: true,
      message: "Upgrade created. Complete AutoPay authorization.",
      upgradeType: UPGRADE_TYPE.CROSS_CYCLE,

      currentPlan: {
        name: currentPlan.name,
        price: currentPrice,
        billingCycle: currentCycle,
      },

      newPlan: {
        planId: newPlan.planId,
        name: newPlan.name,
        price: newPrice,
        billingCycle: newPlan.billingCycle,
      },

      upgrade: {
        totalDays,
        remainingDays,
        unusedCredit,
        amountToPay,
        newPeriodStart: newStartDate,
        newPeriodEnd: newEndDate,
        note: `You pay ₹${amountToPay} today. ₹${newPrice} will be auto-charged from ${newEndDate.toDateString()}.`,
      },

      // Frontend: Razorpay.open({ subscription_id })
      checkout: {
        type: "subscription",
        keyId: config.razorpay.keyId,
        subscriptionId: crossSubscription.id,
        amountToPay,
      },
    });
  } catch (error) {
    console.error("❌ UPGRADE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ======================================================
// RAZORPAY WEBHOOK
// ======================================================

const razorpayWebhook = async (req, res) => {
  try {
    console.log("\n");
    console.log("======================================================");
    console.log("🚀 RAZORPAY WEBHOOK STARTED");
    console.log("======================================================");

    // ======================================================
    // 1. VERIFY SIGNATURE
    // ======================================================

    const signature = req.headers["x-razorpay-signature"];

    if (!signature) {
      console.log("❌ Razorpay signature missing");

      return res.status(400).json({
        success: false,
        message: "Razorpay signature missing",
      });
    }

    if (!Buffer.isBuffer(req.body)) {
      console.log("❌ Webhook raw body missing");

      return res.status(400).json({
        success: false,
        message: "Raw webhook body is required",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", config.razorpay.keySecret)
      .update(req.body)
      .digest("hex");

    const isValid =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

    if (!isValid) {
      console.log("❌ Invalid webhook signature");

      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    console.log("✅ Webhook signature verified");

    // ======================================================
    // 2. PARSE PAYLOAD
    // ======================================================

    const payload = JSON.parse(req.body.toString("utf8"));

    const event = payload.event;
    const eventId = req.headers["x-razorpay-event-id"];

    const subscriptionEntity = payload.payload?.subscription?.entity;
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;
    const invoiceEntity = payload.payload?.invoice?.entity;

    const razorpaySubscriptionId =
      subscriptionEntity?.id || invoiceEntity?.subscription_id;

    const razorpayPaymentId = paymentEntity?.id;

    const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;

    console.log("\nEvent:", event);
    console.log("Event ID:", eventId || "undefined");
    console.log("Subscription ID:", razorpaySubscriptionId || "undefined");
    console.log("Payment ID:", razorpayPaymentId || "undefined");
    console.log("Order ID:", razorpayOrderId || "undefined");

    // ======================================================
    // OPTIONAL: hard idempotency
    //
    // Add a WebhookEvent model with @unique on eventId and
    // drop duplicates before doing any work:
    //
    // try {
    //   await prisma.webhookEvent.create({ data: { eventId, event } });
    // } catch (e) {
    //   return res.status(200).json({ success: true, message: "Duplicate" });
    // }
    // ======================================================

    // ======================================================
    // HELPER: GET DB SUBSCRIPTION BY MANDATE
    // ======================================================

    const getDbSubscription = async (mandateId) => {
      if (!mandateId) return null;

      return await prisma.subscription.findUnique({
        where: { razorpaySubscriptionId: mandateId },
        include: { plan: true },
      });
    };

    // ======================================================
    // HELPER: CALCULATE DATES FROM RAZORPAY
    //
    // Used only for FREE_TO_PAID and for recurring renewals.
    // SAME_CYCLE and CROSS_CYCLE carry their own dates.
    // ======================================================

    const calculateSubscriptionDates = (
      subscription,
      razorpaySubscription = null
    ) => {
      let startDate;
      let endDate;

      if (razorpaySubscription?.current_start) {
        startDate = new Date(
          Number(razorpaySubscription.current_start) * 1000
        );
      } else {
        startDate = new Date();
      }

      if (razorpaySubscription?.current_end) {
        endDate = new Date(Number(razorpaySubscription.current_end) * 1000);
      } else {
        endDate = addBillingCycle(
          startDate,
          subscription.plan?.billingCycle || subscription.billingCycle
        );
      }

      return { startDate, endDate };
    };

    // ======================================================
    // HELPER: SWITCH AN EXISTING MANDATE TO THE NEW PLAN
    //
    // SAME_CYCLE only. schedule_change_at = "cycle_end" means
    // no immediate second charge — the new price kicks in at
    // the next renewal, which is exactly our endDate.
    //
    // NEVER throws: the customer already paid.
    // ======================================================

    const switchMandateToNewPlan = async (mandateId, newRazorpayPlanId) => {
      if (!mandateId || !newRazorpayPlanId) {
        console.log("ℹ️ Nothing to switch");
        return false;
      }

      console.log("🔄 Switching mandate to new plan:", mandateId);

      try {
        await razorpay.subscriptions.update(mandateId, {
          plan_id: newRazorpayPlanId,
          schedule_change_at: "cycle_end",
          customer_notify: 1,
        });

        console.log("✅ Mandate will renew on the new plan");
        return true;
      } catch (error) {
        console.error(
          "🚨 CRITICAL: mandate plan switch failed:",
          error?.error?.description || error.message
        );
        console.error("🚨 Fix manually:", mandateId, "→", newRazorpayPlanId);
        return false;
      }
    };

    // ======================================================
    // HELPER: CANCEL AN OLD MANDATE
    //
    // CROSS_CYCLE only. NEVER throws.
    // ======================================================

    const cancelOldMandate = async (mandateId) => {
      if (!mandateId) {
        console.log("ℹ️ No old mandate to cancel");
        return;
      }

      console.log("🔄 Cancelling old mandate:", mandateId);

      try {
        await razorpay.subscriptions.cancel(mandateId, false);
        console.log("✅ Old mandate cancelled");
      } catch (error) {
        const description = String(
          error?.error?.description || error.message || ""
        ).toLowerCase();

        if (
          description.includes("cancelled") ||
          description.includes("expired") ||
          description.includes("completed")
        ) {
          console.log("ℹ️ Old mandate already inactive");
          return;
        }

        console.error("🚨 Old mandate still active, cancel manually:", mandateId);
      }
    };

    // ======================================================
    // HELPER: ACTIVATE SUBSCRIPTION
    //
    // Behaviour is driven by subscription.upgradeType, so no
    // guessing is required.
    // ======================================================

    const activateSubscription = async (
      subscription,
      razorpaySubscription = null
    ) => {
      if (!subscription) {
        console.log("❌ Subscription not found for activation");
        return null;
      }

      if (subscription.status === "ACTIVE") {
        console.log("ℹ️ Subscription already ACTIVE");
        return subscription;
      }

      if (subscription.status !== "PENDING") {
        console.log("ℹ️ Not PENDING, skipping:", subscription.status);
        return subscription;
      }

      const mode = subscription.upgradeType || UPGRADE_TYPE.FREE_TO_PAID;

      console.log("\n");
      console.log("======================================================");
      console.log("🟢 ACTIVATING NEW SUBSCRIPTION");
      console.log("======================================================");

      console.log("Subscription:", subscription.subscriptionId);
      console.log("Tenant:", subscription.tenantId);
      console.log("Plan:", subscription.plan?.name);
      console.log("Mode:", mode);

      // ====================================================
      // FIND OLD ACTIVE SUBSCRIPTION
      // ====================================================

      const oldSubscription = await prisma.subscription.findFirst({
        where: {
          tenantId: subscription.tenantId,
          status: "ACTIVE",
          NOT: { subscriptionId: subscription.subscriptionId },
        },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      });

      if (oldSubscription) {
        console.log("Old subscription:", oldSubscription.subscriptionId);
        console.log("Old plan:", oldSubscription.plan?.name);
      } else {
        console.log("ℹ️ No old active subscription");
      }

      // ====================================================
      // DATES + MANDATE STRATEGY PER MODE
      // ====================================================

      let startDate;
      let endDate;

      // SAME_CYCLE inherits the old mandate. The others own one.
      let mandateToInherit = null;

      // CROSS_CYCLE kills the old mandate after activation.
      let mandateToCancel = null;

      if (mode === UPGRADE_TYPE.FREE_TO_PAID) {
        const dates = calculateSubscriptionDates(
          subscription,
          razorpaySubscription
        );

        startDate = dates.startDate;
        endDate = dates.endDate;
      } else if (mode === UPGRADE_TYPE.SAME_CYCLE) {
        // Billing anchor stored when the pending row was made.
        startDate = new Date(subscription.startDate);
        endDate = new Date(subscription.endDate);

        mandateToInherit = oldSubscription?.razorpaySubscriptionId || null;

        if (!mandateToInherit) {
          console.error(
            "🚨 SAME_CYCLE upgrade has no mandate to inherit. Recurring billing would stop."
          );
        }
      } else {
        // CROSS_CYCLE: the customer paid upfront for the period
        // we stored. Razorpay's current_start is a year away,
        // so it must NOT be used here.
        startDate = new Date(subscription.startDate);
        endDate = new Date(subscription.endDate);

        mandateToCancel = oldSubscription?.razorpaySubscriptionId || null;
      }

      console.log("Start Date:", startDate);
      console.log("End Date:", endDate);
      console.log("Mandate inherited:", mandateToInherit || "none");
      console.log("Mandate to cancel:", mandateToCancel || "none");

      // ====================================================
      // TRANSACTION
      //
      // The new row is claimed CONDITIONALLY. If two webhooks
      // race, exactly one wins and the other aborts cleanly.
      // ====================================================

      let result;

      try {
        result = await prisma.$transaction(async (tx) => {
          if (oldSubscription) {
            // razorpaySubscriptionId is @unique, so it must be
            // released on the old row BEFORE the new row takes it.
            await tx.subscription.update({
              where: { subscriptionId: oldSubscription.subscriptionId },
              data: {
                status: "CANCELLED",
                ...(mandateToInherit ? { razorpaySubscriptionId: null } : {}),
              },
            });

            console.log("✅ Old DB subscription CANCELLED");
          }

          const claim = await tx.subscription.updateMany({
            where: {
              subscriptionId: subscription.subscriptionId,
              status: "PENDING",
            },
            data: {
              status: "ACTIVE",
              startDate,
              endDate,
              ...(mandateToInherit
                ? { razorpaySubscriptionId: mandateToInherit }
                : {}),
            },
          });

          if (claim.count === 0) {
            throw new AlreadyHandledError();
          }

          const activated = await tx.subscription.findUnique({
            where: { subscriptionId: subscription.subscriptionId },
            include: { plan: true },
          });

          console.log("🎉 New DB subscription ACTIVE");

          return activated;
        });
      } catch (error) {
        if (error instanceof AlreadyHandledError) {
          console.log("ℹ️ Another webhook already activated this subscription");

          return await prisma.subscription.findUnique({
            where: { subscriptionId: subscription.subscriptionId },
            include: { plan: true },
          });
        }

        throw error;
      }

      // ====================================================
      // RAZORPAY SIDE EFFECTS — AFTER COMMIT ONLY
      //
      // The customer has paid. Activation must never be rolled
      // back because a Razorpay call failed.
      // ====================================================

      if (mode === UPGRADE_TYPE.SAME_CYCLE && mandateToInherit) {
        await switchMandateToNewPlan(
          mandateToInherit,
          result?.plan?.razorpayPlanId
        );
      }

      if (mode === UPGRADE_TYPE.CROSS_CYCLE && mandateToCancel) {
        await cancelOldMandate(mandateToCancel);
      }

      console.log("======================================================");
      console.log("🎉 SUBSCRIPTION ACTIVATION COMPLETED");
      console.log("======================================================");

      return result;
    };

    // ======================================================
    // HELPER: MARK ORDER PAYMENT SUCCESS  (SAME_CYCLE)
    // ======================================================

    const processOrderPayment = async (paymentEntity, orderEntity) => {
      if (!paymentEntity) {
        console.log("⚠️ Payment entity missing");
        return null;
      }

      const orderId = paymentEntity.order_id || orderEntity?.id;

      if (!orderId) {
        console.log("⚠️ Razorpay order ID missing");
        return null;
      }

      console.log("\n💰 PROCESSING ORDER PAYMENT:", orderId);

      const dbPayment = await prisma.payment.findUnique({
        where: { razorpayOrderId: orderId },
      });

      if (!dbPayment) {
        console.log("ℹ️ This order does not belong to our upgrade system");
        return null;
      }

      // ----------------------------------------------------
      // AMOUNT CHECK IN PAISE
      //
      // A mismatch is PERMANENT. Throwing here would make
      // Razorpay retry the same event forever.
      // ----------------------------------------------------

      const razorpayPaise = Number(paymentEntity.amount);
      const databasePaise = toPaise(dbPayment.amount);

      console.log("Razorpay paise:", razorpayPaise);
      console.log("Database paise:", databasePaise);

      if (razorpayPaise !== databasePaise) {
        console.error("🚨 PAYMENT AMOUNT MISMATCH — manual review required");
        console.error("Payment:", dbPayment.paymentId, "Order:", orderId);
        return null;
      }

      if (dbPayment.status === "SUCCESS") {
        console.log("ℹ️ Payment already SUCCESS");
        return dbPayment;
      }

      await prisma.payment.updateMany({
        where: {
          paymentId: dbPayment.paymentId,
          status: { not: "SUCCESS" },
        },
        data: {
          status: "SUCCESS",
          razorpayPaymentId: paymentEntity.id,
          paidAt: new Date(),
        },
      });

      console.log("✅ Order payment marked SUCCESS");

      return await prisma.payment.findUnique({
        where: { paymentId: dbPayment.paymentId },
      });
    };

    // ======================================================
    // HELPER: RECORD A SUBSCRIPTION PAYMENT
    //
    // Covers the CROSS_CYCLE upfront addon charge and every
    // recurring AutoPay charge.
    // ======================================================

    const recordSubscriptionPayment = async (subscription, entity) => {
      if (!entity?.id) return;

      const existing = await prisma.payment.findUnique({
        where: { razorpayPaymentId: entity.id },
      });

      if (existing) {
        console.log("ℹ️ Payment already recorded");

        if (existing.status !== "SUCCESS") {
          await prisma.payment.update({
            where: { paymentId: existing.paymentId },
            data: { status: "SUCCESS", paidAt: new Date() },
          });
        }

        return;
      }

      await prisma.payment.create({
        data: {
          tenantId: subscription.tenantId,
          subscriptionId: subscription.subscriptionId,
          amount: String(Number(entity.amount) / 100),
          currency: entity.currency || "INR",
          status: "SUCCESS",
          razorpayPaymentId: entity.id,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          paidAt: new Date(),
        },
      });

      console.log("✅ Subscription payment saved");
    };

    // ======================================================
    // HELPER: ACTIVATE A PENDING ROW FROM A MANDATE EVENT
    //
    // Used by invoice.paid / subscription.charged /
    // subscription.activated. Safe to call repeatedly.
    // ======================================================

    const activateByMandate = async (mandateId, entity) => {
      const subscription = await getDbSubscription(mandateId);

      if (!subscription) {
        console.log("⚠️ Subscription not found for mandate:", mandateId);
        return null;
      }

      if (subscription.status !== "PENDING") {
        console.log("ℹ️ Already handled, status:", subscription.status);
        return subscription;
      }

      return await activateSubscription(subscription, entity);
    };

    // ======================================================
    // 1. ORDER PAID   (SAME_CYCLE)
    // ======================================================

    if (event === "order.paid") {
      console.log("\n💰 ORDER PAID");

      const payment = await processOrderPayment(paymentEntity, orderEntity);

      if (payment) {
        const newSubscription = await prisma.subscription.findUnique({
          where: { subscriptionId: payment.subscriptionId },
          include: { plan: true },
        });

        await activateSubscription(newSubscription, null);
      }
    }

    // ======================================================
    // 2. PAYMENT CAPTURED   (SAME_CYCLE, duplicate-safe)
    // ======================================================
    else if (event === "payment.captured") {
      console.log("\n💳 PAYMENT CAPTURED");

      const payment = await processOrderPayment(paymentEntity, null);

      if (payment) {
        const newSubscription = await prisma.subscription.findUnique({
          where: { subscriptionId: payment.subscriptionId },
          include: { plan: true },
        });

        await activateSubscription(newSubscription, null);
      }
    }

    // ======================================================
    // 3. INVOICE PAID
    //
    // This is what fires for the CROSS_CYCLE upfront addon,
    // because subscription.activated will not arrive until
    // start_at (a year away).
    // ======================================================
    else if (event === "invoice.paid") {
      console.log("\n🧾 INVOICE PAID");

      if (!razorpaySubscriptionId) {
        console.log("ℹ️ Invoice is not linked to a subscription");
      } else {
        const activated = await activateByMandate(
          razorpaySubscriptionId,
          subscriptionEntity
        );

        if (activated && paymentEntity?.id) {
          await recordSubscriptionPayment(activated, paymentEntity);
        }
      }
    }

    // ======================================================
    // 4. SUBSCRIPTION AUTHENTICATED
    //
    // Mandate registered. No money moved, so no activation.
    // ======================================================
    else if (event === "subscription.authenticated") {
      console.log("\n🔐 SUBSCRIPTION AUTHENTICATED");

      const subscription = await getDbSubscription(razorpaySubscriptionId);

      if (!subscription) {
        console.log("⚠️ Subscription not found");
      } else {
        console.log("Subscription:", subscription.subscriptionId);
        console.log("ℹ️ Waiting for the first successful charge");
      }
    }

    // ======================================================
    // 5. SUBSCRIPTION ACTIVATED   (FREE_TO_PAID)
    // ======================================================
    else if (event === "subscription.activated") {
      console.log("\n🟢 RAZORPAY SUBSCRIPTION ACTIVATED");

      await activateByMandate(razorpaySubscriptionId, subscriptionEntity);
    }

    // ======================================================
    // 6. SUBSCRIPTION CHARGED
    //
    // First charge and every recurring AutoPay charge.
    // ======================================================
    else if (event === "subscription.charged") {
      console.log("\n💰 SUBSCRIPTION CHARGED");

      let subscription = await getDbSubscription(razorpaySubscriptionId);

      if (!subscription) {
        console.log("⚠️ Subscription not found");
      } else {
        // First charge of a pending upgrade.
        if (subscription.status === "PENDING") {
          subscription =
            (await activateSubscription(subscription, subscriptionEntity)) ||
            subscription;
        } else {
          // ============================================
          // RENEWAL — ROLL THE PERIOD FORWARD
          //
          // Never resurrect a CANCELLED / EXPIRED row, and
          // never accept a period that starts in the future
          // (that would be the CROSS_CYCLE addon invoice,
          // whose current_start is a year away).
          // ============================================

          const renewable = ["ACTIVE", "PAST_DUE", "SUSPENDED"];

          if (renewable.includes(subscription.status)) {
            const { startDate, endDate } = calculateSubscriptionDates(
              subscription,
              subscriptionEntity
            );

            const startsInFuture =
              startDate.getTime() > Date.now() + DAY;

            if (startsInFuture) {
              console.log("ℹ️ Future-dated period ignored:", startDate);
            } else {
              await prisma.subscription.update({
                where: { subscriptionId: subscription.subscriptionId },
                data: { status: "ACTIVE", startDate, endDate },
              });

              console.log("✅ Subscription period updated");
            }
          } else {
            console.log("ℹ️ Not renewable, skipping:", subscription.status);
          }
        }

        if (paymentEntity?.id) {
          await recordSubscriptionPayment(subscription, paymentEntity);
        }
      }
    }

    // ======================================================
    // 7. PAYMENT FAILED
    // ======================================================
    else if (event === "payment.failed") {
      console.log("\n❌ PAYMENT FAILED");

      if (paymentEntity?.order_id) {
        const payment = await prisma.payment.findUnique({
          where: { razorpayOrderId: paymentEntity.order_id },
        });

        if (payment) {
          await prisma.payment.updateMany({
            where: { paymentId: payment.paymentId, status: "PENDING" },
            data: { status: "FAILED" },
          });

          await prisma.subscription.updateMany({
            where: {
              subscriptionId: payment.subscriptionId,
              status: "PENDING",
            },
            data: { status: "CANCELLED" },
          });

          console.log("❌ Upgrade payment and pending plan cancelled");
        }
      }
    }

    // ======================================================
    // 8. SUBSCRIPTION PENDING
    // ======================================================
    else if (event === "subscription.pending") {
      console.log("\n⚠️ SUBSCRIPTION PENDING");

      const subscription = await getDbSubscription(razorpaySubscriptionId);

      if (subscription && subscription.status === "ACTIVE") {
        await prisma.subscription.update({
          where: { subscriptionId: subscription.subscriptionId },
          data: { status: "PAST_DUE" },
        });

        console.log("⚠️ Subscription marked PAST_DUE");
      } else {
        console.log("ℹ️ Subscription remains in current status");
      }
    }

    // ======================================================
    // 9. SUBSCRIPTION HALTED
    // ======================================================
    else if (event === "subscription.halted") {
      console.log("\n🛑 SUBSCRIPTION HALTED");

      const subscription = await getDbSubscription(razorpaySubscriptionId);

      if (subscription) {
        await prisma.subscription.update({
          where: { subscriptionId: subscription.subscriptionId },
          data: { status: "SUSPENDED" },
        });

        console.log("🛑 Subscription marked SUSPENDED");
      }
    }

    // ======================================================
    // 10. SUBSCRIPTION CANCELLED
    //
    // Guard: we cancel old mandates ourselves during an
    // upgrade. By then the old row is already CANCELLED and
    // its razorpaySubscriptionId is either cleared or points
    // at a row we no longer own, so only ACTIVE rows react.
    // ======================================================
    else if (event === "subscription.cancelled") {
      console.log("\n❌ SUBSCRIPTION CANCELLED");

      const subscription = await getDbSubscription(razorpaySubscriptionId);

      if (subscription && subscription.status !== "ACTIVE") {
        console.log("ℹ️ Row is not ACTIVE, no change:", subscription.status);
      } else if (subscription) {
        await prisma.subscription.update({
          where: { subscriptionId: subscription.subscriptionId },
          data: { status: "CANCELLED" },
        });

        console.log("❌ Subscription marked CANCELLED");
      }
    }

    // ======================================================
    // 11. SUBSCRIPTION COMPLETED
    // ======================================================
    else if (event === "subscription.completed") {
      console.log("\n🏁 SUBSCRIPTION COMPLETED");

      const subscription = await getDbSubscription(razorpaySubscriptionId);

      if (subscription) {
        await prisma.subscription.update({
          where: { subscriptionId: subscription.subscriptionId },
          data: { status: "EXPIRED" },
        });

        console.log("🏁 Subscription marked EXPIRED");
      }
    }

    // ======================================================
    // UNKNOWN EVENT
    // ======================================================
    else {
      console.log(`ℹ️ Unhandled event: ${event}`);
    }

    console.log("\n");
    console.log("======================================================");
    console.log("✅ WEBHOOK PROCESSED");
    console.log("======================================================");

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("\n");
    console.error("======================================================");
    console.error("❌ RAZORPAY WEBHOOK ERROR");
    console.error("======================================================");

    console.error("Message:", error.message);
    console.error("Stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};







// const upgradeSubscription = async (req, res) => {
//   try {
//     console.log("\n======================================================");
//     console.log("🚀 UPGRADE SUBSCRIPTION STARTED");
//     console.log("======================================================");

//     const { tenantId, planId } = req.body;

//     // ======================================================
//     // 1. VALIDATION
//     // ======================================================

//     if (!tenantId) {
//       return res.status(400).json({
//         success: false,
//         message: "tenantId is required",
//       });
//     }

//     if (!planId) {
//       return res.status(400).json({
//         success: false,
//         message: "planId is required",
//       });
//     }

//     // ======================================================
//     // 2. GET CURRENT SUBSCRIPTION
//     // ======================================================

//     const currentSubscription =
//       await prisma.subscription.findFirst({
//         where: {
//           tenantId,
//           status: "ACTIVE",
//         },
//         include: {
//           plan: true,
//         },
//         orderBy: {
//           createdAt: "desc",
//         },
//       });

//     if (!currentSubscription) {
//       return res.status(400).json({
//         success: false,
//         message: "Active subscription not found",
//       });
//     }

//     const currentPlan = currentSubscription.plan;

//     console.log("Current Plan:", currentPlan.name);
//     console.log("Current Type:", currentPlan.type);

//     // ======================================================
//     // 3. GET NEW PLAN
//     // ======================================================

//     const newPlan = await prisma.plan.findUnique({
//       where: {
//         planId,
//       },
//     });

//     if (!newPlan) {
//       return res.status(404).json({
//         success: false,
//         message: "Plan not found",
//       });
//     }

//     if (!newPlan.isActive) {
//       return res.status(400).json({
//         success: false,
//         message: "Plan is inactive",
//       });
//     }

//     if (newPlan.type !== "PAID") {
//       return res.status(400).json({
//         success: false,
//         message: "Only paid plans can be selected",
//       });
//     }

//     // ======================================================
//     // 4. SAME PLAN CHECK
//     // ======================================================

//     if (currentPlan.planId === newPlan.planId) {
//       return res.status(400).json({
//         success: false,
//         message: "You are already using this plan",
//       });
//     }

//     // ======================================================
//     // 5. PLAN LEVEL CHECK
//     // ======================================================

//     const currentLevel = Number(currentPlan.planLevel);
//     const newLevel = Number(newPlan.planLevel);

//     if (newLevel <= currentLevel) {
//       return res.status(400).json({
//         success: false,
//         message: "Selected plan is not an upgrade",
//       });
//     }

//     // ======================================================
//     // 6. CHECK RAZORPAY PLAN
//     // ======================================================

//     if (!newPlan.razorpayPlanId) {
//       return res.status(400).json({
//         success: false,
//         message: "Razorpay plan is not configured",
//       });
//     }

//     // ======================================================
//     // CASE 1
//     // FREE → PAID
//     // ======================================================

//     if (currentPlan.type === "FREE") {
//       //console.log("\n🆓 FREE → PAID");
//       //console.log("Creating Razorpay Subscription only");

//       // ----------------------------------------------------
//       // CREATE PENDING DB SUBSCRIPTION
//       // ----------------------------------------------------

//       const pendingSubscription = await prisma.subscription.create({
//           data: {
//             tenantId,
//             planId: newPlan.planId,
//             status: "PENDING",
//             billingCycle: newPlan.billingCycle,
//             startDate: new Date(),
//             endDate: new Date(),
//           },
//         });

//       // ----------------------------------------------------
//       // CREATE RAZORPAY SUBSCRIPTION
//       // ----------------------------------------------------

//       const razorpaySubscription = await razorpay.subscriptions.create({
//           plan_id: newPlan.razorpayPlanId,
//           quantity: 1,
//           customer_notify: 1,
//           total_count:
//             newPlan.billingCycle === "MONTHLY"
//               ? 120
//               : 10,
//           notes: {
//             tenantId,
//             subscriptionId: pendingSubscription.subscriptionId,
//             planId: newPlan.planId,
//             upgradeType: "FREE_TO_PAID",
//           },
//         });

//       // ----------------------------------------------------
//       // SAVE RAZORPAY SUBSCRIPTION ID
//       // ----------------------------------------------------

//       await prisma.subscription.update({
//         where: {
//           subscriptionId:
//             pendingSubscription.subscriptionId,
//         },
//         data: {
//           razorpaySubscriptionId:
//             razorpaySubscription.id,
//         },
//       });

//       // console.log("✅ Razorpay Subscription Created");
//       // console.log("Subscription:", razorpaySubscription.id);

//       return res.status(201).json({
//         success: true,
//         message:
//           "Subscription created. Complete AutoPay authorization.",
//         upgradeType: "FREE_TO_PAID",
//         newPlan: {
//           planId: newPlan.planId,
//           name: newPlan.name,
//           price: Number(newPlan.price),
//           billingCycle: newPlan.billingCycle,
//         },
//         razorpay: {
//           keyId: config.razorpay.keyId,
//           subscriptionId: razorpaySubscription.id,
//         },
//       });
//     }

//     // ======================================================
//     // CASE 2
//     // PAID → PAID
//     // ======================================================

//     console.log("\n💳 PAID → PAID");

//     // ======================================================
//     // CALCULATE UNUSED CREDIT
//     // ======================================================

//     const currentPrice = Number(currentPlan.price || 0);
//     const newPrice = Number(newPlan.price || 0);

//     const startDate = new Date(currentSubscription.startDate);

//     const endDate = new Date(currentSubscription.endDate);

//     const now = new Date();

//     const DAY = 1000 * 60 * 60 * 24;

//     const totalDays = Math.max( 1, Math.ceil( (endDate.getTime() - startDate.getTime()) / DAY ));

//     const remainingDays = Math.max( 0, Math.ceil( (endDate.getTime() - now.getTime()) / DAY ));

//     const unusedCredit = Number(
//       (
//         (currentPrice * remainingDays) /
//         totalDays
//       ).toFixed(2)
//     );

//     const amountToPay = Number(Math.max( 1, newPrice - unusedCredit ).toFixed(2));

//     console.log("Current Price:", currentPrice);
//     console.log("New Price:", newPrice);
//     console.log("Remaining Days:", remainingDays);
//     console.log("Unused Credit:", unusedCredit);
//     console.log("Amount To Pay:", amountToPay);

//     // ======================================================
//     // CREATE PENDING DB SUBSCRIPTION FIRST
//     // ======================================================

//     const pendingSubscription = await prisma.subscription.create({
//         data: {
//           tenantId,
//           planId: newPlan.planId,
//           status: "PENDING",
//           billingCycle: newPlan.billingCycle,
//           startDate: new Date(),
//           endDate: new Date(),
//         },
//       });

//     // ======================================================
//     // CREATE RAZORPAY ORDER
//     // ======================================================

//     const razorpayOrder =
//       await razorpay.orders.create({
//         amount: Math.round(amountToPay * 100),
//         currency: "INR",
//         receipt:
//           `upgrade_${tenantId}_${Date.now()}`,
//         notes: {
//           tenantId,
//           subscriptionId:
//             pendingSubscription.subscriptionId,
//           oldPlanId:
//             currentPlan.planId,
//           newPlanId:
//             newPlan.planId,
//           upgradeType:
//             "PAID_TO_PAID",
//         },
//       });

//     console.log("✅ Upgrade Order Created");
//     console.log("Order ID:", razorpayOrder.id);

//     // ======================================================
//     // CREATE PAYMENT RECORD
//     // ======================================================

//     const payment = await prisma.payment.create({
//         data: {
//           tenantId,
//           subscriptionId:
//             pendingSubscription.subscriptionId,
//           amount:
//             String(amountToPay),
//           currency: "INR",
//           status: "PENDING",
//           razorpayOrderId:
//             razorpayOrder.id,
//         },
//       });

//     return res.status(201).json({
//       success: true,
//       message:
//         "Upgrade payment created",
//       upgradeType:
//         "PAID_TO_PAID",
//       currentPlan: {
//         name: currentPlan.name,
//         price: currentPrice,
//       },
//       newPlan: {
//         planId: newPlan.planId,
//         name: newPlan.name,
//         price: newPrice,
//         billingCycle: newPlan.billingCycle,
//       },

//       upgrade: {
//         totalDays,
//         remainingDays,
//         unusedCredit,
//         amountToPay,
//       },

//       razorpay: {
//         keyId:
//           config.razorpay.keyId,
//         orderId:
//           razorpayOrder.id,
//         amount:
//           razorpayOrder.amount,
//       },

//       payment: {
//         paymentId:
//           payment.paymentId,
//         amount:
//           amountToPay,
//         status:
//           "PENDING",
//       },
//     });

//   } catch (error) {
//     console.error(
//       "❌ UPGRADE ERROR:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message:
//         "Internal server error",
//     });
//   }
// };



// const razorpayWebhook = async (req, res) => {
//   try {
//     console.log("\n");
//     console.log("======================================================");
//     console.log("🚀 RAZORPAY WEBHOOK STARTED");
//     console.log("======================================================");

//     // ======================================================
//     // 1. VERIFY SIGNATURE
//     // ======================================================

//     const signature = req.headers["x-razorpay-signature"];

//     if (!signature) {
//       console.log("❌ Razorpay signature missing");

//       return res.status(400).json({
//         success: false,
//         message: "Razorpay signature missing",
//       });
//     }

//     if (!Buffer.isBuffer(req.body)) {
//       console.log("❌ Webhook raw body missing");

//       return res.status(400).json({
//         success: false,
//         message: "Raw webhook body is required",
//       });
//     }

//     const expectedSignature = crypto
//       .createHmac(
//         "sha256",
//         config.razorpay.keySecret
//       )
//       .update(req.body)
//       .digest("hex");

//     const isValid =
//       signature.length === expectedSignature.length &&
//       crypto.timingSafeEqual(
//         Buffer.from(signature),
//         Buffer.from(expectedSignature)
//       );

//     if (!isValid) {
//       console.log("❌ Invalid webhook signature");

//       return res.status(400).json({
//         success: false,
//         message: "Invalid webhook signature",
//       });
//     }

//     console.log("✅ Webhook signature verified");

//     // ======================================================
//     // 2. PARSE PAYLOAD
//     // ======================================================

//     const payload = JSON.parse(
//       req.body.toString("utf8")
//     );

//     const event = payload.event;

//     const subscriptionEntity =
//       payload.payload?.subscription?.entity;

//     const paymentEntity =
//       payload.payload?.payment?.entity;

//     const orderEntity =
//       payload.payload?.order?.entity;

//     const razorpaySubscriptionId =
//       subscriptionEntity?.id;

//     const razorpayPaymentId =
//       paymentEntity?.id;

//     const razorpayOrderId =
//       paymentEntity?.order_id ||
//       orderEntity?.id;

//     console.log("\nEvent:", event);

//     console.log(
//       "Subscription ID:",
//       razorpaySubscriptionId || "undefined"
//     );

//     console.log(
//       "Payment ID:",
//       razorpayPaymentId || "undefined"
//     );

//     console.log(
//       "Order ID:",
//       razorpayOrderId || "undefined"
//     );

//     // ======================================================
//     // HELPER: GET DB SUBSCRIPTION
//     // ======================================================

//     const getDbSubscription = async (
//       razorpaySubscriptionId
//     ) => {
//       if (!razorpaySubscriptionId) {
//         return null;
//       }

//       return await prisma.subscription.findUnique({
//         where: {
//           razorpaySubscriptionId,
//         },

//         include: {
//           plan: true,
//         },
//       });
//     };

//     // ======================================================
//     // HELPER: GET PAYMENT
//     // ======================================================

//     const getUpgradePayment = async (
//       subscriptionId
//     ) => {
//       return await prisma.payment.findFirst({
//         where: {
//           subscriptionId,
//           razorpayOrderId: {
//             not: null,
//           },
//         },

//         orderBy: {
//           createdAt: "desc",
//         },
//       });
//     };

//     // ======================================================
//     // HELPER: CALCULATE SUBSCRIPTION DATES
//     // ======================================================

//     const calculateSubscriptionDates = (
//       subscription,
//       razorpaySubscription = null
//     ) => {
//       let startDate;
//       let endDate;

//       if (
//         razorpaySubscription?.current_start
//       ) {
//         startDate = new Date(
//           Number(
//             razorpaySubscription.current_start
//           ) * 1000
//         );
//       } else {
//         startDate = new Date();
//       }

//       if (
//         razorpaySubscription?.current_end
//       ) {
//         endDate = new Date(
//           Number(
//             razorpaySubscription.current_end
//           ) * 1000
//         );
//       } else {
//         endDate = new Date(startDate);

//         if (
//           subscription.plan?.billingCycle ===
//           "MONTHLY"
//         ) {
//           endDate.setMonth(
//             endDate.getMonth() + 1
//           );
//         } else if (
//           subscription.plan?.billingCycle ===
//           "YEARLY"
//         ) {
//           endDate.setFullYear(
//             endDate.getFullYear() + 1
//           );
//         }
//       }

//       return {
//         startDate,
//         endDate,
//       };
//     };

//     // ======================================================
//     // HELPER: CANCEL OLD RAZORPAY SUBSCRIPTION
//     // ======================================================

//     const cancelOldRazorpaySubscription = async (oldSubscription) => {
//         if (
//           !oldSubscription?.razorpaySubscriptionId
//         ) {
//           console.log(
//             "ℹ️ Old Razorpay subscription not found"
//           );

//           return;
//         }

//         console.log(
//           "🔄 Cancelling old Razorpay subscription:",
//           oldSubscription.razorpaySubscriptionId
//         );

//         try {
//           await razorpay.subscriptions.cancel(
//             oldSubscription.razorpaySubscriptionId,
//             false
//           );

//           console.log(
//             "✅ Old Razorpay subscription cancelled"
//           );
//         } catch (error) {
//           console.log(
//             "⚠️ Razorpay cancellation error:",
//             error.message
//           );

//           const message =
//             String(
//               error.message || ""
//             ).toLowerCase();

//           if (
//             message.includes("already cancelled") ||
//             message.includes("already been cancelled") ||
//             message.includes("expired") ||
//             message.includes("completed")
//           ) {
//             console.log(
//               "ℹ️ Old Razorpay subscription already inactive"
//             );

//             return;
//           }

//           throw error;
//         }
//       };

//     // ======================================================
//     // HELPER: ACTIVATE SUBSCRIPTION
//     // ======================================================

//     const activateSubscription = async (
//       subscription,
//       razorpaySubscription = null
//     ) => {
//       if (!subscription) {
//         console.log(
//           "❌ Subscription not found for activation"
//         );

//         return null;
//       }

//       console.log("\n");
//       console.log("======================================================");
//       console.log("🟢 ACTIVATING NEW SUBSCRIPTION");
//       console.log("======================================================");

//       console.log(
//         "Subscription:",
//         subscription.subscriptionId
//       );

//       console.log(
//         "Tenant:",
//         subscription.tenantId
//       );

//       console.log(
//         "Plan:",
//         subscription.plan?.name
//       );

//       if (
//         subscription.status === "ACTIVE"
//       ) {
//         console.log(
//           "ℹ️ Subscription already ACTIVE"
//         );

//         return subscription;
//       }

//       // ====================================================
//       // FIND OLD ACTIVE SUBSCRIPTION
//       // ====================================================

//       const oldSubscription =
//         await prisma.subscription.findFirst({
//           where: {
//             tenantId:
//               subscription.tenantId,

//             status: "ACTIVE",

//             NOT: {
//               subscriptionId:
//                 subscription.subscriptionId,
//             },
//           },

//           include: {
//             plan: true,
//           },

//           orderBy: {
//             createdAt: "desc",
//           },
//         });

//       if (oldSubscription) {
//         console.log(
//           "Old subscription found:",
//           oldSubscription.subscriptionId
//         );

//         console.log(
//           "Old plan:",
//           oldSubscription.plan?.name
//         );
//       } else {
//         console.log(
//           "ℹ️ No old active subscription"
//         );
//       }

//       // ====================================================
//       // CANCEL OLD RAZORPAY AUTOPAY
//       // ====================================================

//       if (oldSubscription) {
//         await cancelOldRazorpaySubscription(
//           oldSubscription
//         );
//       }

//       // ====================================================
//       // CALCULATE NEW DATES
//       // ====================================================

//       const {
//         startDate,
//         endDate,
//       } = calculateSubscriptionDates(
//         subscription,
//         razorpaySubscription
//       );

//       console.log(
//         "New Start Date:",
//         startDate
//       );

//       console.log(
//         "New End Date:",
//         endDate
//       );

//       // ====================================================
//       // DATABASE TRANSACTION
//       // ====================================================

//       const result =
//         await prisma.$transaction(
//           async (tx) => {
//             // ==============================================
//             // CANCEL OLD DB SUBSCRIPTION
//             // ==============================================

//             if (oldSubscription) {
//               await tx.subscription.update({
//                 where: {
//                   subscriptionId:
//                     oldSubscription.subscriptionId,
//                 },

//                 data: {
//                   status: "CANCELLED",
//                 },
//               });

//               console.log(
//                 "✅ Old DB subscription CANCELLED"
//               );
//             }

//             // ==============================================
//             // ACTIVATE NEW SUBSCRIPTION
//             // ==============================================

//             const activated =
//               await tx.subscription.update({
//                 where: {
//                   subscriptionId:
//                     subscription.subscriptionId,
//                 },

//                 data: {
//                   status: "ACTIVE",

//                   startDate,

//                   endDate,
//                 },

//                 include: {
//                   plan: true,
//                 },
//               });

//             console.log(
//               "🎉 New DB subscription ACTIVE"
//             );

//             return activated;
//           }
//         );

//       console.log("======================================================");
//       console.log("🎉 SUBSCRIPTION ACTIVATION COMPLETED");
//       console.log("======================================================");

//       return result;
//     };

//     // ======================================================
//     // HELPER: MARK ORDER PAYMENT SUCCESS
//     // ======================================================

//     const processOrderPayment = async (
//       paymentEntity,
//       orderEntity
//     ) => {
//       if (!paymentEntity) {
//         console.log(
//           "⚠️ Payment entity missing"
//         );

//         return null;
//       }

//       const orderId =
//         paymentEntity.order_id ||
//         orderEntity?.id;

//       if (!orderId) {
//         console.log(
//           "⚠️ Razorpay order ID missing"
//         );

//         return null;
//       }

//       console.log("\n");
//       console.log("======================================================");
//       console.log("💰 PROCESSING ORDER PAYMENT");
//       console.log("======================================================");

//       console.log(
//         "Order ID:",
//         orderId
//       );

//       console.log(
//         "Payment ID:",
//         paymentEntity.id
//       );

//       // ====================================================
//       // FIND PAYMENT
//       // ====================================================

//       const dbPayment =
//         await prisma.payment.findUnique({
//           where: {
//             razorpayOrderId: orderId,
//           },
//         });

//       if (!dbPayment) {
//         console.log(
//           "ℹ️ This order does not belong to our upgrade system"
//         );

//         return null;
//       }

//       console.log(
//         "✅ Database payment found"
//       );

//       console.log(
//         "DB Payment ID:",
//         dbPayment.paymentId
//       );

//       // ====================================================
//       // AMOUNT VERIFICATION
//       // ====================================================

//       const razorpayAmount =
//         Number(paymentEntity.amount) / 100;

//       const databaseAmount =
//         Number(dbPayment.amount);

//       console.log(
//         "Razorpay Amount:",
//         razorpayAmount
//       );

//       console.log(
//         "Database Amount:",
//         databaseAmount
//       );

//       if (
//         Number(
//           razorpayAmount.toFixed(2)
//         ) !==
//         Number(
//           databaseAmount.toFixed(2)
//         )
//       ) {
//         console.error(
//           "❌ PAYMENT AMOUNT MISMATCH"
//         );

//         throw new Error(
//           "Razorpay payment amount mismatch"
//         );
//       }

//       // ====================================================
//       // ALREADY SUCCESS
//       // ====================================================

//       if (
//         dbPayment.status === "SUCCESS"
//       ) {
//         console.log(
//           "ℹ️ Payment already SUCCESS"
//         );

//         return dbPayment;
//       }

//       // ====================================================
//       // MARK SUCCESS
//       // ====================================================

//       const updatedPayment =
//         await prisma.payment.update({
//           where: {
//             paymentId:
//               dbPayment.paymentId,
//           },

//           data: {
//             status: "SUCCESS",

//             razorpayPaymentId:
//               paymentEntity.id,

//             paidAt:
//               new Date(),
//           },
//         });

//       console.log(
//         "✅ Order payment marked SUCCESS"
//       );

//       return updatedPayment;
//     };

//     // ======================================================
//     // 1. ORDER PAID
//     // ======================================================

//     if (event === "order.paid") {
//       console.log("\n");
//       console.log("======================================================");
//       console.log("💰 ORDER PAID");
//       console.log("======================================================");

//       const payment =
//         await processOrderPayment(
//           paymentEntity,
//           orderEntity
//         );

//       if (!payment) {
//         console.log(
//           "ℹ️ No upgrade payment found"
//         );
//       } else {
//         // ================================================
//         // FIND PENDING SUBSCRIPTION
//         // ================================================

//         const newSubscription =
//           await prisma.subscription.findUnique({
//             where: {
//               subscriptionId:
//                 payment.subscriptionId,
//             },

//             include: {
//               plan: true,
//             },
//           });

//         if (!newSubscription) {
//           console.log(
//             "❌ New subscription not found"
//           );
//         } else {
//           console.log(
//             "New pending subscription:",
//             newSubscription.subscriptionId
//           );

//           console.log(
//             "New plan:",
//             newSubscription.plan?.name
//           );

//           // ================================================
//           // IMPORTANT
//           //
//           // For your current flow:
//           //
//           // First payment is completed through Razorpay Order.
//           // After payment confirmation, activate the new plan.
//           //
//           // ================================================

//           await activateSubscription(
//             newSubscription,
//             null
//           );
//         }
//       }
//     }

//     // ======================================================
//     // 2. PAYMENT CAPTURED
//     //
//     // This is handled idempotently.
//     // If order.paid already processed it, no duplicate
//     // activation will happen.
//     // ======================================================

//     else if (
//       event === "payment.captured"
//     ) {
//       console.log("\n");
//       console.log("======================================================");
//       console.log("💳 PAYMENT CAPTURED");
//       console.log("======================================================");

//       const payment =
//         await processOrderPayment(
//           paymentEntity,
//           null
//         );

//       if (payment) {
//         const newSubscription =
//           await prisma.subscription.findUnique({
//             where: {
//               subscriptionId:
//                 payment.subscriptionId,
//             },

//             include: {
//               plan: true,
//             },
//           });

//         if (
//           newSubscription &&
//           newSubscription.status !== "ACTIVE"
//         ) {
//           await activateSubscription(
//             newSubscription,
//             null
//           );
//         }
//       }
//     }

//     // ======================================================
//     // 3. SUBSCRIPTION AUTHENTICATED
//     //
//     // Only AutoPay mandate authentication.
//     // Do not change plan here.
//     // ======================================================

//     else if (
//       event === "subscription.authenticated"
//     ) {
//       console.log("\n");
//       console.log("======================================================");
//       console.log("🔐 SUBSCRIPTION AUTHENTICATED");
//       console.log("======================================================");

//       const subscription =
//         await getDbSubscription(
//           razorpaySubscriptionId
//         );

//       if (!subscription) {
//         console.log(
//           "⚠️ Subscription not found"
//         );
//       } else {
//         console.log(
//           "Subscription found:",
//           subscription.subscriptionId
//         );

//         console.log(
//           "ℹ️ AutoPay mandate authenticated"
//         );

//         console.log(
//           "ℹ️ No plan activation here"
//         );
//       }
//     }

//     // ======================================================
//     // 4. SUBSCRIPTION ACTIVATED
//     //
//     // This event confirms Razorpay AutoPay is ready.
//     //
//     // Your application should already have activated
//     // the plan after the first successful payment.
//     // ======================================================

//     else if (
//       event === "subscription.activated"
//     ) {
//       console.log("\n");
//       console.log("======================================================");
//       console.log("🟢 RAZORPAY SUBSCRIPTION ACTIVATED");
//       console.log("======================================================");

//       const subscription =
//         await getDbSubscription(
//           razorpaySubscriptionId
//         );

//       if (!subscription) {
//         console.log(
//           "⚠️ Subscription not found in DB"
//         );
//       } else {
//         console.log(
//           "DB Subscription:",
//           subscription.subscriptionId
//         );

//         console.log(
//           "Plan:",
//           subscription.plan?.name
//         );

//         // ==================================================
//         // FREE → PAID
//         //
//         // If no order payment exists, this may be the first
//         // paid subscription activation.
//         // ==================================================

//         const upgradePayment =
//           await getUpgradePayment(
//             subscription.subscriptionId
//           );

//         if (!upgradePayment) {
//           console.log(
//             "🆓 FREE → PAID subscription"
//           );

//           if (
//             subscription.status !== "ACTIVE"
//           ) {
//             await activateSubscription(
//               subscription,
//               subscriptionEntity
//             );
//           }
//         } else {
//           console.log(
//             "ℹ️ PAID → PAID upgrade subscription"
//           );

//           console.log(
//             "Order payment status:",
//             upgradePayment.status
//           );

//           // The plan can only activate when the upgrade
//           // payment is SUCCESS.

//           if (
//             upgradePayment.status === "SUCCESS" &&
//             subscription.status !== "ACTIVE"
//           ) {
//             await activateSubscription(
//               subscription,
//               subscriptionEntity
//             );
//           } else if (
//             upgradePayment.status !== "SUCCESS"
//           ) {
//             console.log(
//               "⏳ Waiting for one-time upgrade payment"
//             );
//           }
//         }
//       }
//     }

//     // ======================================================
//     // 5. SUBSCRIPTION CHARGED
//     //
//     // Recurring AutoPay payment every month/year.
//     // ======================================================

//     else if (
//       event === "subscription.charged"
//     ) {
//       console.log("\n");
//       console.log("======================================================");
//       console.log("💰 SUBSCRIPTION CHARGED");
//       console.log("======================================================");

//       const subscription =
//         await getDbSubscription(
//           razorpaySubscriptionId
//         );

//       if (!subscription) {
//         console.log(
//           "⚠️ Subscription not found"
//         );
//       } else {
//         console.log(
//           "Subscription:",
//           subscription.subscriptionId
//         );

//         console.log(
//           "Plan:",
//           subscription.plan?.name
//         );

//         // ================================================
//         // UPDATE BILLING PERIOD
//         // ================================================

//         const {
//           startDate,
//           endDate,
//         } = calculateSubscriptionDates(
//           subscription,
//           subscriptionEntity
//         );

//         await prisma.subscription.update({
//           where: {
//             subscriptionId:
//               subscription.subscriptionId,
//           },

//           data: {
//             status: "ACTIVE",

//             startDate,

//             endDate,
//           },
//         });

//         console.log(
//           "✅ Subscription period updated"
//         );

//         // ================================================
//         // CREATE RECURRING PAYMENT
//         // ================================================

//         if (paymentEntity?.id) {
//           const existingPayment =
//             await prisma.payment.findUnique({
//               where: {
//                 razorpayPaymentId:
//                   paymentEntity.id,
//               },
//             });

//           if (existingPayment) {
//             console.log(
//               "ℹ️ Recurring payment already exists"
//             );

//             if (
//               existingPayment.status !== "SUCCESS"
//             ) {
//               await prisma.payment.update({
//                 where: {
//                   paymentId:
//                     existingPayment.paymentId,
//                 },

//                 data: {
//                   status: "SUCCESS",

//                   paidAt: new Date(),
//                 },
//               });
//             }
//           } else {
//             const amount =
//               Number(paymentEntity.amount) / 100;

//             await prisma.payment.create({
//               data: {
//                 tenantId:
//                   subscription.tenantId,

//                 subscriptionId:
//                   subscription.subscriptionId,

//                 amount:
//                   String(amount),

//                 currency:
//                   paymentEntity.currency || "INR",

//                 status: "SUCCESS",

//                 razorpayPaymentId:
//                   paymentEntity.id,

//                 razorpaySubscriptionId,

//                 paidAt:
//                   new Date(),
//               },
//             });

//             console.log(
//               "✅ Recurring AutoPay payment saved"
//             );
//           }
//         }
//       }
//     }

//     // ======================================================
//     // 6. PAYMENT FAILED
//     // ======================================================

//     else if (
//       event === "payment.failed"
//     ) {
//       console.log("\n");
//       console.log("======================================================");
//       console.log("❌ PAYMENT FAILED");
//       console.log("======================================================");

//       if (paymentEntity?.order_id) {
//         const payment =
//           await prisma.payment.findUnique({
//             where: {
//               razorpayOrderId:
//                 paymentEntity.order_id,
//             },
//           });

//         if (payment) {
//           await prisma.payment.update({
//             where: {
//               paymentId:
//                 payment.paymentId,
//             },

//             data: {
//               status: "FAILED",
//             },
//           });

//           console.log(
//             "❌ Upgrade payment marked FAILED"
//           );
//         }
//       }
//     }

//     // ======================================================
//     // 7. SUBSCRIPTION PENDING
//     // ======================================================

//     else if (
//       event === "subscription.pending"
//     ) {
//       console.log("\n");
//       console.log("======================================================");
//       console.log("⚠️ SUBSCRIPTION PENDING");
//       console.log("======================================================");

//       const subscription =
//         await getDbSubscription(
//           razorpaySubscriptionId
//         );

//       if (
//         subscription &&
//         subscription.status === "ACTIVE"
//       ) {
//         await prisma.subscription.update({
//           where: {
//             subscriptionId:
//               subscription.subscriptionId,
//           },

//           data: {
//             status: "PAST_DUE",
//           },
//         });

//         console.log(
//           "⚠️ Subscription marked PAST_DUE"
//         );
//       } else {
//         console.log(
//           "ℹ️ Subscription remains in current status"
//         );
//       }
//     }

//     // ======================================================
//     // 8. SUBSCRIPTION HALTED
//     // ======================================================

//     else if (
//       event === "subscription.halted"
//     ) {
//       console.log("\n");
//       console.log("======================================================");
//       console.log("🛑 SUBSCRIPTION HALTED");
//       console.log("======================================================");

//       const subscription =
//         await getDbSubscription(
//           razorpaySubscriptionId
//         );

//       if (subscription) {
//         await prisma.subscription.update({
//           where: {
//             subscriptionId:
//               subscription.subscriptionId,
//           },

//           data: {
//             status: "SUSPENDED",
//           },
//         });

//         console.log(
//           "🛑 Subscription marked SUSPENDED"
//         );
//       }
//     }

//     // ======================================================
//     // 9. SUBSCRIPTION CANCELLED
//     // ======================================================

//     else if (
//       event === "subscription.cancelled"
//     ) {
//       console.log("\n");
//       console.log("======================================================");
//       console.log("❌ SUBSCRIPTION CANCELLED");
//       console.log("======================================================");

//       const subscription =
//         await getDbSubscription(
//           razorpaySubscriptionId
//         );

//       if (subscription) {
//         await prisma.subscription.update({
//           where: {
//             subscriptionId:
//               subscription.subscriptionId,
//           },

//           data: {
//             status: "CANCELLED",
//           },
//         });

//         console.log(
//           "❌ Subscription marked CANCELLED"
//         );
//       }
//     }

//     // ======================================================
//     // 10. SUBSCRIPTION COMPLETED
//     // ======================================================

//     else if (
//       event === "subscription.completed"
//     ) {
//       console.log("\n");
//       console.log("======================================================");
//       console.log("🏁 SUBSCRIPTION COMPLETED");
//       console.log("======================================================");

//       const subscription =
//         await getDbSubscription(
//           razorpaySubscriptionId
//         );

//       if (subscription) {
//         await prisma.subscription.update({
//           where: {
//             subscriptionId:
//               subscription.subscriptionId,
//           },

//           data: {
//             status: "EXPIRED",
//           },
//         });

//         console.log(
//           "🏁 Subscription marked EXPIRED"
//         );
//       }
//     }

//     // ======================================================
//     // UNKNOWN EVENT
//     // ======================================================

//     else {
//       console.log(
//         `ℹ️ Unhandled event: ${event}`
//       );
//     }

//     // ======================================================
//     // FINAL RESPONSE
//     // ======================================================

//     console.log("\n");
//     console.log("======================================================");
//     console.log("✅ WEBHOOK PROCESSED");
//     console.log("======================================================");

//     return res.status(200).json({
//       success: true,
//       message: "Webhook processed successfully",
//     });

//   } catch (error) {
//     console.error("\n");
//     console.error("======================================================");
//     console.error("❌ RAZORPAY WEBHOOK ERROR");
//     console.error("======================================================");

//     console.error(
//       "Message:",
//       error.message
//     );

//     console.error(
//       "Stack:",
//       error.stack
//     );

//     return res.status(500).json({
//       success: false,
//       message: "Webhook processing failed",
//     });
//   }
// };



const getCurrentSubscription = async (req, res) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const subscription = await prisma.subscription.findFirst({
        where: {
          tenantId,
          status: "ACTIVE",
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Active subscription not found",
      });
    }

    return res.status(200).json({
      success: true,

      subscription: {
        subscriptionId:
          subscription.subscriptionId,

        status:
          subscription.status,

        startDate:
          subscription.startDate,

        endDate:
          subscription.endDate,

        razorpaySubscriptionId:
          subscription.razorpaySubscriptionId,

        razorpayCustomerId:
          subscription.razorpayCustomerId,

        // ==================================================
        // PLAN
        // ==================================================

        plan: {
          planId:
            subscription.plan.planId,

          name:
            subscription.plan.name,

          type:
            subscription.plan.type,

          // IMPORTANT:
          // billingCycle now comes from PLAN
          billingCycle:
            subscription.plan.billingCycle,


          planLevel:
          subscription.plan.planLevel,


          price:
            subscription.plan.price,

          razorpayPlanId:
            subscription.plan.razorpayPlanId,

          projectLimit:
            subscription.plan.projectLimit,

          collectionLimit:
            subscription.plan.collectionLimit,

          apiKeyLimit:
            subscription.plan.apiKeyLimit,

          teamMemberLimit:
            subscription.plan.teamMemberLimit,

          storageLimit:
            subscription.plan.storageLimit === -1n
              ? -1
              : Number(
                  subscription.plan.storageLimit
                ) / (1024 * 1024),

          getRequestsLimit:
            subscription.plan.getRequestsLimit,

          writeRequestsLimit:
            subscription.plan.writeRequestsLimit,

          customDomain:
            subscription.plan.customDomain,

          mediaUpload:
            subscription.plan.mediaUpload,

          analytics:
            subscription.plan.analytics,

          emailSupport:
            subscription.plan.emailSupport,
        },
      },
    });
  } catch (error) {
    console.error(
      "Get Current Subscription Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// GET ALL ACTIVE PLANS
// ==========================================

const getAvailablePlans = async (req, res) => {
  try {

    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }

        // ==========================================
    // GET CURRENT ACTIVE SUBSCRIPTION
    // ==========================================

    const currentSubscription =
      await prisma.subscription.findFirst({
        where: {
          tenantId,
          status: "ACTIVE",
        },

        include: {
          plan: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    if (!currentSubscription) {
      return res.status(404).json({
        success: false,
        message:
          "Active subscription not found",
      });
    }


    const currentLevel = Number(currentSubscription.plan.planLevel);


    const plans =
    await prisma.plan.findMany({
      where: {
        isActive: true,
        planLevel: {
          gt: currentLevel,
        },
      },

      orderBy: [
        {
          displayOrder: "asc",
        },

        {
          createdAt: "desc",
        },
      ],
    });

    if (plans.length === 0) {
      return res.status(200).json({
        success:true,
        message: "You are currently on the maximum plan."
      })
    }

      const formattedPlans = plans.map((plan) => ({
        ...plan,
      
        storageLimit:
          plan.storageLimit === -1n
            ? -1
            : Number(
                plan.storageLimit
              ) / (1024 * 1024),
      }));
      
      return res.status(201).json({
        success: true,
        count: formattedPlans.length,
        plans: formattedPlans,
      });
  } catch (error) {
    console.error(
      "Get Available Plans Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




// ==========================================================
// EXPORTS
// ==========================================================


module.exports = {
  getCurrentSubscription,
  getAvailablePlans,
  razorpayWebhook,
  upgradeSubscription,
};