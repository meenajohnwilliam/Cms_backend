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

    // =====================================================
    // CURRENT ACTIVE SUBSCRIPTION
    // =====================================================

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

    // =====================================================
    // NEW PLAN
    // =====================================================

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

    // =====================================================
    // SAME PLAN
    // =====================================================

    if (currentPlan.planId === newPlan.planId) {
      return res.status(400).json({
        success: false,
        message: "You are already using this plan",
      });
    }

    // =====================================================
    // FREE → PAID
    // =====================================================

    if (currentPlan.type === "FREE") {
      const pendingSubscription =
        await prisma.subscription.create({
          data: {
            tenantId,
            planId: newPlan.planId,
            billingCycle: newPlan.billingCycle,
            status: "PENDING",
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

            customer_notify: true,

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
            "Subscription created. Complete payment and AutoPay authorization.",

          razorpay: {
            keyId: config.razorpay.keyId,
            subscriptionId:
              razorpaySubscription.id,
          },

          subscription: {
            subscriptionId:
              pendingSubscription.subscriptionId,
            status: "PENDING",
          },

          plan: {
            planId: newPlan.planId,
            name: newPlan.name,
            price: Number(newPlan.price),
            billingCycle: newPlan.billingCycle,
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

    // =====================================================
    // PAID → PAID
    // =====================================================

    if (currentPlan.type === "PAID") {
      // ---------------------------------------------------
      // ALLOWED:
      // MONTHLY → MONTHLY
      // MONTHLY → YEARLY
      // YEARLY  → YEARLY
      // ---------------------------------------------------

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

      // ---------------------------------------------------
      // CURRENT PLAN DATES
      // ---------------------------------------------------

      const startDate =
        new Date(currentSubscription.startDate);

      const endDate =
        new Date(currentSubscription.endDate);

      const now = new Date();

      // ---------------------------------------------------
      // TOTAL DAYS
      // ---------------------------------------------------

      const totalMilliseconds =
        endDate.getTime() -
        startDate.getTime();

      const totalDays =
        totalMilliseconds /
        (1000 * 60 * 60 * 24);

      if (totalDays <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid current subscription dates",
        });
      }

      // ---------------------------------------------------
      // USED DAYS
      // ---------------------------------------------------

      const usedMilliseconds =
        now.getTime() -
        startDate.getTime();

      const usedDays = Math.max(
        0,
        Math.min(
          totalDays,
          usedMilliseconds /
            (1000 * 60 * 60 * 24)
        )
      );

      // ---------------------------------------------------
      // OLD PLAN PRICE
      // ---------------------------------------------------

      const oldPlanPrice =
        Number(currentSubscription.planPrice);

      // ---------------------------------------------------
      // USED AMOUNT
      // ---------------------------------------------------

      const usedAmount =
        (oldPlanPrice / totalDays) *
        usedDays;

      // ---------------------------------------------------
      // NEW PLAN PRICE
      // ---------------------------------------------------

      const newPlanPrice =
        Number(newPlan.price);

      // ---------------------------------------------------
      // UPGRADE AMOUNT
      // ---------------------------------------------------

      const upgradeAmount =
        newPlanPrice - usedAmount;

      if (upgradeAmount <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "No upgrade payment is required",
        });
      }

      const upgradeAmountPaise =
        Math.round(upgradeAmount * 100);

      // ---------------------------------------------------
      // CREATE LOCAL PENDING SUBSCRIPTION
      // ---------------------------------------------------

      const pendingSubscription =
        await prisma.subscription.create({
          data: {
            tenantId,

            planId:
              newPlan.planId,

            billingCycle:
              newPlan.billingCycle,

            status:
              "PENDING",

            planPrice:
              newPlan.price,

            startDate:
              new Date(),

            endDate:
              new Date(),
          },
        });

      try {
        // -------------------------------------------------
        // CREATE RAZORPAY SUBSCRIPTION
        // -------------------------------------------------

        const razorpaySubscription =
          await razorpay.subscriptions.create({
            plan_id:
              newPlan.razorpayPlanId,

            quantity: 1,

            customer_notify: true,

            total_count:
              newPlan.billingCycle === "MONTHLY"
                ? 120
                : 10,

            // ---------------------------------------------
            // UPGRADE AMOUNT
            // ---------------------------------------------

            addons: [
              {
                item: {
                  name:
                    "Plan Upgrade Payment",

                  amount:
                    upgradeAmountPaise,

                  currency:
                    "INR",
                },
              },
            ],

            // ---------------------------------------------
            // IMPORTANT NOTES
            // ---------------------------------------------

            notes: {
              type:
                "PAID_TO_PAID",

              tenantId,

              oldSubscriptionId:
                currentSubscription.subscriptionId,

              oldPlanId:
                currentPlan.planId,

              newPlanId:
                newPlan.planId,

              upgradeAmount:
                String(
                  upgradeAmount.toFixed(2)
                ),

              usedAmount:
                String(
                  usedAmount.toFixed(2)
                ),
            },
          });

        // -------------------------------------------------
        // SAVE RAZORPAY SUBSCRIPTION ID
        // -------------------------------------------------

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

        // -------------------------------------------------
        // RETURN TO FRONTEND
        // -------------------------------------------------

        return res.status(201).json({
          success: true,

          message:
            "Upgrade subscription created. Complete payment and AutoPay authorization.",

          razorpay: {
            keyId:
              config.razorpay.keyId,

            subscriptionId:
              razorpaySubscription.id,
          },

          subscription: {
            subscriptionId:
              pendingSubscription.subscriptionId,

            status:
              "PENDING",
          },

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
            totalDays:
              Number(
                totalDays.toFixed(2)
              ),

            usedDays:
              Number(
                usedDays.toFixed(2)
              ),

            oldPlanPrice,

            usedAmount:
              Number(
                usedAmount.toFixed(2)
              ),

            upgradeAmount:
              Number(
                upgradeAmount.toFixed(2)
              ),

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
      message: "Invalid current plan",
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
    // =====================================================
    // 1. VERIFY WEBHOOK SIGNATURE
    // =====================================================

    const signature =
      req.headers["x-razorpay-signature"];

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          config.razorpay.keySecret
        )
        .update(req.body)
        .digest("hex");

    if (signature !== expectedSignature) {
      console.log(
        "❌ Invalid Razorpay webhook signature"
      );

      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // =====================================================
    // 2. PARSE WEBHOOK
    // =====================================================

    const body =
      JSON.parse(req.body.toString());

    const event =
      body.event;

    console.log(
      "Razorpay Event:",
      event
    );

    // =====================================================
    // 3. SUBSCRIPTION AUTHENTICATED
    // =====================================================

    if (
      event ===
      "subscription.authenticated"
    ) {
      const razorpaySubscription =
        body.payload.subscription.entity;

      const razorpayPayment =
        body.payload.payment?.entity;

      const razorpaySubscriptionId =
        razorpaySubscription.id;

      const notes =
        razorpaySubscription.notes || {};

      const type =
        notes.type;

      const tenantId =
        notes.tenantId;

      // ---------------------------------------------------
      // IGNORE OTHER SUBSCRIPTIONS
      // ---------------------------------------------------

      if (
        type !== "FREE_TO_PAID" &&
        type !== "PAID_TO_PAID"
      ) {
        return res.status(200).json({
          success: true,
          message:
            "Subscription ignored",
        });
      }

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message:
            "tenantId missing in Razorpay notes",
        });
      }

      // ---------------------------------------------------
      // FIND LOCAL PENDING SUBSCRIPTION
      // ---------------------------------------------------

      const pendingSubscription =
        await prisma.subscription.findFirst({
          where: {
            tenantId,

            razorpaySubscriptionId,

            status: "PENDING",
          },

          include: {
            plan: true,
          },
        });

      if (!pendingSubscription) {
        return res.status(200).json({
          success: true,
          message:
            "Subscription already processed",
        });
      }

      // ===================================================
      // PAID → PAID
      // ===================================================

      if (
        type === "PAID_TO_PAID"
      ) {
        const oldSubscription =
          await prisma.subscription.findUnique({
            where: {
              subscriptionId:
                notes.oldSubscriptionId,
            },

            include: {
              plan: true,
            },
          });

        if (!oldSubscription) {
          return res.status(400).json({
            success: false,
            message:
              "Old subscription not found",
          });
        }

        // -------------------------------------------------
        // PAYMENT RECORD
        // -------------------------------------------------

        if (razorpayPayment) {
          const existingPayment =
            await prisma.payment.findFirst({
              where: {
                razorpayPaymentId:
                  razorpayPayment.id,
              },
            });

          if (!existingPayment) {
            await prisma.payment.create({
              data: {
                tenantId,

                subscriptionId:
                  pendingSubscription.subscriptionId,

                amount:
                  String(
                    razorpayPayment.amount /
                      100
                  ),

                currency:
                  razorpayPayment.currency ||
                  "INR",

                status:
                  "SUCCESS",

                razorpayPaymentId:
                  razorpayPayment.id,

                razorpaySubscriptionId:
                  razorpaySubscriptionId,

                paidAt:
                  new Date(),
              },
            });
          }
        }

        // -------------------------------------------------
        // NEW SUBSCRIPTION DATES
        // -------------------------------------------------

        const startDate =
          razorpaySubscription.current_start
            ? new Date(
                razorpaySubscription.current_start *
                  1000
              )
            : new Date();

        const endDate =
          razorpaySubscription.current_end
            ? new Date(
                razorpaySubscription.current_end *
                  1000
              )
            : new Date(
                pendingSubscription.endDate
              );

        // -------------------------------------------------
        // ACTIVATE NEW + CANCEL OLD
        // -------------------------------------------------

        await prisma.$transaction([
          prisma.subscription.update({
            where: {
              subscriptionId:
                pendingSubscription.subscriptionId,
            },

            data: {
              status:
                "ACTIVE",

              startDate,

              endDate,

              razorpayCustomerId:
                razorpaySubscription.customer_id ||
                null,
            },
          }),

          prisma.subscription.update({
            where: {
              subscriptionId:
                oldSubscription.subscriptionId,
            },

            data: {
              status:
                "CANCELLED",

              endDate:
                new Date(),
            },
          }),
        ]);

        // -------------------------------------------------
        // CANCEL OLD RAZORPAY SUBSCRIPTION
        // -------------------------------------------------

        if (
          oldSubscription.razorpaySubscriptionId
        ) {
          try {
            await razorpay.subscriptions.cancel(
              oldSubscription.razorpaySubscriptionId,
              true
            );
          } catch (error) {
            console.error(
              "Old Razorpay subscription cancellation error:",
              error
            );
          }
        }

        console.log(
          "✅ PAID → PAID UPGRADE COMPLETED"
        );

        return res.status(200).json({
          success: true,
          message:
            "Plan upgraded successfully",
        });
      }

      // ===================================================
      // FREE → PAID
      // ===================================================

      if (
        type === "FREE_TO_PAID"
      ) {
        const startDate =
          razorpaySubscription.current_start
            ? new Date(
                razorpaySubscription.current_start *
                  1000
              )
            : new Date();

        const endDate =
          razorpaySubscription.current_end
            ? new Date(
                razorpaySubscription.current_end *
                  1000
              )
            : new Date(
                pendingSubscription.endDate
              );

        // -------------------------------------------------
        // PAYMENT
        // -------------------------------------------------

        if (razorpayPayment) {
          const existingPayment =
            await prisma.payment.findFirst({
              where: {
                razorpayPaymentId:
                  razorpayPayment.id,
              },
            });

          if (!existingPayment) {
            await prisma.payment.create({
              data: {
                tenantId,

                subscriptionId:
                  pendingSubscription.subscriptionId,

                amount:
                  String(
                    razorpayPayment.amount /
                      100
                  ),

                currency:
                  razorpayPayment.currency ||
                  "INR",

                status:
                  "SUCCESS",

                razorpayPaymentId:
                  razorpayPayment.id,

                razorpaySubscriptionId:
                  razorpaySubscriptionId,

                paidAt:
                  new Date(),
              },
            });
          }
        }

        // -------------------------------------------------
        // ACTIVATE SUBSCRIPTION
        // -------------------------------------------------

        await prisma.subscription.update({
          where: {
            subscriptionId:
              pendingSubscription.subscriptionId,
          },

          data: {
            status:
              "ACTIVE",

            startDate,

            endDate,

            razorpayCustomerId:
              razorpaySubscription.customer_id ||
              null,
          },
        });

        console.log(
          "✅ FREE → PAID ACTIVATED"
        );

        return res.status(200).json({
          success: true,
          message:
            "Subscription activated successfully",
        });
      }
    }

    // =====================================================
    // SUBSCRIPTION ACTIVATED
    // =====================================================

    if (
      event ===
      "subscription.activated"
    ) {
      const razorpaySubscription =
        body.payload.subscription.entity;

      const localSubscription =
        await prisma.subscription.findFirst({
          where: {
            razorpaySubscriptionId:
              razorpaySubscription.id,
          },
        });

      if (!localSubscription) {
        return res.status(200).json({
          success: true,
          message:
            "Local subscription not found",
        });
      }

      // ---------------------------------------------------
      // DON'T CHANGE CANCELLED SUBSCRIPTIONS
      // ---------------------------------------------------

      if (
        localSubscription.status ===
        "CANCELLED"
      ) {
        return res.status(200).json({
          success: true,
          message:
            "Subscription already cancelled",
        });
      }

      await prisma.subscription.update({
        where: {
          subscriptionId:
            localSubscription.subscriptionId,
        },

        data: {
          status:
            "ACTIVE",

          razorpayCustomerId:
            razorpaySubscription.customer_id ||
            null,

          startDate:
            razorpaySubscription.current_start
              ? new Date(
                  razorpaySubscription.current_start *
                    1000
                )
              : localSubscription.startDate,

          endDate:
            razorpaySubscription.current_end
              ? new Date(
                  razorpaySubscription.current_end *
                    1000
                )
              : localSubscription.endDate,
        },
      });

      return res.status(200).json({
        success: true,
      });
    }

    // =====================================================
    // SUBSCRIPTION CHARGED
    // =====================================================

    if (
      event ===
      "subscription.charged"
    ) {
      const razorpaySubscription =
        body.payload.subscription.entity;

      const razorpayPayment =
        body.payload.payment?.entity;

      const localSubscription =
        await prisma.subscription.findFirst({
          where: {
            razorpaySubscriptionId:
              razorpaySubscription.id,
          },
        });

      if (
        localSubscription &&
        razorpayPayment
      ) {
        const existingPayment =
          await prisma.payment.findFirst({
            where: {
              razorpayPaymentId:
                razorpayPayment.id,
            },
          });

        if (!existingPayment) {
          await prisma.payment.create({
            data: {
              tenantId:
                localSubscription.tenantId,

              subscriptionId:
                localSubscription.subscriptionId,

              amount:
                String(
                  razorpayPayment.amount /
                    100
                ),

              currency:
                razorpayPayment.currency ||
                "INR",

              status:
                "SUCCESS",

              razorpayPaymentId:
                razorpayPayment.id,

              razorpaySubscriptionId:
                razorpaySubscription.id,

              paidAt:
                new Date(),
            },
          });
        }
      }

      return res.status(200).json({
        success: true,
      });
    }

    // =====================================================
    // OTHER EVENTS
    // =====================================================

    return res.status(200).json({
      success: true,
      message:
        "Webhook received",
    });
  } catch (error) {
    console.error(
      "RAZORPAY WEBHOOK ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Webhook processing failed",
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