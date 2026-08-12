// controllers/subscription.controller.js

const prisma = require("../config/prisma");
const crypto = require("crypto");
const config = require("../config/config");


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

module.exports = {
  getCurrentSubscription,
  getAvailablePlans,
  razorpayWebhook
};