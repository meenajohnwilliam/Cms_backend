const prisma = require("../config/prisma");


// ============================================================
// GET SUBSCRIPTION HISTORY
// ============================================================

const getSubscriptionHistory = async (req, res) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const subscriptions = await prisma.subscription.findMany({
      where: {
        tenantId,
        plan: {
            type: "PAID",
          },
      },

      select: {
        subscriptionId: true,

        billingCycle: true,
        status: true,
        planPrice: true,

        startDate: true,
        endDate: true,
        gracePeriodEndDate: true,

        razorpaySubscriptionId: true,

        createdAt: true,

        plan: {
          select: {
            planId: true,
            name: true,
            version: true,
            type: true,
            billingCycle: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      subscriptions,
    });

  } catch (error) {
    console.error(
      "Get Subscription History Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription history",
    });
  }
};


// ============================================================
// GET PAYMENT HISTORY
// ============================================================

const getPaymentHistory = async (req, res) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const payments = await prisma.payment.findMany({
      where: {
        tenantId,
      },

      select: {
        paymentId: true,

        amount: true,
        currency: true,
        status: true,

        razorpayPaymentId: true,
        razorpayOrderId: true,
        razorpaySubscriptionId: true,

        paidAt: true,
        createdAt: true,

        subscription: {
          select: {
            subscriptionId: true,

            billingCycle: true,
            planPrice: true,

            plan: {
              select: {
                planId: true,
                name: true,
                version: true,
                type: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      payments,
    });

  } catch (error) {
    console.error(
      "Get Payment History Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
    });
  }
};


module.exports = {
  getSubscriptionHistory,
  getPaymentHistory,
};