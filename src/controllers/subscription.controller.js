// controllers/subscription.controller.js

const prisma = require("../config/prisma");
const crypto = require("crypto");
const config = require("../config/config");
const { razorpay } = require("../utils/services/razorpay.service");





const upgradeSubscription = async (req, res) => {
  try {
    const { planId } = req.body;
    const { tenantId } = req.user;

    if (!tenantId || !planId) {
      return res.status(400).json({
        success: false,
        message: "tenantId and planId are required",
      });
    }

    // --------------------------------------------------
    // CURRENT ACTIVE SUBSCRIPTION
    // --------------------------------------------------

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
      return res.status(400).json({
        success: false,
        message: "Active subscription not found",
      });
    }

    // --------------------------------------------------
    // NEW PLAN
    // --------------------------------------------------

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
        message: "Selected plan is inactive",
      });
    }

    if (newPlan.type !== "PAID") {
      return res.status(400).json({
        success: false,
        message: "Please select a paid plan",
      });
    }

    if (!newPlan.razorpayPlanId) {
      return res.status(400).json({
        success: false,
        message: "Razorpay plan ID is not configured",
      });
    }

    const currentPlan = currentSubscription.plan;

    // ==================================================
    // FREE → PAID
    // ==================================================

    if (currentPlan.type === "FREE") {
      const pendingSubscription =
        await prisma.subscription.create({
          data: {
            tenantId,
            planId: newPlan.planId,
            status: "PENDING",
            billingCycle: newPlan.billingCycle,
            planPrice: newPlan.price,
            startDate: new Date(),
            endDate: new Date(),
          },
        });

      try {
        const razorpaySubscription =
          await razorpay.subscriptions.create({
            plan_id: newPlan.razorpayPlanId,

            quantity: 1,

            customer_notify: 1,

            total_count:
              newPlan.billingCycle === "MONTHLY"
                ? 120
                : 10,

            notes: {
              type: "FREE_TO_PAID",
              tenantId,
              subscriptionId:
                pendingSubscription.subscriptionId,
              planId: newPlan.planId,
            },
          });

        const updatedSubscription =
          await prisma.subscription.update({
            where: {
              subscriptionId:
                pendingSubscription.subscriptionId,
            },
            data: {
              razorpaySubscriptionId:
                razorpaySubscription.id,
            },
          });

        return res.status(201).json({
          success: true,
          message:
            "Subscription created. Complete AutoPay authorization.",

          subscription: {
            subscriptionId:
              updatedSubscription.subscriptionId,

            status: updatedSubscription.status,
          },

          razorpay: {
            keyId: config.razorpay.keyId,

            subscriptionId:
              razorpaySubscription.id,
          },
        });
      } catch (error) {
        await prisma.subscription.delete({
          where: {
            subscriptionId:
              pendingSubscription.subscriptionId,
          },
        });

        throw error;
      }
    }

    // ==================================================
    // PAID → PAID
    // ==================================================

    if (currentPlan.type === "PAID") {
      // ------------------------------------------------
      // Allowed upgrade combinations
      // MONTHLY → MONTHLY
      // MONTHLY → YEARLY
      // YEARLY  → YEARLY
      // ------------------------------------------------

      if (
        currentPlan.billingCycle === "YEARLY" &&
        newPlan.billingCycle === "MONTHLY"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Yearly to monthly downgrade is not allowed",
        });
      }

      // ------------------------------------------------
      // CHECK SAME PLAN
      // ------------------------------------------------

      if (currentPlan.planId === newPlan.planId) {
        return res.status(400).json({
          success: false,
          message: "You are already using this plan",
        });
      }

      // ------------------------------------------------
      // CALCULATE USED AMOUNT
      // ------------------------------------------------

      const startDate =
        new Date(currentSubscription.startDate);

      const endDate =
        new Date(currentSubscription.endDate);

      const now = new Date();

      const totalMilliseconds =
        endDate.getTime() - startDate.getTime();

      const usedMilliseconds =
        now.getTime() - startDate.getTime();

      const totalDays =
        totalMilliseconds /
        (1000 * 60 * 60 * 24);

      const usedDays =
        Math.max(
          0,
          Math.min(
            totalDays,
            usedMilliseconds /
              (1000 * 60 * 60 * 24)
          )
        );

      const oldPlanPrice =
        Number(currentSubscription.planPrice);

      const usedAmount =
        (oldPlanPrice / totalDays) * usedDays;

      // ------------------------------------------------
      // UPGRADE AMOUNT
      // ------------------------------------------------

      const newPlanPrice =
        Number(newPlan.price);

      const upgradeAmount =
        Math.max(
          0,
          newPlanPrice - usedAmount
        );

      const upgradeAmountPaise =
        Math.round(upgradeAmount * 100);

      if (upgradeAmountPaise <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "No payment is required for this upgrade",
        });
      }

      // ------------------------------------------------
      // CREATE LOCAL PENDING SUBSCRIPTION
      // ------------------------------------------------

      const pendingSubscription =
        await prisma.subscription.create({
          data: {
            tenantId,

            planId: newPlan.planId,

            status: "PENDING",

            billingCycle:
              newPlan.billingCycle,

            planPrice:
              newPlan.price,

            startDate: new Date(),

            endDate: new Date(),
          },
        });

      // ------------------------------------------------
      // CREATE RAZORPAY SUBSCRIPTION
      // ------------------------------------------------

      try {
        const razorpaySubscription =
          await razorpay.subscriptions.create({
            plan_id:
              newPlan.razorpayPlanId,

            quantity: 1,

            customer_notify: 1,

            total_count:
              newPlan.billingCycle === "MONTHLY"
                ? 120
                : 10,

            // THIS IS THE UPGRADE PAYMENT
            addons: [
              {
                item: {
                  name: "Plan Upgrade Amount",

                  amount:
                    upgradeAmountPaise,

                  currency: "INR",
                },
              },
            ],

            notes: {
              type: "PAID_TO_PAID",

              tenantId,

              oldSubscriptionId:
                currentSubscription.subscriptionId,

              oldPlanId:
                currentPlan.planId,

              newPlanId:
                newPlan.planId,

              upgradeAmount:
                String(upgradeAmount),

              usedAmount:
                String(usedAmount),
            },
          });

        // ------------------------------------------------
        // SAVE RAZORPAY SUBSCRIPTION ID
        // ------------------------------------------------

        const updatedSubscription =
          await prisma.subscription.update({
            where: {
              subscriptionId:
                pendingSubscription.subscriptionId,
            },

            data: {
              razorpaySubscriptionId:
                razorpaySubscription.id,
            },
          });

        // ------------------------------------------------
        // RETURN TO FRONTEND
        // ------------------------------------------------

        return res.status(201).json({
          success: true,

          message:
            "Upgrade subscription created. Complete payment and AutoPay authorization.",

          currentPlan: {
            planId:
              currentPlan.planId,

            name:
              currentPlan.name,

            price:
              Number(currentPlan.price),

            billingCycle:
              currentPlan.billingCycle,
          },

          newPlan: {
            planId:
              newPlan.planId,

            name:
              newPlan.name,

            price:
              Number(newPlan.price),

            billingCycle:
              newPlan.billingCycle,
          },

          calculation: {
            oldPlanPrice,

            usedDays:
              Number(usedDays.toFixed(2)),

            totalDays:
              Number(totalDays.toFixed(2)),

            usedAmount:
              Number(usedAmount.toFixed(2)),

            upgradeAmount:
              Number(upgradeAmount.toFixed(2)),
          },

          subscription: {
            subscriptionId:
              updatedSubscription.subscriptionId,

            status:
              updatedSubscription.status,
          },

          razorpay: {
            keyId:
              config.razorpay.keyId,

            subscriptionId:
              razorpaySubscription.id,

            amount:
              upgradeAmountPaise,
          },
        });
      } catch (error) {
        await prisma.subscription.delete({
          where: {
            subscriptionId:
              pendingSubscription.subscriptionId,
          },
        });

        throw error;
      }
    }

    return res.status(400).json({
      success: false,
      message: "Invalid current plan type",
    });
  } catch (error) {
    console.error(
      "UPGRADE SUBSCRIPTION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};







const razorpayWebhook = async (req, res) => {
  try {
    // 1. Verify webhook
    const signature = req.headers["x-razorpay-signature"];

    const expectedSignature = crypto
      .createHmac("sha256", config.razorpay.keySecret)
      .update(req.body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    // 2. Convert Buffer to JSON
    const webhookData = JSON.parse(
      req.body.toString("utf8")
    );

    const { event, payload } = webhookData;


    const subscriptionData = payload.subscription?.entity;
    const paymentData = payload.payment?.entity;

    if (!subscriptionData) {
      return res.status(200).json({
        success: true,
      });
    }

    // 2. Find subscription
    const subscription =
      await prisma.subscription.findUnique({
        where: {
          razorpaySubscriptionId: subscriptionData.id,
        },
      });

    if (!subscription) {
      return res.status(200).json({
        success: true,
      });
    }

    // 3. Subscription Activated
    if (event === "subscription.activated") {
      const startDate = new Date(
        subscriptionData.current_start * 1000
      );

      const endDate = new Date(
        subscriptionData.current_end * 1000
      );

      // Cancel old active subscription
      await prisma.subscription.updateMany({
        where: {
          tenantId: subscription.tenantId,
          status: "ACTIVE",
          NOT: {
            subscriptionId: subscription.subscriptionId,
          },
        },
        data: {
          status: "CANCELLED",
        },
      });

      // Activate new subscription
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
    }

    // 4. Monthly Payment Successful
    if (event === "subscription.charged") {
      const startDate = new Date(
        subscriptionData.current_start * 1000
      );

      const endDate = new Date(
        subscriptionData.current_end * 1000
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

      // Save payment
      if (paymentData) {
        const paymentExists =
          await prisma.payment.findFirst({
            where: {
              razorpayPaymentId: paymentData.id,
            },
          });

        if (!paymentExists) {
          await prisma.payment.create({
            data: {
              tenantId: subscription.tenantId,
              subscriptionId: subscription.subscriptionId,          
              amount: String(paymentData.amount / 100),
              status: "SUCCESS",
              razorpayPaymentId: paymentData.id,
              razorpaySubscriptionId: subscriptionData.id,
            },
          });
        }
      }
    }

    // 5. Subscription Cancelled
    if (event === "subscription.cancelled") {

      console.log("================================");
      console.log("SUBSCRIPTION CANCELLED");
      console.log("Razorpay ID:", subscriptionData.id);
      console.log("Status:", subscriptionData.status);
      console.log("Current End:", subscriptionData.current_end);
      console.log("Ended At:", subscriptionData.ended_at);
      console.log("================================");
    
      await prisma.subscription.update({
        where: {
          subscriptionId: subscription.subscriptionId,
        },
        data: {
          status: "CANCELLED",
        },
      });
    }

    // 6. Subscription Completed
    if (event === "subscription.completed") {
      await prisma.subscription.update({
        where: {
          subscriptionId: subscription.subscriptionId,
        },
        data: {
          status: "EXPIRED",
        },
      });
    }

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Razorpay Webhook Error:", error);

    return res.status(500).json({
      success: false,
      message: "Webhook failed",
    });
  }
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