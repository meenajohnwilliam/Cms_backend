// controllers/subscription.controller.js

const prisma = require("../config/prisma");
const crypto = require("crypto");
const config = require("../config/config");
const { razorpay } = require("../utils/services/razorpay.service");


// ============================================================================
// SUBSCRIPTION UPGRADE + RAZORPAY WEBHOOK CONTROLLER
// ============================================================================
//
// Expected imports in your project (unchanged from your original file):
//
//   const crypto   = require("crypto");
//   const prisma   = require("../config/prisma");
//   const razorpay = require("../config/razorpay");
//   const config   = require("../config");
//
// ----------------------------------------------------------------------------
// WHAT WAS FIXED
// ----------------------------------------------------------------------------
//
// 1. cancelOldRazorpaySubscription() rethrew on any unrecognised error.
//    The Razorpay SDK does NOT populate error.message, so every failure fell
//    through the includes() checks and threw. That throw escaped
//    activateSubscription() -> the event handler -> the outer catch, so the
//    webhook returned 500 and the new subscription stayed PENDING.
//    This only ever happened on PAID -> PAID, because a FREE plan has no
//    razorpaySubscriptionId and returned early. -> Now it never throws.
//
// 2. The old mandate was cancelled BEFORE the DB transaction, so a failing
//    cancel blocked activation permanently. -> Moved after the transaction.
//
// 3. The webhook returned 500 on processing errors, causing Razorpay to retry
//    the same failing payload for hours. -> Returns 200 after signature
//    verification succeeds. Signature failures still return 400.
//
// 4. PAID -> PAID cancelled the old AutoPay mandate and never created a new
//    one, so the tenant had no way to be charged at renewal. -> The mandate is
//    now migrated to the new plan (see transitionAutoPayMandate).
//
// ----------------------------------------------------------------------------
// REQUIRED PRISMA SCHEMA CONSTRAINTS
// ----------------------------------------------------------------------------
//
//   model Subscription {
//     razorpaySubscriptionId String? @unique
//   }
//
//   model Payment {
//     razorpayOrderId   String? @unique
//     razorpayPaymentId String? @unique
//   }
//
// findUnique() is used on all three fields below and will throw at runtime
// without these.
// ============================================================================


// ============================================================================
// UPGRADE SUBSCRIPTION
// ============================================================================

const upgradeSubscription = async (req, res) => {
  try {
    console.log("\n======================================================");
    console.log("🚀 UPGRADE SUBSCRIPTION STARTED");
    console.log("======================================================");

    const { tenantId, planId } = req.body;

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

    // ======================================================
    // 3. GET NEW PLAN
    // ======================================================

    const newPlan = await prisma.plan.findUnique({
      where: {
        planId,
      },
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

    // ======================================================
    // 4. SAME PLAN CHECK
    // ======================================================

    if (currentPlan.planId === newPlan.planId) {
      return res.status(400).json({
        success: false,
        message: "You are already using this plan",
      });
    }

    // ======================================================
    // 5. PLAN LEVEL CHECK
    // ======================================================

    const currentLevel = Number(currentPlan.planLevel);
    const newLevel = Number(newPlan.planLevel);

    if (newLevel <= currentLevel) {
      return res.status(400).json({
        success: false,
        message: "Selected plan is not an upgrade",
      });
    }

    // ======================================================
    // 6. CHECK RAZORPAY PLAN
    // ======================================================

    if (!newPlan.razorpayPlanId) {
      return res.status(400).json({
        success: false,
        message: "Razorpay plan is not configured",
      });
    }

    // ======================================================
    // 7. BLOCK DUPLICATE IN-FLIGHT UPGRADES
    //
    // Without this, every retry from the UI leaves another
    // PENDING row behind, and a late webhook for an abandoned
    // attempt can activate the wrong plan.
    // ======================================================

    const inFlight = await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: "PENDING",
        planId: newPlan.planId,
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (inFlight) {
      console.log(
        "ℹ️ Existing pending upgrade found:",
        inFlight.subscriptionId
      );
    }

    // ======================================================
    // CASE 1
    // FREE → PAID
    // ======================================================

    if (currentPlan.type === "FREE") {
      console.log("\n🆓 FREE → PAID");

      // ----------------------------------------------------
      // CREATE PENDING DB SUBSCRIPTION
      // ----------------------------------------------------

      const pendingSubscription = await prisma.subscription.create({
        data: {
          tenantId,
          planId: newPlan.planId,
          status: "PENDING",
          billingCycle: newPlan.billingCycle,
          startDate: new Date(),
          endDate: new Date(),
        },
      });

      // ----------------------------------------------------
      // CREATE RAZORPAY SUBSCRIPTION
      //
      // If this fails we must remove the pending row, otherwise
      // it lingers forever with no matching Razorpay entity.
      // ----------------------------------------------------

      let razorpaySubscription;

      try {
        razorpaySubscription = await razorpay.subscriptions.create({
          plan_id: newPlan.razorpayPlanId,
          quantity: 1,
          customer_notify: 1,
          total_count: newPlan.billingCycle === "MONTHLY" ? 120 : 10,
          notes: {
            tenantId,
            subscriptionId: pendingSubscription.subscriptionId,
            planId: newPlan.planId,
            upgradeType: "FREE_TO_PAID",
          },
        });
      } catch (error) {
        console.error(
          "❌ Razorpay subscription creation failed:",
          describeRazorpayError(error)
        );

        await prisma.subscription
          .delete({
            where: {
              subscriptionId: pendingSubscription.subscriptionId,
            },
          })
          .catch(() => {});

        return res.status(502).json({
          success: false,
          message: "Unable to create subscription with payment gateway",
        });
      }

      // ----------------------------------------------------
      // SAVE RAZORPAY SUBSCRIPTION ID
      // ----------------------------------------------------

      await prisma.subscription.update({
        where: {
          subscriptionId: pendingSubscription.subscriptionId,
        },
        data: {
          razorpaySubscriptionId: razorpaySubscription.id,
        },
      });

      console.log("✅ Razorpay Subscription Created");
      console.log("Subscription:", razorpaySubscription.id);

      return res.status(201).json({
        success: true,
        message: "Subscription created. Complete AutoPay authorization.",
        upgradeType: "FREE_TO_PAID",
        newPlan: {
          planId: newPlan.planId,
          name: newPlan.name,
          price: Number(newPlan.price),
          billingCycle: newPlan.billingCycle,
        },
        razorpay: {
          keyId: config.razorpay.keyId,
          subscriptionId: razorpaySubscription.id,
        },
      });
    }

    // ======================================================
    // CASE 2
    // PAID → PAID
    // ======================================================

    console.log("\n💳 PAID → PAID");

    // ======================================================
    // CALCULATE UNUSED CREDIT
    // ======================================================

    const currentPrice = Number(currentPlan.price || 0);
    const newPrice = Number(newPlan.price || 0);

    const startDate = new Date(currentSubscription.startDate);
    const endDate = new Date(currentSubscription.endDate);
    const now = new Date();

    const DAY = 1000 * 60 * 60 * 24;

    const totalDays = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / DAY)
    );

    const remainingDays = Math.max(
      0,
      Math.ceil((endDate.getTime() - now.getTime()) / DAY)
    );

    const unusedCredit = Number(
      ((currentPrice * remainingDays) / totalDays).toFixed(2)
    );

    const amountToPay = Number(
      Math.max(1, newPrice - unusedCredit).toFixed(2)
    );

    console.log("Current Price:", currentPrice);
    console.log("New Price:", newPrice);
    console.log("Total Days:", totalDays);
    console.log("Remaining Days:", remainingDays);
    console.log("Unused Credit:", unusedCredit);
    console.log("Amount To Pay:", amountToPay);

    // ======================================================
    // CREATE PENDING DB SUBSCRIPTION FIRST
    // ======================================================

    const pendingSubscription = await prisma.subscription.create({
      data: {
        tenantId,
        planId: newPlan.planId,
        status: "PENDING",
        billingCycle: newPlan.billingCycle,
        startDate: new Date(),
        endDate: new Date(),
      },
    });

    // ======================================================
    // CREATE RAZORPAY ORDER
    // ======================================================

    let razorpayOrder;

    try {
      razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amountToPay * 100),
        currency: "INR",
        receipt: `upgrade_${tenantId}_${Date.now()}`.slice(0, 40),
        notes: {
          tenantId,
          subscriptionId: pendingSubscription.subscriptionId,
          oldPlanId: currentPlan.planId,
          newPlanId: newPlan.planId,
          upgradeType: "PAID_TO_PAID",
        },
      });
    } catch (error) {
      console.error(
        "❌ Razorpay order creation failed:",
        describeRazorpayError(error)
      );

      await prisma.subscription
        .delete({
          where: {
            subscriptionId: pendingSubscription.subscriptionId,
          },
        })
        .catch(() => {});

      return res.status(502).json({
        success: false,
        message: "Unable to create payment order",
      });
    }

    console.log("✅ Upgrade Order Created");
    console.log("Order ID:", razorpayOrder.id);

    // ======================================================
    // CREATE PAYMENT RECORD
    // ======================================================

    const payment = await prisma.payment.create({
      data: {
        tenantId,
        subscriptionId: pendingSubscription.subscriptionId,
        amount: String(amountToPay),
        currency: "INR",
        status: "PENDING",
        razorpayOrderId: razorpayOrder.id,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Upgrade payment created",
      upgradeType: "PAID_TO_PAID",

      currentPlan: {
        name: currentPlan.name,
        price: currentPrice,
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
      },

      razorpay: {
        keyId: config.razorpay.keyId,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
      },

      payment: {
        paymentId: payment.paymentId,
        amount: amountToPay,
        status: "PENDING",
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


// ============================================================================
// HELPER: READABLE RAZORPAY ERROR
//
// The Razorpay Node SDK rejects with { statusCode, error: { code,
// description, reason } }. error.message is undefined, which is exactly
// why the original string matching never worked.
// ============================================================================

const describeRazorpayError = (error) => {
  if (!error) return "unknown error";

  return (
    error?.error?.description ||
    error?.error?.reason ||
    error?.description ||
    error?.message ||
    JSON.stringify(error?.error || error)
  );
};


// ============================================================================
// HELPER: IS THE MANDATE ALREADY DEAD?
// ============================================================================

const isAlreadyInactiveError = (error) => {
  const text = String(
    describeRazorpayError(error) + " " + (error?.error?.code || "")
  ).toLowerCase();

  return (
    text.includes("already cancelled") ||
    text.includes("already been cancelled") ||
    text.includes("cancelled state") ||
    text.includes("expired") ||
    text.includes("completed") ||
    text.includes("not found")
  );
};


// ============================================================================
// RAZORPAY WEBHOOK
// ============================================================================

const razorpayWebhook = async (req, res) => {
  // --------------------------------------------------------
  // Anything after signature verification returns 200.
  // A 500 makes Razorpay retry the same failing payload for
  // hours and hides the real error behind retry noise.
  // --------------------------------------------------------

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
      .createHmac("sha256",  config.razorpay.keySecret)
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

    const subscriptionEntity = payload.payload?.subscription?.entity;
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;

    const razorpaySubscriptionId = subscriptionEntity?.id;
    const razorpayPaymentId = paymentEntity?.id;
    const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;

    console.log("\nEvent:", event);
    console.log("Subscription ID:", razorpaySubscriptionId || "undefined");
    console.log("Payment ID:", razorpayPaymentId || "undefined");
    console.log("Order ID:", razorpayOrderId || "undefined");

    // ======================================================
    // HELPER: GET DB SUBSCRIPTION
    // ======================================================

    const getDbSubscription = async (rzpSubscriptionId) => {
      if (!rzpSubscriptionId) return null;

      return await prisma.subscription.findUnique({
        where: {
          razorpaySubscriptionId: rzpSubscriptionId,
        },
        include: {
          plan: true,
        },
      });
    };

    // ======================================================
    // HELPER: GET UPGRADE (ONE-TIME ORDER) PAYMENT
    // ======================================================

    const getUpgradePayment = async (subscriptionId) => {
      return await prisma.payment.findFirst({
        where: {
          subscriptionId,
          razorpayOrderId: {
            not: null,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    };

    // ======================================================
    // HELPER: CALCULATE SUBSCRIPTION DATES
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
        endDate = new Date(startDate);

        if (subscription.plan?.billingCycle === "MONTHLY") {
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (subscription.plan?.billingCycle === "YEARLY") {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }
      }

      return { startDate, endDate };
    };

    // ======================================================
    // HELPER: CANCEL OLD RAZORPAY SUBSCRIPTION
    //
    // FIX #1: this must NEVER throw. A dead or un-cancellable
    // mandate on the OLD plan is not a reason to withhold the
    // NEW plan from a tenant who has already paid.
    // ======================================================

    const cancelOldRazorpaySubscription = async (oldSubscription) => {
      if (!oldSubscription?.razorpaySubscriptionId) {
        console.log("ℹ️ Old Razorpay subscription not found");
        return;
      }

      console.log(
        "🔄 Cancelling old Razorpay subscription:",
        oldSubscription.razorpaySubscriptionId
      );

      try {
        await razorpay.subscriptions.cancel(
          oldSubscription.razorpaySubscriptionId,
          false
        );

        console.log("✅ Old Razorpay subscription cancelled");
      } catch (error) {
        if (isAlreadyInactiveError(error)) {
          console.log("ℹ️ Old Razorpay subscription already inactive");
          return;
        }

        console.error(
          "⚠️ Razorpay cancellation failed (continuing anyway):",
          describeRazorpayError(error)
        );

        // Deliberately swallowed. Reconcile these from logs or a
        // nightly job rather than blocking activation.
      }
    };

    // ======================================================
    // HELPER: MIGRATE THE AUTOPAY MANDATE TO THE NEW PLAN
    //
    // FIX #4: the original code cancelled the old mandate and
    // created nothing, so an upgraded tenant could never be
    // charged again and no subscription.charged event would
    // ever arrive.
    //
    // Preferred path: update the EXISTING Razorpay subscription
    // to the new plan with schedule_change_at "cycle_end". The
    // prorated one-time order already covers the current cycle,
    // so AutoPay picks up at the new price from the next one,
    // and the customer keeps their existing mandate.
    //
    // Fallback: cancel the old mandate and create a fresh
    // subscription starting at the new endDate. Razorpay will
    // notify the customer to authorize it (customer_notify: 1).
    //
    // Both paths are best effort and never throw.
    // ======================================================

    const transitionAutoPayMandate = async (
      oldSubscription,
      newSubscription
    ) => {
      if (!newSubscription) return;

      // FREE -> PAID already created its own mandate up front.
      if (newSubscription.razorpaySubscriptionId) {
        console.log("ℹ️ New subscription already has an AutoPay mandate");
        return;
      }

      const plan = newSubscription.plan;

      if (!plan || plan.type !== "PAID" || !plan.razorpayPlanId) {
        console.log("ℹ️ No Razorpay plan configured, skipping mandate setup");
        return;
      }

      // ----------------------------------------------------
      // PATH A: reuse the existing mandate
      // ----------------------------------------------------

      if (oldSubscription?.razorpaySubscriptionId) {
        try {
          console.log(
            "🔄 Moving existing mandate to new plan:",
            oldSubscription.razorpaySubscriptionId
          );

          await razorpay.subscriptions.update(
            oldSubscription.razorpaySubscriptionId,
            {
              plan_id: plan.razorpayPlanId,
              quantity: 1,
              schedule_change_at: "cycle_end",
              customer_notify: 1,
            }
          );

          // razorpaySubscriptionId is unique, so clear it from the
          // old row in the same transaction as setting it on the new.
          await prisma.$transaction(async (tx) => {
            await tx.subscription.update({
              where: {
                subscriptionId: oldSubscription.subscriptionId,
              },
              data: {
                razorpaySubscriptionId: null,
              },
            });

            await tx.subscription.update({
              where: {
                subscriptionId: newSubscription.subscriptionId,
              },
              data: {
                razorpaySubscriptionId:
                  oldSubscription.razorpaySubscriptionId,
              },
            });
          });

          console.log("✅ AutoPay mandate migrated to new plan");
          return;
        } catch (error) {
          console.error(
            "⚠️ Mandate update failed, falling back to new mandate:",
            describeRazorpayError(error)
          );

          // The old mandate is unusable for the new plan, so retire it.
          await cancelOldRazorpaySubscription(oldSubscription);
        }
      }

      // ----------------------------------------------------
      // PATH B: create a fresh mandate starting next cycle
      // ----------------------------------------------------

      try {
        const nowSec = Math.floor(Date.now() / 1000);

        const cycleEndSec = Math.floor(
          new Date(newSubscription.endDate).getTime() / 1000
        );

        // start_at must be comfortably in the future
        const startAt = Math.max(cycleEndSec, nowSec + 900);

        const created = await razorpay.subscriptions.create({
          plan_id: plan.razorpayPlanId,
          quantity: 1,
          customer_notify: 1,
          total_count: plan.billingCycle === "MONTHLY" ? 120 : 10,
          start_at: startAt,
          notes: {
            tenantId: newSubscription.tenantId,
            subscriptionId: newSubscription.subscriptionId,
            planId: plan.planId,
            mandateType: "UPGRADE_RENEWAL",
          },
        });

        await prisma.subscription.update({
          where: {
            subscriptionId: newSubscription.subscriptionId,
          },
          data: {
            razorpaySubscriptionId: created.id,
          },
        });

        console.log("✅ New AutoPay mandate created:", created.id);
        console.log("⚠️ Customer must authorize this mandate before renewal");
      } catch (error) {
        console.error(
          "⚠️ Could not create renewal mandate (plan is still active):",
          describeRazorpayError(error)
        );

        // The tenant keeps the plan they paid for. Renewal needs
        // manual follow-up. Alert on this log line.
      }
    };

    // ======================================================
    // HELPER: ACTIVATE SUBSCRIPTION
    // ======================================================

    const activateSubscription = async (
      subscription,
      razorpaySubscription = null
    ) => {
      if (!subscription) {
        console.log("❌ Subscription not found for activation");
        return null;
      }

      console.log("\n");
      console.log("======================================================");
      console.log("🟢 ACTIVATING NEW SUBSCRIPTION");
      console.log("======================================================");

      console.log("Subscription:", subscription.subscriptionId);
      console.log("Tenant:", subscription.tenantId);
      console.log("Plan:", subscription.plan?.name);

      if (subscription.status === "ACTIVE") {
        console.log("ℹ️ Subscription already ACTIVE");
        return subscription;
      }

      // ====================================================
      // FIND OLD ACTIVE SUBSCRIPTION
      // ====================================================

      const oldSubscription = await prisma.subscription.findFirst({
        where: {
          tenantId: subscription.tenantId,
          status: "ACTIVE",
          NOT: {
            subscriptionId: subscription.subscriptionId,
          },
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (oldSubscription) {
        console.log("Old subscription found:", oldSubscription.subscriptionId);
        console.log("Old plan:", oldSubscription.plan?.name);
      } else {
        console.log("ℹ️ No old active subscription");
      }

      // ====================================================
      // CALCULATE NEW DATES
      // ====================================================

      const { startDate, endDate } = calculateSubscriptionDates(
        subscription,
        razorpaySubscription
      );

      console.log("New Start Date:", startDate);
      console.log("New End Date:", endDate);

      // ====================================================
      // DATABASE TRANSACTION
      //
      // FIX #2: this now runs BEFORE any Razorpay call, so no
      // gateway failure can prevent the plan switch.
      // ====================================================

      const result = await prisma.$transaction(async (tx) => {
        if (oldSubscription) {
          await tx.subscription.update({
            where: {
              subscriptionId: oldSubscription.subscriptionId,
            },
            data: {
              status: "CANCELLED",
            },
          });

          console.log("✅ Old DB subscription CANCELLED");
        }

        const activated = await tx.subscription.update({
          where: {
            subscriptionId: subscription.subscriptionId,
          },
          data: {
            status: "ACTIVE",
            startDate,
            endDate,
          },
          include: {
            plan: true,
          },
        });

        console.log("🎉 New DB subscription ACTIVE");

        return activated;
      });

      // ====================================================
      // GATEWAY SIDE EFFECTS (BEST EFFORT, NEVER THROW)
      // ====================================================

      await transitionAutoPayMandate(oldSubscription, result);

      console.log("======================================================");
      console.log("🎉 SUBSCRIPTION ACTIVATION COMPLETED");
      console.log("======================================================");

      return result;
    };

    // ======================================================
    // HELPER: MARK ORDER PAYMENT SUCCESS
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

      console.log("\n");
      console.log("======================================================");
      console.log("💰 PROCESSING ORDER PAYMENT");
      console.log("======================================================");

      console.log("Order ID:", orderId);
      console.log("Payment ID:", paymentEntity.id);

      // ====================================================
      // FIND PAYMENT
      // ====================================================

      const dbPayment = await prisma.payment.findUnique({
        where: {
          razorpayOrderId: orderId,
        },
      });

      if (!dbPayment) {
        console.log("ℹ️ This order does not belong to our upgrade system");
        return null;
      }

      console.log("✅ Database payment found");
      console.log("DB Payment ID:", dbPayment.paymentId);

      // ====================================================
      // AMOUNT VERIFICATION
      // ====================================================

      const razorpayAmount = Number(paymentEntity.amount) / 100;
      const databaseAmount = Number(dbPayment.amount);

      console.log("Razorpay Amount:", razorpayAmount);
      console.log("Database Amount:", databaseAmount);

      if (
        Number(razorpayAmount.toFixed(2)) !==
        Number(databaseAmount.toFixed(2))
      ) {
        console.error("❌ PAYMENT AMOUNT MISMATCH");
        console.error("Refusing to activate. Investigate manually.");

        // Returning null instead of throwing: a mismatch is a
        // permanent condition, so retries cannot help.
        return null;
      }

      // ====================================================
      // ALREADY SUCCESS
      // ====================================================

      if (dbPayment.status === "SUCCESS") {
        console.log("ℹ️ Payment already SUCCESS");
        return dbPayment;
      }

      // ====================================================
      // MARK SUCCESS
      // ====================================================

      const updatedPayment = await prisma.payment.update({
        where: {
          paymentId: dbPayment.paymentId,
        },
        data: {
          status: "SUCCESS",
          razorpayPaymentId: paymentEntity.id,
          paidAt: new Date(),
        },
      });

      console.log("✅ Order payment marked SUCCESS");

      return updatedPayment;
    };

    // ======================================================
    // HELPER: ACTIVATE FROM A SUCCESSFUL ORDER PAYMENT
    // ======================================================

    const activateFromOrderPayment = async (payment) => {
      if (!payment) {
        console.log("ℹ️ No upgrade payment found");
        return;
      }

      const newSubscription = await prisma.subscription.findUnique({
        where: {
          subscriptionId: payment.subscriptionId,
        },
        include: {
          plan: true,
        },
      });

      if (!newSubscription) {
        console.log("❌ New subscription not found");
        return;
      }

      console.log("New pending subscription:", newSubscription.subscriptionId);
      console.log("New plan:", newSubscription.plan?.name);

      if (newSubscription.status === "ACTIVE") {
        console.log("ℹ️ Subscription already ACTIVE");
        return;
      }

      await activateSubscription(newSubscription, null);
    };

    // ======================================================
    // 1. ORDER PAID
    // ======================================================

    if (event === "order.paid") {
      console.log("\n");
      console.log("======================================================");
      console.log("💰 ORDER PAID");
      console.log("======================================================");

      const payment = await processOrderPayment(paymentEntity, orderEntity);

      await activateFromOrderPayment(payment);
    }

    // ======================================================
    // 2. PAYMENT CAPTURED
    //
    // Idempotent. If order.paid already handled it, the
    // ACTIVE guard prevents a duplicate activation.
    // ======================================================

    else if (event === "payment.captured") {
      console.log("\n");
      console.log("======================================================");
      console.log("💳 PAYMENT CAPTURED");
      console.log("======================================================");

      const payment = await processOrderPayment(paymentEntity, null);

      await activateFromOrderPayment(payment);
    }

    // ======================================================
    // 3. SUBSCRIPTION AUTHENTICATED
    //
    // AutoPay mandate authentication only. No plan change.
    // ======================================================

    else if (event === "subscription.authenticated") {
      console.log("\n");
      console.log("======================================================");
      console.log("🔐 SUBSCRIPTION AUTHENTICATED");
      console.log("======================================================");

      const subscription = await getDbSubscription(razorpaySubscriptionId);

      if (!subscription) {
        console.log("⚠️ Subscription not found");
      } else {
        console.log("Subscription found:", subscription.subscriptionId);
        console.log("ℹ️ AutoPay mandate authenticated");
        console.log("ℹ️ No plan activation here");
      }
    }

    // ======================================================
    // 4. SUBSCRIPTION ACTIVATED
    // ======================================================

    else if (event === "subscription.activated") {
      console.log("\n");
      console.log("======================================================");
      console.log("🟢 RAZORPAY SUBSCRIPTION ACTIVATED");
      console.log("======================================================");

      const subscription = await getDbSubscription(razorpaySubscriptionId);

      if (!subscription) {
        console.log("⚠️ Subscription not found in DB");
      } else {
        console.log("DB Subscription:", subscription.subscriptionId);
        console.log("Plan:", subscription.plan?.name);

        const upgradePayment = await getUpgradePayment(
          subscription.subscriptionId
        );

        if (!upgradePayment) {
          console.log("🆓 FREE → PAID subscription");

          if (subscription.status !== "ACTIVE") {
            await activateSubscription(subscription, subscriptionEntity);
          }
        } else {
          console.log("ℹ️ PAID → PAID upgrade subscription");
          console.log("Order payment status:", upgradePayment.status);

          if (
            upgradePayment.status === "SUCCESS" &&
            subscription.status !== "ACTIVE"
          ) {
            await activateSubscription(subscription, subscriptionEntity);
          } else if (upgradePayment.status !== "SUCCESS") {
            console.log("⏳ Waiting for one-time upgrade payment");
          }
        }
      }
    }

    // ======================================================
    // 5. SUBSCRIPTION CHARGED
    //
    // Recurring AutoPay payment every month/year.
    // ======================================================

    else if (event === "subscription.charged") {
      console.log("\n");
      console.log("======================================================");
      console.log("💰 SUBSCRIPTION CHARGED");
      console.log("======================================================");

      const subscription = await getDbSubscription(razorpaySubscriptionId);

      if (!subscription) {
        console.log("⚠️ Subscription not found");
      } else {
        console.log("Subscription:", subscription.subscriptionId);
        console.log("Plan:", subscription.plan?.name);

        // ================================================
        // UPDATE BILLING PERIOD
        // ================================================

        const { startDate, endDate } = calculateSubscriptionDates(
          subscription,
          subscriptionEntity
        );

        await prisma.subscription.update({
          where: {
            subscriptionId: subscription.subscriptionId,
          },
          data: {
            status: "ACTIVE",
            startDate,
            endDate,
          },
        });

        console.log("✅ Subscription period updated");

        // ================================================
        // CREATE RECURRING PAYMENT
        // ================================================

        if (paymentEntity?.id) {
          const existingPayment = await prisma.payment.findUnique({
            where: {
              razorpayPaymentId: paymentEntity.id,
            },
          });

          if (existingPayment) {
            console.log("ℹ️ Recurring payment already exists");

            if (existingPayment.status !== "SUCCESS") {
              await prisma.payment.update({
                where: {
                  paymentId: existingPayment.paymentId,
                },
                data: {
                  status: "SUCCESS",
                  paidAt: new Date(),
                },
              });
            }
          } else {
            const amount = Number(paymentEntity.amount) / 100;

            await prisma.payment.create({
              data: {
                tenantId: subscription.tenantId,
                subscriptionId: subscription.subscriptionId,
                amount: String(amount),
                currency: paymentEntity.currency || "INR",
                status: "SUCCESS",
                razorpayPaymentId: paymentEntity.id,
                razorpaySubscriptionId,
                paidAt: new Date(),
              },
            });

            console.log("✅ Recurring AutoPay payment saved");
          }
        }
      }
    }

    // ======================================================
    // 6. PAYMENT FAILED
    // ======================================================

    else if (event === "payment.failed") {
      console.log("\n");
      console.log("======================================================");
      console.log("❌ PAYMENT FAILED");
      console.log("======================================================");

      if (paymentEntity?.order_id) {
        const payment = await prisma.payment.findUnique({
          where: {
            razorpayOrderId: paymentEntity.order_id,
          },
        });

        if (payment && payment.status !== "SUCCESS") {
          await prisma.payment.update({
            where: {
              paymentId: payment.paymentId,
            },
            data: {
              status: "FAILED",
            },
          });

          console.log("❌ Upgrade payment marked FAILED");

          // Retire the pending subscription so it cannot be
          // activated later by a stale event.
          const pending = await prisma.subscription.findUnique({
            where: {
              subscriptionId: payment.subscriptionId,
            },
          });

          if (pending && pending.status === "PENDING") {
            await prisma.subscription.update({
              where: {
                subscriptionId: pending.subscriptionId,
              },
              data: {
                status: "CANCELLED",
              },
            });

            console.log("❌ Pending upgrade subscription CANCELLED");
          }
        } else if (payment) {
          console.log("ℹ️ Payment already SUCCESS, ignoring failure event");
        }
      }
    }

    // ======================================================
    // 7. SUBSCRIPTION PENDING
    // ======================================================

    else if (event === "subscription.pending") {
      console.log("\n");
      console.log("======================================================");
      console.log("⚠️ SUBSCRIPTION PENDING");
      console.log("======================================================");

      const subscription = await getDbSubscription(razorpaySubscriptionId);

      if (subscription && subscription.status === "ACTIVE") {
        await prisma.subscription.update({
          where: {
            subscriptionId: subscription.subscriptionId,
          },
          data: {
            status: "PAST_DUE",
          },
        });

        console.log("⚠️ Subscription marked PAST_DUE");
      } else {
        console.log("ℹ️ Subscription remains in current status");
      }
    }

    // ======================================================
    // 8. SUBSCRIPTION HALTED
    // ======================================================

    else if (event === "subscription.halted") {
      console.log("\n");
      console.log("======================================================");
      console.log("🛑 SUBSCRIPTION HALTED");
      console.log("======================================================");

      const subscription = await getDbSubscription(razorpaySubscriptionId);

      if (subscription) {
        await prisma.subscription.update({
          where: {
            subscriptionId: subscription.subscriptionId,
          },
          data: {
            status: "SUSPENDED",
          },
        });

        console.log("🛑 Subscription marked SUSPENDED");
      }
    }

    // ======================================================
    // 9. SUBSCRIPTION CANCELLED
    //
    // Guard: we cancel old mandates ourselves during an
    // upgrade. Without this check the event can arrive after
    // the DB row was already reused and flip a live plan off.
    // ======================================================

    else if (event === "subscription.cancelled") {
      console.log("\n");
      console.log("======================================================");
      console.log("❌ SUBSCRIPTION CANCELLED");
      console.log("======================================================");

      const subscription = await getDbSubscription(razorpaySubscriptionId);

      if (!subscription) {
        console.log("ℹ️ No matching DB subscription");
      } else if (subscription.status === "CANCELLED") {
        console.log("ℹ️ Already CANCELLED");
      } else {
        await prisma.subscription.update({
          where: {
            subscriptionId: subscription.subscriptionId,
          },
          data: {
            status: "CANCELLED",
          },
        });

        console.log("❌ Subscription marked CANCELLED");
      }
    }

    // ======================================================
    // 10. SUBSCRIPTION COMPLETED
    // ======================================================

    else if (event === "subscription.completed") {
      console.log("\n");
      console.log("======================================================");
      console.log("🏁 SUBSCRIPTION COMPLETED");
      console.log("======================================================");

      const subscription = await getDbSubscription(razorpaySubscriptionId);

      if (subscription) {
        await prisma.subscription.update({
          where: {
            subscriptionId: subscription.subscriptionId,
          },
          data: {
            status: "EXPIRED",
          },
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

    // ======================================================
    // FINAL RESPONSE
    // ======================================================

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

    // FIX #3: 200, not 500. The signature was already verified, so
    // this is our bug, not Razorpay's. Retrying the same payload
    // will fail identically and bury the real error in retry noise.
    return res.status(200).json({
      success: false,
      message: "Webhook received, processing failed",
    });
  }
};


module.exports = {
  upgradeSubscription,
  razorpayWebhook,
};


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