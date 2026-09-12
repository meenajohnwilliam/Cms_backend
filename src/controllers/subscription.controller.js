// controllers/subscription.controller.js

const prisma = require("../config/prisma");
const crypto = require("crypto");
const config = require("../config/config");
const { razorpay } = require("../utils/services/razorpay.service");





const upgradeSubscription = async (req, res) => {
  try {
    const { planId } = req.body;
    const { tenantId } = req.user;

    // =====================================================
    // 1. VALIDATION
    // =====================================================

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

    // =====================================================
    // 2. CURRENT ACTIVE SUBSCRIPTION
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

    const currentPlan = currentSubscription.plan;

    // =====================================================
    // 3. GET NEW PLAN
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

    // =====================================================
    // 4. SAME PLAN CHECK
    // =====================================================

    if (currentPlan.planId === newPlan.planId) {
      return res.status(400).json({
        success: false,
        message: "You are already using this plan",
      });
    }

    console.log("==============================================");
    console.log("SUBSCRIPTION UPGRADE");
    console.log("==============================================");
    console.log("Tenant ID:", tenantId);
    console.log("Current Plan:", currentPlan.name);
    console.log("Current Price:", currentPlan.price);
    console.log("New Plan:", newPlan.name);
    console.log("New Price:", newPlan.price);
    console.log("Billing Cycle:", newPlan.billingCycle);

    // =====================================================
    // 5. FREE → PAID
    // =====================================================

    if (currentPlan.type === "FREE") {
      // ---------------------------------------------------
      // Check existing pending subscription
      // ---------------------------------------------------

      const existingPending =
        await prisma.subscription.findFirst({
          where: {
            tenantId,
            status: "PENDING",
            planId: newPlan.planId,
            createdAt: {
              gte: new Date(
                Date.now() - 15 * 60 * 1000
              ),
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

      if (existingPending?.razorpaySubscriptionId) {
        return res.status(200).json({
          success: true,
          message:
            "Existing subscription found. Please complete AutoPay authorization.",

          currentPlan: {
            planId: currentPlan.planId,
            name: currentPlan.name,
            type: currentPlan.type,
          },

          newPlan: {
            planId: newPlan.planId,
            name: newPlan.name,
            price: Number(newPlan.price),
            billingCycle: newPlan.billingCycle,
          },

          subscription: {
            subscriptionId:
              existingPending.subscriptionId,
            status: existingPending.status,
          },

          razorpay: {
            keyId: config.razorpay.keyId,
            subscriptionId:
              existingPending.razorpaySubscriptionId,
          },
        });
      }

      // ---------------------------------------------------
      // Create local pending subscription
      // ---------------------------------------------------

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
        // -------------------------------------------------
        // Create Razorpay subscription
        // -------------------------------------------------

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
              tenantId,
              subscriptionId:
                pendingSubscription.subscriptionId,
              planId: newPlan.planId,
              type: "NEW_SUBSCRIPTION",
            },
          });

        // -------------------------------------------------
        // Save Razorpay subscription ID
        // -------------------------------------------------

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
            "Subscription created. Please complete AutoPay authorization.",

          currentPlan: {
            planId: currentPlan.planId,
            name: currentPlan.name,
            type: currentPlan.type,
          },

          newPlan: {
            planId: newPlan.planId,
            name: newPlan.name,
            price: Number(newPlan.price),
            billingCycle: newPlan.billingCycle,
          },

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
        console.error(
          "Razorpay FREE → PAID error:",
          error
        );

        await prisma.subscription
          .delete({
            where: {
              subscriptionId:
                pendingSubscription.subscriptionId,
            },
          })
          .catch(() => {});

        return res.status(502).json({
          success: false,
          message:
            "Unable to create subscription with Razorpay",
        });
      }
    }

    // =====================================================
    // 6. PAID → PAID
    // =====================================================

    if (currentPlan.type === "PAID") {
      // ---------------------------------------------------
      // New plan should cost more
      // ---------------------------------------------------
    
      const oldPrice = Number(currentPlan.price);
      const newPrice = Number(newPlan.price);
    
      if (
        !Number.isFinite(oldPrice) ||
        !Number.isFinite(newPrice)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid plan price",
        });
      }
    
      if (newPrice <= oldPrice) {
        return res.status(400).json({
          success: false,
          message:
            "Selected plan must be higher than the current plan",
        });
      }
    
      // ---------------------------------------------------
      // Check existing pending upgrade
      // ---------------------------------------------------
    
      const existingPending =
        await prisma.subscription.findFirst({
          where: {
            tenantId,
            status: "PENDING",
            planId: newPlan.planId,
            createdAt: {
              gte: new Date(
                Date.now() - 15 * 60 * 1000
              ),
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });
    
      if (existingPending?.razorpaySubscriptionId) {
        return res.status(200).json({
          success: true,
          message:
            "Existing upgrade found. Please complete AutoPay authorization.",
    
          subscription: {
            subscriptionId:
              existingPending.subscriptionId,
            status: existingPending.status,
          },
    
          razorpay: {
            keyId: config.razorpay.keyId,
            subscriptionId:
              existingPending.razorpaySubscriptionId,
          },
        });
      }
    
      // ---------------------------------------------------
      // Current subscription dates
      // ---------------------------------------------------
    
      const startDate = new Date(
        currentSubscription.startDate
      );
    
      const endDate = new Date(
        currentSubscription.endDate
      );
    
      const now = new Date();
    
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid current subscription dates",
        });
      }
    
      // ---------------------------------------------------
      // Current subscription must not already be expired
      // ---------------------------------------------------
    
      if (endDate <= now) {
        return res.status(400).json({
          success: false,
          message:
            "Current subscription has already expired",
        });
      }
    
      // ---------------------------------------------------
      // Total days of CURRENT plan
      // ---------------------------------------------------
    
      const totalDays =
        currentPlan.billingCycle === "YEARLY"
          ? 365
          : 30;
    
      // ---------------------------------------------------
      // Used days
      // ---------------------------------------------------
    
      const usedDays = Math.min(
        totalDays,
        Math.max(
          0,
          Math.floor(
            (now.getTime() - startDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      );
    
      // ---------------------------------------------------
      // Used amount
      // ---------------------------------------------------
    
      const usedAmount =
        (oldPrice / totalDays) * usedDays;
    
      // ---------------------------------------------------
      // Remaining amount
      // ---------------------------------------------------
    
      const remainingAmount = Math.max(
        0,
        oldPrice - usedAmount
      );
    
      // ---------------------------------------------------
      // Upgrade amount
      // ---------------------------------------------------
    
      const upgradeAmount = Math.max(
        0,
        newPrice - remainingAmount
      );
    
      console.log("----------------------------------------------");
      console.log("PAID → PAID CALCULATION");
      console.log("----------------------------------------------");
      console.log("Old Price:", oldPrice);
      console.log("New Price:", newPrice);
      console.log("Used Days:", usedDays);
      console.log(
        "Used Amount:",
        Number(usedAmount.toFixed(2))
      );
      console.log(
        "Remaining Amount:",
        Number(remainingAmount.toFixed(2))
      );
      console.log(
        "Upgrade Amount:",
        Number(upgradeAmount.toFixed(2))
      );
      console.log(
        "Current Plan End Date:",
        endDate
      );


        // 10. CREATE LOCAL PENDING SUBSCRIPTION
  // ---------------------------------------------------

 

  // New subscription END date depends on NEW plan
  const newEndDate = new Date(endDate);

  if (newPlan.billingCycle === "MONTHLY") {
    newEndDate.setMonth(
      newEndDate.getMonth() + 1
    );
  } else if (
    newPlan.billingCycle === "YEARLY"
  ) {
    newEndDate.setFullYear(
      newEndDate.getFullYear() + 1
    );
  } else {
    return res.status(400).json({
      success: false,
      message:
        "Invalid new plan billing cycle",
    });
  }

  // ---------------------------------------------------
  // 11. START AT
  //
  // IMPORTANT:
  //
  // Current MONTHLY:
  //     current endDate = next month
  //
  // Current YEARLY:
  //     current endDate = next year
  //
  // New subscription starts at current endDate.
  // ---------------------------------------------------

  const startAt = Math.floor(
    endDate.getTime() / 1000
  );

  // ---------------------------------------------------
  // 12. START DATE LOG
  // ---------------------------------------------------

  console.log(
    "=============================================="
  );

  console.log(
    "START DATE CHECK"
  );

  console.log(
    "=============================================="
  );

  console.log(
    "Current Plan:",
    currentPlan.name
  );

  console.log(
    "Current Billing Cycle:",
    currentPlan.billingCycle
  );

  console.log(
    "Current Subscription Start:",
    startDate.toISOString()
  );

  console.log(
    "Current Subscription End:",
    endDate.toISOString()
  );

  console.log(
    "New Subscription Start:",
    endDate.toISOString()
  );

  console.log(
    "New Subscription End:",
    newEndDate.toISOString()
  );

  console.log(
    "Razorpay startAt:",
    startAt
  );

  console.log(
    "Razorpay startAt Date:",
    new Date(
      startAt * 1000
    ).toISOString()
  );

  console.log(
    "New Plan:",
    newPlan.name
  );

  console.log(
    "New Billing Cycle:",
    newPlan.billingCycle
  );
    
      // ---------------------------------------------------
      // Create local pending subscription
      // ---------------------------------------------------
    
      const pendingSubscription =
        await prisma.subscription.create({
          data: {
            tenantId,
            planId: newPlan.planId,
            status: "PENDING",
            billingCycle: newPlan.billingCycle,
            planPrice: newPlan.price,
    
            // Local subscription starts after
            // current subscription finishes
            startDate: endDate,
            endDate: newEndDate,
          },
        });
    
      try {
        // -------------------------------------------------
        // Razorpay uses PAISE
        // ₹5,841 = 584100 paise
        // -------------------------------------------------
    
        const upgradeAmountPaise = Math.round(
          upgradeAmount * 100
        );
    
        // -------------------------------------------------
        // IMPORTANT
        //
        // Subscription starts at current plan END DATE.
        //
        // Therefore:
        //
        // NOW:
        // addon = upgradeAmount
        //
        // FUTURE:
        // newPlan.price
        // -------------------------------------------------

        // -------------------------------------------------
        // Razorpay subscription
        // -------------------------------------------------
    
        const razorpayData = {
          plan_id: newPlan.razorpayPlanId,
    
          quantity: 1,
    
          customer_notify: true,
    
          total_count:
            newPlan.billingCycle === "MONTHLY"
              ? 120
              : 10,
    
          // IMPORTANT
          // New plan will start only after
          // current plan ends.
          start_at: startAt,
    
          notes: {
            tenantId,
    
            subscriptionId:
              pendingSubscription.subscriptionId,
    
            planId: newPlan.planId,
    
            oldPlanId: currentPlan.planId,
    
            type: "PLAN_UPGRADE",
          },
        };
    
        // -------------------------------------------------
        // ONLY UPGRADE AMOUNT IS CHARGED NOW
        // -------------------------------------------------
    
        if (upgradeAmountPaise > 0) {
          razorpayData.addons = [
            {
              item: {
                name: "Plan Upgrade",
                amount: upgradeAmountPaise,
                currency: "INR",
              },
            },
          ];
        }
    
        console.log("----------------------------------------------");
        console.log("RAZORPAY SUBSCRIPTION");
        console.log("----------------------------------------------");
        console.log(
          "Upgrade Amount:",
          upgradeAmount
        );
        console.log(
          "Upgrade Amount Paise:",
          upgradeAmountPaise
        );
        console.log(
          "Subscription Start At:",
          startAt
        );
        console.log(
          "Subscription Start Date:",
          endDate
        );


        
    
        // -------------------------------------------------
        // CREATE RAZORPAY SUBSCRIPTION
        // -------------------------------------------------
    
        const razorpaySubscription =
          await razorpay.subscriptions.create(
            razorpayData
          );
    
        // -------------------------------------------------
        // Save Razorpay subscription ID
        // -------------------------------------------------
    
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
    
        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------
    
        return res.status(201).json({
          success: true,
    
          message:
            "Upgrade subscription created. Please complete AutoPay authorization.",
    
          currentPlan: {
            planId: currentPlan.planId,
            name: currentPlan.name,
            price: oldPrice,
            billingCycle:
              currentPlan.billingCycle,
          },
    
          newPlan: {
            planId: newPlan.planId,
            name: newPlan.name,
            price: newPrice,
            billingCycle:
              newPlan.billingCycle,
          },
    
          calculation: {
            usedDays,
    
            usedAmount: Number(
              usedAmount.toFixed(2)
            ),
    
            remainingAmount: Number(
              remainingAmount.toFixed(2)
            ),
    
            upgradeAmount: Number(
              upgradeAmount.toFixed(2)
            ),
          },
    
          subscription: {
            subscriptionId:
              updatedSubscription.subscriptionId,
    
            status:
              updatedSubscription.status,
    
            startDate: endDate,
          },
    
          razorpay: {
            keyId: config.razorpay.keyId,
    
            subscriptionId:
              razorpaySubscription.id,
    
            startAt,
          },
        });
      } catch (error) {
        console.error(
          "Razorpay PAID → PAID error:",
          error
        );
    
        // -------------------------------------------------
        // Delete failed pending subscription
        // -------------------------------------------------
    
        await prisma.subscription
          .delete({
            where: {
              subscriptionId:
                pendingSubscription.subscriptionId,
            },
          })
          .catch((deleteError) => {
            console.error(
              "Failed to delete pending subscription:",
              deleteError
            );
          });
    
        return res.status(502).json({
          success: false,
          message:
            "Unable to create upgrade subscription",
        });
      }
    }

    // =====================================================
    // 7. UNKNOWN TYPE
    // =====================================================

    return res.status(400).json({
      success: false,
      message:
        "Unsupported current subscription type",
    });
  } catch (error) {
    console.error(
      "❌ Upgrade subscription error:",
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

    console.log(subscriptionData,"joooko")

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

    if (event === "subscription.authenticated") {
      // const startDate = new Date(
      //   subscriptionData.current_start * 1000
      // );
    
      // const endDate = new Date(
      //   subscriptionData.current_end * 1000
      // );
    
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
          // startDate,
          // endDate,
        },
      });
    }

    // 3. Subscription Activated
    if (event === "subscription.activated") {
      // const startDate = new Date(
      //   subscriptionData.current_start * 1000
      // );

      // const endDate = new Date(
      //   subscriptionData.current_end * 1000
      // );

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
          // startDate,
          // endDate,
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