// controllers/subscription.controller.js

const prisma = require("../config/prisma");
const crypto = require("crypto");
const config = require("../config/config");
const { razorpay } = require("../utils/services/razorpay.service");



const getCurrentSubscription = async (req, res) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const subscription =
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

        billingCycle:
          subscription.billingCycle,

        status:
          subscription.status,

        startDate:
          subscription.startDate,

        endDate:
          subscription.endDate,

        plan: {
          planId:
            subscription.plan.planId,

          name:
            subscription.plan.name,

          monthlyPrice:
            subscription.plan.monthlyPrice,

          yearlyPrice:
            subscription.plan.yearlyPrice,

          projectLimit:
            subscription.plan.projectLimit,

          collectionLimit:
            subscription.plan.collectionLimit,

          apiKeyLimit:
            subscription.plan.apiKeyLimit,

          teamMemberLimit:
            subscription.plan.teamMemberLimit,

          storageLimit:
            subscription.plan.storageLimit,

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
    const plans =
      await prisma.plan.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          displayOrder: "asc",
        },
      });

    return res.status(200).json({
      success: true,
      count: plans.length,
      plans,
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



const razorpayWebhook = async (req, res) => {
    try {
      const signature =
        req.headers["x-razorpay-signature"];
  
      if (!signature) {
        return res.status(400).json({
          success: false,
          message: "Razorpay signature missing",
        });
      }
  
      if (!Buffer.isBuffer(req.body)) {
        return res.status(400).json({
          success: false,
          message: "Raw webhook body is required",
        });
      }
  
      // ==========================================
      // VERIFY WEBHOOK SIGNATURE
      // ==========================================
  
      const expectedSignature =
        crypto
          .createHmac(
            "sha256",
            config.razorpay.webhookSecret
          )
          .update(req.body)
          .digest("hex");
  
      const receivedSignature =
        Buffer.from(signature, "utf8");
  
      const expectedSignatureBuffer =
        Buffer.from(
          expectedSignature,
          "utf8"
        );
  
      if (
        receivedSignature.length !==
        expectedSignatureBuffer.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Razorpay webhook signature",
        });
      }
  
      const isValid =
        crypto.timingSafeEqual(
          receivedSignature,
          expectedSignatureBuffer
        );
  
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Razorpay webhook signature",
        });
      }
  
      // ==========================================
      // PARSE RAW BODY
      // ==========================================
  
      const payload = JSON.parse(
        req.body.toString("utf8")
      );
  
      const event = payload.event;
  
      const subscriptionEntity =
        payload.payload?.subscription?.entity;
  
      const paymentEntity =
        payload.payload?.payment?.entity;
  
      const razorpaySubscriptionId =
        subscriptionEntity?.id;
  
      console.log(
        "Razorpay Webhook:",
        event
      );
  
      // ==========================================
      // SUBSCRIPTION AUTHENTICATED
      // ==========================================
  
      if (
        event ===
        "subscription.authenticated"
      ) {
        if (!razorpaySubscriptionId) {
          return res.status(200).json({
            success: true,
            message: "Webhook received",
          });
        }
  
        const subscription =
          await prisma.subscription.findUnique({
            where: {
              razorpaySubscriptionId,
            },
          });
  
        if (subscription) {
          await prisma.subscription.update({
            where: {
              subscriptionId:
                subscription.subscriptionId,
            },
            data: {
              status: "ACTIVE",
            },
          });
        }
      }
  
      // ==========================================
      // SUBSCRIPTION ACTIVATED
      // ==========================================
  
      else if (
        event ===
        "subscription.activated"
      ) {
        if (!razorpaySubscriptionId) {
          return res.status(200).json({
            success: true,
            message: "Webhook received",
          });
        }
  
        const subscription =
          await prisma.subscription.findUnique({
            where: {
              razorpaySubscriptionId,
            },
          });
  
        if (subscription) {
          await prisma.subscription.update({
            where: {
              subscriptionId:
                subscription.subscriptionId,
            },
            data: {
              status: "ACTIVE",
            },
          });
        }
      }
  
      // ==========================================
      // SUBSCRIPTION CHARGED
      // ==========================================
  
      else if (
        event ===
        "subscription.charged"
      ) {
        if (!razorpaySubscriptionId) {
          return res.status(200).json({
            success: true,
            message: "Webhook received",
          });
        }
  
        const subscription =
          await prisma.subscription.findUnique({
            where: {
              razorpaySubscriptionId,
            },
          });
  
        if (!subscription) {
          return res.status(200).json({
            success: true,
            message:
              "Subscription not found",
          });
        }
  
        const startDate = new Date();
  
        const endDate = new Date(
          startDate
        );
  
        if (
          subscription.billingCycle ===
          "MONTHLY"
        ) {
          endDate.setMonth(
            endDate.getMonth() + 1
          );
        } else {
          endDate.setFullYear(
            endDate.getFullYear() + 1
          );
        }
  
        await prisma.subscription.update({
          where: {
            subscriptionId:
              subscription.subscriptionId,
          },
          data: {
            status: "ACTIVE",
            startDate,
            endDate,
          },
        });
  
        // ========================================
        // SAVE PAYMENT
        // ========================================
  
        if (paymentEntity?.id) {
          const existingPayment =
            await prisma.payment.findUnique({
              where: {
                razorpayPaymentId:
                  paymentEntity.id,
              },
            });
  
          if (existingPayment) {
            await prisma.payment.update({
              where: {
                paymentId:
                  existingPayment.paymentId,
              },
              data: {
                status: "SUCCESS",
                paidAt: new Date(),
                razorpaySubscriptionId,
              },
            });
          } else {
            await prisma.payment.create({
              data: {
                tenantId:
                  subscription.tenantId,
  
                subscriptionId:
                  subscription.subscriptionId,
  
                amount: String(
                  paymentEntity.amount / 100
                ),
  
                currency:
                  paymentEntity.currency ||
                  "INR",
  
                status: "SUCCESS",
  
                razorpayPaymentId:
                  paymentEntity.id,
  
                razorpaySubscriptionId,
  
                paidAt: new Date(),
              },
            });
          }
        }
      }
  
      // ==========================================
      // SUBSCRIPTION PENDING
      // ==========================================
  
      else if (
        event ===
        "subscription.pending"
      ) {
        if (razorpaySubscriptionId) {
          const subscription =
            await prisma.subscription.findUnique({
              where: {
                razorpaySubscriptionId,
              },
            });
  
          if (subscription) {
            await prisma.subscription.update({
              where: {
                subscriptionId:
                  subscription.subscriptionId,
              },
              data: {
                status: "PAST_DUE",
              },
            });
          }
        }
      }
  
      // ==========================================
      // SUBSCRIPTION HALTED
      // ==========================================
  
      else if (
        event ===
        "subscription.halted"
      ) {
        if (razorpaySubscriptionId) {
          const subscription =
            await prisma.subscription.findUnique({
              where: {
                razorpaySubscriptionId,
              },
            });
  
          if (subscription) {
            await prisma.subscription.update({
              where: {
                subscriptionId:
                  subscription.subscriptionId,
              },
              data: {
                status: "SUSPENDED",
              },
            });
          }
        }
      }
  
      // ==========================================
      // SUBSCRIPTION CANCELLED
      // ==========================================
  
      else if (
        event ===
        "subscription.cancelled"
      ) {
        if (razorpaySubscriptionId) {
          const subscription =
            await prisma.subscription.findUnique({
              where: {
                razorpaySubscriptionId,
              },
            });
  
          if (subscription) {
            await prisma.subscription.update({
              where: {
                subscriptionId:
                  subscription.subscriptionId,
              },
              data: {
                status: "CANCELLED",
              },
            });
          }
        }
      }
  
      // ==========================================
      // SUBSCRIPTION COMPLETED
      // ==========================================
  
      else if (
        event ===
        "subscription.completed"
      ) {
        if (razorpaySubscriptionId) {
          const subscription =
            await prisma.subscription.findUnique({
              where: {
                razorpaySubscriptionId,
              },
            });
  
          if (subscription) {
            await prisma.subscription.update({
              where: {
                subscriptionId:
                  subscription.subscriptionId,
              },
              data: {
                status: "EXPIRED",
              },
            });
          }
        }
      }
  
      return res.status(200).json({
        success: true,
        message:
          "Webhook processed successfully",
      });
    } catch (error) {
      console.error(
        "Razorpay Webhook Error:",
        error
      );
  
      return res.status(500).json({
        success: false,
        message:
          "Webhook processing failed",
      });
    }
  };




const upgradeSubscription = async (req, res) => {
  try {
    const {
      planId,
      billingCycle,
      tenantId
    } = req.body;

  

    // ------------------------------------------
    // 1. VALIDATION
    // ------------------------------------------

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "planId is required",
      });
    }

    if (
      !billingCycle ||
      !["MONTHLY", "YEARLY"].includes(
        billingCycle
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "billingCycle must be MONTHLY or YEARLY",
      });
    }

    // ------------------------------------------
    // 2. GET CURRENT SUBSCRIPTION
    // ------------------------------------------

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
        message:
          "Active subscription not found",
      });
    }

    // ------------------------------------------
    // 3. GET NEW PLAN
    // ------------------------------------------

    const newPlan =
      await prisma.plan.findUnique({
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

    // ------------------------------------------
    // 4. PREVENT SAME PLAN
    // ------------------------------------------

    if (
      currentSubscription.planId ===
        newPlan.planId &&
      currentSubscription.billingCycle ===
        billingCycle
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You are already using this plan",
      });
    }

    // ------------------------------------------
    // 5. GET PRICES
    // ------------------------------------------

    const currentPrice =
      currentSubscription.billingCycle ===
      "MONTHLY"
        ? Number(
            currentSubscription.plan
              .monthlyPrice
          )
        : Number(
            currentSubscription.plan
              .yearlyPrice
          );

    const newPrice =
      billingCycle === "MONTHLY"
        ? Number(newPlan.monthlyPrice)
        : Number(newPlan.yearlyPrice);

    // ------------------------------------------
    // 6. CHECK UPGRADE
    // ------------------------------------------

    if (newPrice <= currentPrice) {
      return res.status(400).json({
        success: false,
        message:
          "This is not an upgrade. Downgrade requires Super Admin approval.",
      });
    }

    // ------------------------------------------
    // 7. CALCULATE DIFFERENCE
    // ------------------------------------------

    const upgradeAmount =
      Number(
        (
          newPrice -
          currentPrice
        ).toFixed(2)
      );

    if (upgradeAmount <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid upgrade amount",
      });
    }

    // ------------------------------------------
    // 8. GET RAZORPAY PLAN ID
    // ------------------------------------------

    const razorpayPlanId =
      billingCycle === "MONTHLY"
        ? newPlan.razorpayMonthlyPlanId
        : newPlan.razorpayYearlyPlanId;

    if (!razorpayPlanId) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay plan is not configured",
      });
    }

    // ------------------------------------------
    // 9. CREATE RAZORPAY SUBSCRIPTION
    // ------------------------------------------

    const razorpaySubscription =
      await razorpay.subscriptions.create({
        plan_id:
          razorpayPlanId,

        quantity: 1,

        customer_notify: 1,

        total_count:
          billingCycle === "MONTHLY"
            ? 120
            : 10,

        notes: {
          tenantId,

          oldPlanId:
            currentSubscription.planId,

          newPlanId:
            newPlan.planId,

          billingCycle,

          currentPrice:
            String(currentPrice),

          newPrice:
            String(newPrice),

          upgradeAmount:
            String(upgradeAmount),
        },
      });

    // ------------------------------------------
    // 10. CREATE PAYMENT RECORD
    // ------------------------------------------

    const payment =
      await prisma.payment.create({
        data: {
          tenantId,

          subscriptionId:
            currentSubscription
              .subscriptionId,

          amount:
            String(upgradeAmount),

          currency: "INR",

          status: "PENDING",

          razorpaySubscriptionId:
            razorpaySubscription.id,
        },
      });

    // ------------------------------------------
    // 11. RESPONSE
    // ------------------------------------------

    return res.status(201).json({
      success: true,

      message:
        "Upgrade subscription created successfully",

      currentPlan: {
        planId:
          currentSubscription.planId,

        name:
          currentSubscription.plan.name,

        billingCycle:
          currentSubscription
            .billingCycle,

        price:
          currentPrice,
      },

      newPlan: {
        planId:
          newPlan.planId,

        name:
          newPlan.name,

        billingCycle,

        price:
          newPrice,
      },

      upgrade: {
        currentPrice,

        newPrice,

        amountToPay:
          upgradeAmount,
      },

      razorpay: {
        keyId:
          config.razorpay.keyId,

        subscriptionId:
          razorpaySubscription.id,

        planId:
          razorpayPlanId,
      },

      payment: {
        paymentId:
          payment.paymentId,

        amount:
          upgradeAmount,

        currency: "INR",

        status: "PENDING",
      },
    });
  } catch (error) {
    console.error(
      "Upgrade Subscription Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
};



module.exports = {
  getCurrentSubscription,
  getAvailablePlans,
  razorpayWebhook,
  upgradeSubscription,
};