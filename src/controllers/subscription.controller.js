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

// const upgradeSubscription = async (req, res) => {
//   try {
//     const {
//       planId,
//       tenantId,
//     } = req.body;

//     // ======================================================
//     // 1. VALIDATION
//     // ======================================================

//     if (!tenantId) {
//       return res.status(403).json({
//         success: false,
//         message: "Tenant not found",
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

//     const currentSubscription = await prisma.subscription.findFirst({
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
//         message:
//           "Active subscription not found",
//       });
//     }

//     // ======================================================
//     // 3. GET NEW PLAN
//     // ======================================================

//     const newPlan = await prisma.plan.findUnique({
//         where: {
//           planId,
//         },
//       });

//     if (!newPlan) {
//       return res.status(404).json({
//         success: false,
//         message: "Plan not found",
//       });
//     }

//     // ======================================================
//     // 4. CHECK ACTIVE
//     // ======================================================

//     if (!newPlan.isActive) {
//       return res.status(400).json({
//         success: false,
//         message: "Plan is inactive",
//       });
//     }

//     // ======================================================
//     // 5. FREE PLAN CANNOT BE USED FOR UPGRADE
//     // ======================================================

//     if (newPlan.type !== "PAID") {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Only paid plans can be used for upgrade",
//       });
//     }

//     // ======================================================
//     // 6. GET CURRENT PLAN INFORMATION
//     // ======================================================

//     const currentPlan = currentSubscription.plan;

//     const currentPrice = Number(currentPlan.price);

//     const newPrice = Number(newPlan.price);

//     // ======================================================
//     // 7. PREVENT SAME PLAN
//     // ======================================================

//     if ( currentSubscription.planId === newPlan.planId ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "You are already using this plan",
//       });
//     }

//     // ======================================================
//     // 8. BILLING CYCLE COMES FROM PLAN
//     // ======================================================

//     const newBillingCycle =
//       newPlan.billingCycle;

//     // ======================================================
//     // 9. VALIDATE PAID BILLING CYCLE
//     // ======================================================

//     if (
//       !["MONTHLY", "YEARLY"].includes(
//         newBillingCycle
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Paid plan must have MONTHLY or YEARLY billing cycle",
//       });
//     }

//     // ======================================================
//     // 10. CHECK UPGRADE
//     // ======================================================
//     //
//     // IMPORTANT:
//     //
//     // This compares the actual selected plans.
//     //
//     // Example:
//     //
//     // Basic Monthly ₹999
//     //       ↓
//     // Basic Yearly ₹9999
//     //
//     // The yearly price is greater, but this is not
//     // necessarily a normal "upgrade" because billing
//     // cycle changed.
//     //
//     // For now your existing business rule is:
//     // higher price = upgrade.
//     //
//     // ======================================================

//     if (
//       newPrice <= currentPrice
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "This is not an upgrade. Downgrade requires Super Admin approval.",
//       });
//     }

//     // ======================================================
//     // 11. CALCULATE DIFFERENCE
//     // ======================================================

//     const upgradeAmount =
//       Number(
//         (
//           newPrice -
//           currentPrice
//         ).toFixed(2)
//       );

//     if (
//       upgradeAmount <= 0
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid upgrade amount",
//       });
//     }

//     // ======================================================
//     // 12. GET RAZORPAY PLAN ID
//     // ======================================================
//     //
//     // IMPORTANT:
//     //
//     // There is now only ONE Razorpay plan ID
//     // on each DB Plan.
//     //
//     // ======================================================

//     const razorpayPlanId =
//       newPlan.razorpayPlanId;

//     if (!razorpayPlanId) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Razorpay plan is not configured",
//       });
//     }

//     // ======================================================
//     // 13. CREATE RAZORPAY SUBSCRIPTION
//     // ======================================================

//     const razorpaySubscription =
//       await razorpay.subscriptions.create({
//         plan_id:
//           razorpayPlanId,

//         quantity: 1,

//         customer_notify: 1,

//         total_count:
//           newBillingCycle ===
//           "MONTHLY"
//             ? 120
//             : 10,

//         notes: {
//           tenantId,

//           oldPlanId:
//             currentSubscription.planId,

//           newPlanId:
//             newPlan.planId,

//           billingCycle:
//             newBillingCycle,

//           currentPrice:
//             String(currentPrice),

//           newPrice:
//             String(newPrice),

//           upgradeAmount:
//             String(upgradeAmount),
//         },
//       });

//     // ======================================================
//     // 14. CALCULATE PENDING SUBSCRIPTION DATES
//     // ======================================================

//     const pendingStartDate =
//       new Date();

//     const pendingEndDate =
//       new Date(
//         pendingStartDate
//       );

//     if (
//       newBillingCycle ===
//       "MONTHLY"
//     ) {
//       pendingEndDate.setMonth(
//         pendingEndDate.getMonth() + 1
//       );
//     } else {
//       pendingEndDate.setFullYear(
//         pendingEndDate.getFullYear() + 1
//       );
//     }

//     // ======================================================
//     // 15. CREATE NEW SUBSCRIPTION
//     // ======================================================
//     //
//     // IMPORTANT:
//     //
//     // billingCycle is NO LONGER stored here.
//     //
//     // It comes from:
//     //
//     // Subscription
//     //      ↓
//     // Plan
//     //      ↓
//     // billingCycle
//     //
//     // ======================================================

//     const pendingSubscription =
//       await prisma.subscription.create({
//         data: {
//           tenantId,

//           planId:
//             newPlan.planId,

//           status:
//             "PENDING",
//              // ADD THIS
//       billingCycle:
//       newPlan.billingCycle,


//           startDate:
//             pendingStartDate,

//           endDate:
//             pendingEndDate,

//           razorpaySubscriptionId:
//             razorpaySubscription.id,
//         },
//       });

//     // ======================================================
//     // 16. CREATE PAYMENT RECORD
//     // ======================================================

//     const payment =
//       await prisma.payment.create({
//         data: {
//           tenantId,

//           subscriptionId:
//             pendingSubscription.subscriptionId,

//           amount:
//             String(upgradeAmount),

//           currency:
//             "INR",

//           status:
//             "PENDING",

//           razorpaySubscriptionId:
//             razorpaySubscription.id,
//         },
//       });

//     // ======================================================
//     // 17. RESPONSE
//     // ======================================================

//     return res.status(201).json({
//       success: true,

//       message:
//         "Upgrade subscription created successfully",

//       currentPlan: {
//         planId:
//           currentPlan.planId,

//         name:
//           currentPlan.name,

//         type:
//           currentPlan.type,

//         billingCycle:
//           currentPlan.billingCycle,

//         price:
//           currentPrice,
//       },

//       newPlan: {
//         planId:
//           newPlan.planId,

//         name:
//           newPlan.name,

//         type:
//           newPlan.type,

//         billingCycle:
//           newPlan.billingCycle,

//         price:
//           newPrice,
//       },

//       upgrade: {
//         currentPrice,

//         newPrice,

//         amountToPay:
//           upgradeAmount,
//       },

//       razorpay: {
//         keyId:
//           config.razorpay.keyId,

//         subscriptionId:
//           razorpaySubscription.id,

//         planId:
//           razorpayPlanId,
//       },

//       payment: {
//         paymentId:
//           payment.paymentId,

//         amount:
//           upgradeAmount,

//         currency:
//           "INR",

//         status:
//           "PENDING",
//       },
//     });
//   } catch (error) {
//     console.error(
//       "Upgrade Subscription Error:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message:
//         "Internal server error",
//     });
//   }
// };

const upgradeSubscription = async (req, res) => {
  try {
    console.log("\n======================================================");
    console.log("🚀 UPGRADE SUBSCRIPTION STARTED");
    console.log("======================================================");

    const {
      planId,
      tenantId,
    } = req.body;

    // ======================================================
    // 1. REQUEST
    // ======================================================

    console.log("\n1️⃣ Request received");

    console.log("tenantId:", tenantId);
    console.log("planId:", planId);

    // ======================================================
    // 2. VALIDATION
    // ======================================================

    if (!tenantId) {
      console.log("❌ Tenant ID missing");

      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (!planId) {
      console.log("❌ Plan ID missing");

      return res.status(400).json({
        success: false,
        message: "planId is required",
      });
    }

    // ======================================================
    // 3. GET CURRENT SUBSCRIPTION
    // ======================================================

    console.log(
      "\n2️⃣ Getting current active subscription..."
    );

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
      console.log(
        "❌ Active subscription not found"
      );

      return res.status(400).json({
        success: false,
        message:
          "Active subscription not found",
      });
    }

    console.log(
      "\n3️⃣ Current subscription found"
    );

    console.log(
      "Subscription ID:",
      currentSubscription.subscriptionId
    );

    console.log(
      "Current Plan ID:",
      currentSubscription.planId
    );

    // ======================================================
    // 4. CURRENT PLAN
    // ======================================================

    const currentPlan =
      currentSubscription.plan;

    const currentLevel =
      Number(
        currentPlan.planLevel
      );

    const currentPrice =
      Number(
        currentPlan.price
      );

    console.log(
      "\n4️⃣ Current plan details"
    );

    console.log(
      "Plan name:",
      currentPlan.name
    );

    console.log(
      "Plan level:",
      currentLevel
    );

    console.log(
      "Billing cycle:",
      currentPlan.billingCycle
    );

    console.log(
      "Price:",
      currentPrice
    );

    // ======================================================
    // 5. GET NEW PLAN
    // ======================================================

    console.log(
      "\n5️⃣ Getting selected new plan..."
    );

    const newPlan =
      await prisma.plan.findUnique({
        where: {
          planId,
        },
      });

    if (!newPlan) {
      console.log(
        "❌ New plan not found"
      );

      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    const newLevel =
      Number(
        newPlan.planLevel
      );

    const newPrice =
      Number(
        newPlan.price
      );

    console.log(
      "\n6️⃣ New plan found"
    );

    console.log(
      "Plan name:",
      newPlan.name
    );

    console.log(
      "Plan level:",
      newLevel
    );

    console.log(
      "Billing cycle:",
      newPlan.billingCycle
    );

    console.log(
      "Price:",
      newPrice
    );

    // ======================================================
    // 6. CHECK ACTIVE
    // ======================================================

    if (!newPlan.isActive) {
      console.log(
        "❌ Selected plan is inactive"
      );

      return res.status(400).json({
        success: false,
        message: "Plan is inactive",
      });
    }

    console.log(
      "✅ Selected plan is active"
    );

    // ======================================================
    // 7. CHECK PAID
    // ======================================================

    if (newPlan.type !== "PAID") {
      console.log(
        "❌ Selected plan is not paid"
      );

      return res.status(400).json({
        success: false,
        message:
          "Only paid plans can be used for upgrade",
      });
    }

    console.log(
      "✅ Selected plan is PAID"
    );

    // ======================================================
    // 8. SAME PLAN
    // ======================================================

    if (
      currentPlan.planId ===
      newPlan.planId
    ) {
      console.log(
        "❌ User selected the current plan"
      );

      return res.status(400).json({
        success: false,
        message:
          "You are already using this plan",
      });
    }

    // ======================================================
    // 9. PLAN LEVEL CHECK
    // ======================================================

    console.log(
      "\n7️⃣ Checking plan level..."
    );

    console.log(
      "Current level:",
      currentLevel
    );

    console.log(
      "New level:",
      newLevel
    );

    if (
      newLevel <= currentLevel
    ) {
      console.log(
        "❌ Not an upgrade"
      );

      return res.status(400).json({
        success: false,
        message:
          "Selected plan is not an upgrade. Downgrade requires Super Admin approval.",
      });
    }

    console.log(
      `✅ Upgrade allowed: ${newLevel} > ${currentLevel}`
    );

    // ======================================================
    // 10. BILLING CYCLE
    // ======================================================

    const newBillingCycle =
      newPlan.billingCycle;

    console.log(
      "\n8️⃣ New billing cycle:",
      newBillingCycle
    );

    if (
      newBillingCycle !==
        "MONTHLY" &&
      newBillingCycle !==
        "YEARLY"
    ) {
      console.log(
        "❌ Invalid billing cycle"
      );

      return res.status(400).json({
        success: false,
        message:
          "Paid plan must have MONTHLY or YEARLY billing cycle",
      });
    }

    // ======================================================
    // 11. RAZORPAY PLAN
    // ======================================================

    console.log(
      "\n9️⃣ Checking Razorpay plan..."
    );

    const razorpayPlanId =
      newPlan.razorpayPlanId;

    console.log(
      "Razorpay Plan ID:",
      razorpayPlanId
    );

    if (!razorpayPlanId) {
      console.log(
        "❌ Razorpay plan not configured"
      );

      return res.status(400).json({
        success: false,
        message:
          "Razorpay plan is not configured",
      });
    }

    // ======================================================
    // 12. CURRENT DATES
    // ======================================================

    const startDate =
      new Date(
        currentSubscription.startDate
      );

    const endDate =
      new Date(
        currentSubscription.endDate
      );

    const now =
      new Date();

    console.log(
      "\n🔟 Current subscription dates"
    );

    console.log(
      "Start date:",
      startDate
    );

    console.log(
      "End date:",
      endDate
    );

    console.log(
      "Current date:",
      now
    );

    // ======================================================
    // 13. CALCULATE DAYS
    // ======================================================

    console.log(
      "\n1️⃣1️⃣ Calculating subscription usage..."
    );

    const totalMilliseconds =
      endDate.getTime() -
      startDate.getTime();

    const usedMilliseconds =
      now.getTime() -
      startDate.getTime();

    const remainingMilliseconds =
      endDate.getTime() -
      now.getTime();

    const totalDays =
      Math.max(
        1,
        Math.ceil(
          totalMilliseconds /
            (1000 * 60 * 60 * 24)
        )
      );

    const usedDays =
      Math.max(
        0,
        Math.ceil(
          usedMilliseconds /
            (1000 * 60 * 60 * 24)
        )
      );

    const remainingDays =
      Math.max(
        0,
        Math.ceil(
          remainingMilliseconds /
            (1000 * 60 * 60 * 24)
        )
      );

    console.log(
      "Total days:",
      totalDays
    );

    console.log(
      "Used days:",
      usedDays
    );

    console.log(
      "Remaining days:",
      remainingDays
    );

    // ======================================================
    // 14. UNUSED CREDIT
    // ======================================================

    console.log(
      "\n1️⃣2️⃣ Calculating unused credit..."
    );

    const unusedCredit =
      Number(
        (
          currentPrice *
          remainingDays /
          totalDays
        ).toFixed(2)
      );

    console.log(
      "Current plan price:",
      currentPrice
    );

    console.log(
      "Remaining days:",
      remainingDays
    );

    console.log(
      "Total days:",
      totalDays
    );

    console.log(
      "Unused credit:",
      unusedCredit
    );

    // ======================================================
    // 15. AMOUNT TO PAY
    // ======================================================

    console.log(
      "\n1️⃣3️⃣ Calculating amount to pay..."
    );

    const amountToPay =
      Number(
        (
          newPrice -
          unusedCredit
        ).toFixed(2)
      );

    console.log(
      "New plan price:",
      newPrice
    );

    console.log(
      "Unused credit:",
      unusedCredit
    );

    console.log(
      "Amount to pay:",
      amountToPay
    );

    if (
      amountToPay <= 0
    ) {
      console.log(
        "❌ Invalid upgrade amount"
      );

      return res.status(400).json({
        success: false,
        message:
          "Invalid upgrade amount",
      });
    }

    // ======================================================
    // 16. CREATE RAZORPAY SUBSCRIPTION
    // ======================================================

    console.log(
      "\n1️⃣4️⃣ Creating Razorpay subscription..."
    );

    const razorpaySubscription =
      await razorpay.subscriptions.create({
        plan_id:
          razorpayPlanId,

        quantity: 1,

        customer_notify: 1,

        total_count:
          newBillingCycle ===
          "MONTHLY"
            ? 120
            : 10,

        notes: {
          tenantId,

          oldPlanId:
            currentPlan.planId,

          oldPlanLevel:
            String(
              currentLevel
            ),

          newPlanId:
            newPlan.planId,

          newPlanLevel:
            String(
              newLevel
            ),

          oldBillingCycle:
            currentPlan.billingCycle,

          newBillingCycle,

          currentPrice:
            String(
              currentPrice
            ),

          newPrice:
            String(
              newPrice
            ),

          unusedCredit:
            String(
              unusedCredit
            ),

          amountToPay:
            String(
              amountToPay
            ),
        },
      });

    console.log(
      "✅ Razorpay subscription created"
    );

    console.log(
      "Razorpay subscription ID:",
      razorpaySubscription.id
    );

    // ======================================================
    // 17. NEW SUBSCRIPTION DATES
    // ======================================================

    const pendingStartDate =
      new Date();

    const pendingEndDate =
      new Date(
        pendingStartDate
      );

    if (
      newBillingCycle ===
      "MONTHLY"
    ) {
      pendingEndDate.setMonth(
        pendingEndDate.getMonth() + 1
      );
    } else {
      pendingEndDate.setFullYear(
        pendingEndDate.getFullYear() + 1
      );
    }

    console.log(
      "\n1️⃣5️⃣ New subscription dates"
    );

    console.log(
      "Pending start date:",
      pendingStartDate
    );

    console.log(
      "Pending end date:",
      pendingEndDate
    );

    // ======================================================
    // 18. CREATE DB SUBSCRIPTION
    // ======================================================

    console.log(
      "\n1️⃣6️⃣ Creating pending database subscription..."
    );

    const pendingSubscription =
      await prisma.subscription.create({
        data: {
          tenantId,

          planId:
            newPlan.planId,

          status:
            "PENDING",

          billingCycle:
            newPlan.billingCycle,

          startDate:
            pendingStartDate,

          endDate:
            pendingEndDate,

          razorpaySubscriptionId:
            razorpaySubscription.id,
        },
      });

    console.log(
      "✅ Pending subscription created"
    );

    console.log(
      "Database subscription ID:",
      pendingSubscription.subscriptionId
    );

    console.log(
      "Status:",
      pendingSubscription.status
    );

    // ======================================================
    // 19. CREATE PAYMENT
    // ======================================================

    console.log(
      "\n1️⃣7️⃣ Creating payment record..."
    );

    const payment =
      await prisma.payment.create({
        data: {
          tenantId,

          subscriptionId:
            pendingSubscription.subscriptionId,

          amount:
            String(
              amountToPay
            ),

          currency:
            "INR",

          status:
            "PENDING",

          razorpaySubscriptionId:
            razorpaySubscription.id,
        },
      });

    console.log(
      "✅ Payment record created"
    );

    console.log(
      "Payment ID:",
      payment.paymentId
    );

    console.log(
      "Amount:",
      amountToPay
    );

    console.log(
      "Status:",
      payment.status
    );

    // ======================================================
    // SUCCESS
    // ======================================================

    console.log(
      "\n======================================================"
    );

    console.log(
      "✅ UPGRADE SUBSCRIPTION CREATED SUCCESSFULLY"
    );

    console.log(
      "======================================================\n"
    );

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(201).json({
      success: true,

      message:
        "Upgrade subscription created successfully",

      currentPlan: {
        planId:
          currentPlan.planId,

        name:
          currentPlan.name,

        planLevel:
          currentLevel,

        billingCycle:
          currentPlan.billingCycle,

        price:
          currentPrice,
      },

      newPlan: {
        planId:
          newPlan.planId,

        name:
          newPlan.name,

        planLevel:
          newLevel,

        billingCycle:
          newPlan.billingCycle,

        price:
          newPrice,
      },

      upgrade: {
        totalDays,

        usedDays,

        remainingDays,

        currentPlanUnusedCredit:
          unusedCredit,

        newPlanPrice:
          newPrice,

        amountToPay,
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
          amountToPay,

        currency:
          "INR",

        status:
          "PENDING",
      },
    });
  } catch (error) {
    console.error(
      "\n❌ Upgrade Subscription Error:",
      error
    );

    console.error(
      "Error message:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
};

const razorpayWebhook = async (req, res) => {
  try {
    console.log("==========================================");
    console.log("RAZORPAY WEBHOOK STARTED");
    console.log("==========================================");

    const signature =
      req.headers["x-razorpay-signature"];

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: "Razorpay signature missing",
      });
    }

    // ======================================================
    // CHECK RAW BODY
    // ======================================================

    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Raw webhook body is required",
      });
    }

    // ======================================================
    // VERIFY SIGNATURE
    // ======================================================

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          config.razorpay.keySecret
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

    // ======================================================
    // PARSE BODY
    // ======================================================

    const payload =
      JSON.parse(
        req.body.toString("utf8")
      );

    const event =
      payload.event;

    const subscriptionEntity =
      payload.payload
        ?.subscription
        ?.entity;

    const paymentEntity =
      payload.payload
        ?.payment
        ?.entity;

    const razorpaySubscriptionId =
      subscriptionEntity?.id;

    console.log(
      "Razorpay Event:",
      event
    );

    console.log(
      "Razorpay Subscription ID:",
      razorpaySubscriptionId
    );

    // ======================================================
    // SUBSCRIPTION AUTHENTICATED
    // ======================================================

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

    // ======================================================
    // SUBSCRIPTION ACTIVATED
    // ======================================================

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

      const newSubscription =
        await prisma.subscription.findUnique({
          where: {
            razorpaySubscriptionId,
          },
        });

      if (!newSubscription) {
        return res.status(200).json({
          success: true,
          message:
            "Subscription not found",
        });
      }

      // ==================================================
      // FIND OLD ACTIVE SUBSCRIPTION
      // ==================================================

      const oldSubscription =
        await prisma.subscription.findFirst({
          where: {
            tenantId:
              newSubscription.tenantId,

            status: "ACTIVE",

            NOT: {
              subscriptionId:
                newSubscription.subscriptionId,
            },
          },

          orderBy: {
            createdAt: "desc",
          },
        });

      // ==================================================
      // CANCEL OLD SUBSCRIPTION
      // ==================================================

      if (oldSubscription) {
        await prisma.subscription.update({
          where: {
            subscriptionId:
              oldSubscription.subscriptionId,
          },

          data: {
            status: "CANCELLED",
          },
        });
      }

      // ==================================================
      // ACTIVATE NEW SUBSCRIPTION
      // ==================================================

      await prisma.subscription.update({
        where: {
          subscriptionId:
            newSubscription.subscriptionId,
        },

        data: {
          status: "ACTIVE",
          startDate: new Date(),
        },
      });
    }

    // ======================================================
    // SUBSCRIPTION CHARGED
    // ======================================================

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

      // ==================================================
      // FIND SUBSCRIPTION + PLAN
      // ==================================================

      const subscription =
        await prisma.subscription.findUnique({
          where: {
            razorpaySubscriptionId,
          },

          include: {
            plan: true,
          },
        });

      if (!subscription) {
        return res.status(200).json({
          success: true,
          message:
            "Subscription not found",
        });
      }

      // ==================================================
      // BILLING CYCLE NOW COMES FROM PLAN
      // ==================================================

      const billingCycle =
        subscription.plan.billingCycle;

      // ==================================================
      // CALCULATE DATES
      // ==================================================

      const startDate =
        new Date();

      const endDate =
        new Date(startDate);

      if (
        billingCycle === "MONTHLY"
      ) {
        endDate.setMonth(
          endDate.getMonth() + 1
        );
      } else if (
        billingCycle === "YEARLY"
      ) {
        endDate.setFullYear(
          endDate.getFullYear() + 1
        );
      } else {
        // FREE / NONE should never
        // receive Razorpay charged event.
        return res.status(400).json({
          success: false,
          message:
            "Invalid billing cycle for paid subscription",
        });
      }

      // ==================================================
      // UPDATE SUBSCRIPTION
      // ==================================================

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

      // ==================================================
      // MARK PAYMENT SUCCESS
      // ==================================================

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

              paidAt:
                new Date(),

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

              amount:
                String(
                  paymentEntity.amount / 100
                ),

              currency:
                paymentEntity.currency ||
                "INR",

              status:
                "SUCCESS",

              razorpayPaymentId:
                paymentEntity.id,

              razorpaySubscriptionId,

              paidAt:
                new Date(),
            },
          });
        }
      }
    }

    // ======================================================
    // SUBSCRIPTION PENDING
    // ======================================================

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

    // ======================================================
    // SUBSCRIPTION HALTED
    // ======================================================

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

    // ======================================================
    // SUBSCRIPTION CANCELLED
    // ======================================================

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

    // ======================================================
    // SUBSCRIPTION COMPLETED
    // ======================================================

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

    // ======================================================
    // UNKNOWN EVENT
    // ======================================================

    else {
      console.log(
        "Unknown Razorpay event:",
        event
      );
    }

    // ======================================================
    // SUCCESS
    // ======================================================

    return res.status(200).json({
      success: true,
      message:
        "Webhook processed successfully",
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


// const razorpayWebhook = async (req, res) => {
//   try {
//     console.log("==========================================");
//     console.log("RAZORPAY WEBHOOK STARTED");
//     console.log("==========================================");

//     console.log("[1] Request headers:", req.headers);

//     const signature =
//       req.headers["x-razorpay-signature"];

//     console.log("[2] Razorpay signature:", signature);

//     if (!signature) {
//       console.log("[3] Signature missing");

//       return res.status(400).json({
//         success: false,
//         message: "Razorpay signature missing",
//       });
//     }

//     console.log("[4] Checking raw body");

//     if (!Buffer.isBuffer(req.body)) {
//       console.log(
//         "[5] Request body is NOT a Buffer"
//       );

//       return res.status(400).json({
//         success: false,
//         message: "Raw webhook body is required",
//       });
//     }

//     console.log(
//       "[6] Raw body received successfully"
//     );

//     // ==========================================
//     // VERIFY WEBHOOK SIGNATURE
//     // ==========================================

//     console.log(
//       "[7] Creating HMAC SHA256 signature"
//     );

//     const expectedSignature =
//       crypto
//         .createHmac(
//           "sha256",
//           config.razorpay.keySecret
//         )
//         .update(req.body)
//         .digest("hex");

//     console.log(
//       "[8] Expected signature:",
//       expectedSignature
//     );

//     const receivedSignature =
//       Buffer.from(signature, "utf8");

//     console.log(
//       "[9] Received signature buffer created"
//     );

//     const expectedSignatureBuffer =
//       Buffer.from(
//         expectedSignature,
//         "utf8"
//       );

//     console.log(
//       "[10] Expected signature buffer created"
//     );

//     console.log(
//       "[11] Received signature length:",
//       receivedSignature.length
//     );

//     console.log(
//       "[12] Expected signature length:",
//       expectedSignatureBuffer.length
//     );

//     if (
//       receivedSignature.length !==
//       expectedSignatureBuffer.length
//     ) {
//       console.log(
//         "[13] Signature lengths do not match"
//       );

//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid Razorpay webhook signature",
//       });
//     }

//     console.log(
//       "[14] Signature lengths match"
//     );

//     const isValid =
//       crypto.timingSafeEqual(
//         receivedSignature,
//         expectedSignatureBuffer
//       );

//     console.log(
//       "[15] Signature valid:",
//       isValid
//     );

//     if (!isValid) {
//       console.log(
//         "[16] Invalid Razorpay webhook signature"
//       );

//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid Razorpay webhook signature",
//       });
//     }

//     console.log(
//       "[17] Razorpay webhook signature VERIFIED"
//     );

//     // ==========================================
//     // PARSE RAW BODY
//     // ==========================================

//     console.log(
//       "[18] Parsing webhook body"
//     );

//     const payload =
//       JSON.parse(
//         req.body.toString("utf8")
//       );

//     console.log(
//       "[19] Webhook payload:",
//       JSON.stringify(payload, null, 2)
//     );

//     const event =
//       payload.event;

//     console.log(
//       "[20] Razorpay event:",
//       event
//     );

//     const subscriptionEntity =
//       payload.payload
//         ?.subscription
//         ?.entity;

//     console.log(
//       "[21] Subscription entity:",
//       subscriptionEntity
//     );

//     const paymentEntity =
//       payload.payload
//         ?.payment
//         ?.entity;

//     console.log(
//       "[22] Payment entity:",
//       paymentEntity
//     );

//     const razorpaySubscriptionId =
//       subscriptionEntity?.id;

//     console.log(
//       "[23] Razorpay Subscription ID:",
//       razorpaySubscriptionId
//     );

//     // ==========================================
//     // SUBSCRIPTION AUTHENTICATED
//     // ==========================================

//     if (
//       event ===
//       "subscription.authenticated"
//     ) {
//       console.log(
//         "[24] Event: subscription.authenticated"
//       );

//       if (!razorpaySubscriptionId) {
//         console.log(
//           "[25] Razorpay Subscription ID missing"
//         );

//         return res.status(200).json({
//           success: true,
//           message: "Webhook received",
//         });
//       }

//       console.log(
//         "[26] Finding subscription:",
//         razorpaySubscriptionId
//       );

//       const subscription =
//         await prisma.subscription.findUnique({
//           where: {
//             razorpaySubscriptionId,
//           },
//         });

//       console.log(
//         "[27] Subscription found:",
//         subscription
//       );

//       if (subscription) {
//         console.log(
//           "[28] Updating subscription to ACTIVE"
//         );

//         await prisma.subscription.update({
//           where: {
//             subscriptionId:
//               subscription.subscriptionId,
//           },

//           data: {
//             status: "ACTIVE",
//           },
//         });

//         console.log(
//           "[29] Subscription activated successfully"
//         );
//       } else {
//         console.log(
//           "[30] Subscription not found"
//         );
//       }
//     }

//     // ==========================================
//     // SUBSCRIPTION ACTIVATED
//     // ==========================================

//     else if (
//       event ===
//       "subscription.activated"
//     ) {
//       console.log(
//         "[31] Event: subscription.activated"
//       );

//       if (!razorpaySubscriptionId) {
//         console.log(
//           "[32] Razorpay Subscription ID missing"
//         );

//         return res.status(200).json({
//           success: true,
//           message: "Webhook received",
//         });
//       }

//       console.log(
//         "[33] Finding NEW subscription:",
//         razorpaySubscriptionId
//       );

//       const newSubscription =
//         await prisma.subscription.findUnique({
//           where: {
//             razorpaySubscriptionId,
//           },
//         });

//       console.log(
//         "[34] New subscription:",
//         newSubscription
//       );

//       if (!newSubscription) {
//         console.log(
//           "[35] New subscription not found"
//         );

//         return res.status(200).json({
//           success: true,
//           message:
//             "Subscription not found",
//         });
//       }

//       // ========================================
//       // FIND OLD ACTIVE SUBSCRIPTION
//       // ========================================

//       console.log(
//         "[36] Finding OLD active subscription"
//       );

//       const oldSubscription =
//         await prisma.subscription.findFirst({
//           where: {
//             tenantId:
//               newSubscription.tenantId,

//             status: "ACTIVE",

//             NOT: {
//               subscriptionId:
//                 newSubscription.subscriptionId,
//             },
//           },

//           orderBy: {
//             createdAt: "desc",
//           },
//         });

//       console.log(
//         "[37] Old subscription:",
//         oldSubscription
//       );

//       // ========================================
//       // CANCEL OLD PLAN
//       // ========================================

//       if (oldSubscription) {
//         console.log(
//           "[38] Old subscription found"
//         );

//         console.log(
//           "[39] Cancelling old subscription:",
//           oldSubscription.subscriptionId
//         );

//         await prisma.subscription.update({
//           where: {
//             subscriptionId:
//               oldSubscription.subscriptionId,
//           },

//           data: {
//             status: "CANCELLED",
//           },
//         });

//         console.log(
//           "[40] Old subscription cancelled"
//         );
//       } else {
//         console.log(
//           "[41] No old active subscription found"
//         );
//       }

//       // ========================================
//       // ACTIVATE NEW PLAN
//       // ========================================

//       console.log(
//         "[42] Activating new subscription"
//       );

//       await prisma.subscription.update({
//         where: {
//           subscriptionId:
//             newSubscription.subscriptionId,
//         },

//         data: {
//           status: "ACTIVE",

//           startDate: new Date(),
//         },
//       });

//       console.log(
//         "[43] New subscription activated"
//       );
//     }

//     // ==========================================
//     // SUBSCRIPTION CHARGED
//     // ==========================================

//     else if (
//       event ===
//       "subscription.charged"
//     ) {
//       console.log(
//         "[44] Event: subscription.charged"
//       );

//       if (!razorpaySubscriptionId) {
//         console.log(
//           "[45] Razorpay Subscription ID missing"
//         );

//         return res.status(200).json({
//           success: true,
//           message: "Webhook received",
//         });
//       }

//       console.log(
//         "[46] Finding subscription:",
//         razorpaySubscriptionId
//       );

//       const subscription =
//         await prisma.subscription.findUnique({
//           where: {
//             razorpaySubscriptionId,
//           },
//         });

//       console.log(
//         "[47] Subscription:",
//         subscription
//       );

//       if (!subscription) {
//         console.log(
//           "[48] Subscription not found"
//         );

//         return res.status(200).json({
//           success: true,
//           message:
//             "Subscription not found",
//         });
//       }

//       // ========================================
//       // CALCULATE DATES
//       // ========================================

//       console.log(
//         "[49] Calculating subscription dates"
//       );

//       const billingCycle =
//       subscription.plan.billingCycle;

//       const startDate =
//         new Date();

//       console.log(
//         "[50] Start date:",
//         startDate
//       );

//       const endDate = new Date(startDate);

//         if (
//           billingCycle === "MONTHLY"
//         ) {
//           endDate.setMonth(
//             endDate.getMonth() + 1
//           );
//         } else if (
//           billingCycle === "YEARLY"
//         ) {
//           endDate.setFullYear(
//             endDate.getFullYear() + 1
//           );
//         } else {
//           // FREE / NONE should never
//           // receive Razorpay charged event.
//           return res.status(400).json({
//             success: false,
//             message:
//               "Invalid billing cycle for paid subscription",
//           });
//         }

//       console.log(
//         "[53] End date:",
//         endDate
//       );

//       // ========================================
//       // UPDATE SUBSCRIPTION
//       // ========================================

//       console.log(
//         "[54] Updating subscription"
//       );

//       await prisma.subscription.update({
//         where: {
//           subscriptionId:
//             subscription.subscriptionId,
//         },

//         data: {
//           status: "ACTIVE",

//           startDate,

//           endDate,
//         },
//       });

//       console.log(
//         "[55] Subscription updated successfully"
//       );

//       // ========================================
//       // MARK PAYMENT SUCCESS
//       // ========================================

//       console.log(
//         "[56] Checking payment entity"
//       );

//       if (paymentEntity?.id) {
//         console.log(
//           "[57] Payment ID:",
//           paymentEntity.id
//         );

//         console.log(
//           "[58] Finding existing payment"
//         );

//         const existingPayment =
//           await prisma.payment.findUnique({
//             where: {
//               razorpayPaymentId:
//                 paymentEntity.id,
//             },
//           });

//         console.log(
//           "[59] Existing payment:",
//           existingPayment
//         );

//         if (existingPayment) {
//           console.log(
//             "[60] Updating existing payment"
//           );

//           await prisma.payment.update({
//             where: {
//               paymentId:
//                 existingPayment.paymentId,
//             },

//             data: {
//               status: "SUCCESS",

//               paidAt:
//                 new Date(),

//               razorpaySubscriptionId,
//             },
//           });

//           console.log(
//             "[61] Payment marked SUCCESS"
//           );
//         } else {
//           console.log(
//             "[62] Payment does not exist"
//           );

//           console.log(
//             "[63] Creating new payment"
//           );

//           await prisma.payment.create({
//             data: {
//               tenantId:
//                 subscription.tenantId,

//               subscriptionId:
//                 subscription.subscriptionId,

//               amount:
//                 String(
//                   paymentEntity.amount / 100
//                 ),

//               currency:
//                 paymentEntity.currency ||
//                 "INR",

//               status: "SUCCESS",

//               razorpayPaymentId:
//                 paymentEntity.id,

//               razorpaySubscriptionId,

//               paidAt:
//                 new Date(),
//             },
//           });

//           console.log(
//             "[64] Payment created successfully"
//           );
//         }
//       } else {
//         console.log(
//           "[65] Payment entity not found"
//         );
//       }
//     }

//     // ==========================================
//     // SUBSCRIPTION PENDING
//     // ==========================================

//     else if (
//       event ===
//       "subscription.pending"
//     ) {
//       console.log(
//         "[66] Event: subscription.pending"
//       );

//       if (razorpaySubscriptionId) {
//         console.log(
//           "[67] Finding pending subscription"
//         );

//         const subscription =
//           await prisma.subscription.findUnique({
//             where: {
//               razorpaySubscriptionId,
//             },
//           });

//         console.log(
//           "[68] Subscription:",
//           subscription
//         );

//         if (subscription) {
//           console.log(
//             "[69] Setting subscription to PAST_DUE"
//           );

//           await prisma.subscription.update({
//             where: {
//               subscriptionId:
//                 subscription.subscriptionId,
//             },

//             data: {
//               status:
//                 "PAST_DUE",
//             },
//           });

//           console.log(
//             "[70] Subscription set to PAST_DUE"
//           );
//         }
//       }
//     }

//     // ==========================================
//     // SUBSCRIPTION HALTED
//     // ==========================================

//     else if (
//       event ===
//       "subscription.halted"
//     ) {
//       console.log(
//         "[71] Event: subscription.halted"
//       );

//       if (razorpaySubscriptionId) {
//         console.log(
//           "[72] Finding halted subscription"
//         );

//         const subscription =
//           await prisma.subscription.findUnique({
//             where: {
//               razorpaySubscriptionId,
//             },
//           });

//         console.log(
//           "[73] Subscription:",
//           subscription
//         );

//         if (subscription) {
//           console.log(
//             "[74] Setting subscription to SUSPENDED"
//           );

//           await prisma.subscription.update({
//             where: {
//               subscriptionId:
//                 subscription.subscriptionId,
//             },

//             data: {
//               status:
//                 "SUSPENDED",
//             },
//           });

//           console.log(
//             "[75] Subscription suspended"
//           );
//         }
//       }
//     }

//     // ==========================================
//     // SUBSCRIPTION CANCELLED
//     // ==========================================

//     else if (
//       event ===
//       "subscription.cancelled"
//     ) {
//       console.log(
//         "[76] Event: subscription.cancelled"
//       );

//       if (razorpaySubscriptionId) {
//         console.log(
//           "[77] Finding cancelled subscription"
//         );

//         const subscription =
//           await prisma.subscription.findUnique({
//             where: {
//               razorpaySubscriptionId,
//             },
//           });

//         console.log(
//           "[78] Subscription:",
//           subscription
//         );

//         if (subscription) {
//           console.log(
//             "[79] Setting subscription to CANCELLED"
//           );

//           await prisma.subscription.update({
//             where: {
//               subscriptionId:
//                 subscription.subscriptionId,
//             },

//             data: {
//               status:
//                 "CANCELLED",
//             },
//           });

//           console.log(
//             "[80] Subscription cancelled"
//           );
//         }
//       }
//     }

//     // ==========================================
//     // SUBSCRIPTION COMPLETED
//     // ==========================================

//     else if (
//       event ===
//       "subscription.completed"
//     ) {
//       console.log(
//         "[81] Event: subscription.completed"
//       );

//       if (razorpaySubscriptionId) {
//         console.log(
//           "[82] Finding completed subscription"
//         );

//         const subscription =
//           await prisma.subscription.findUnique({
//             where: {
//               razorpaySubscriptionId,
//             },
//           });

//         console.log(
//           "[83] Subscription:",
//           subscription
//         );

//         if (subscription) {
//           console.log(
//             "[84] Setting subscription to EXPIRED"
//           );

//           await prisma.subscription.update({
//             where: {
//               subscriptionId:
//                 subscription.subscriptionId,
//             },

//             data: {
//               status:
//                 "EXPIRED",
//             },
//           });

//           console.log(
//             "[85] Subscription expired"
//           );
//         }
//       }
//     }

//     // ==========================================
//     // UNKNOWN EVENT
//     // ==========================================

//     else {
//       console.log(
//         "[86] Unknown Razorpay event:",
//         event
//       );
//     }

//     // ==========================================
//     // SUCCESS RESPONSE
//     // ==========================================

//     console.log(
//       "[87] Webhook processing completed"
//     );

//     console.log(
//       "=========================================="
//     );

//     return res.status(200).json({
//       success: true,
//       message:
//         "Webhook processed successfully",
//     });
//   } catch (error) {
//     console.error(
//       "=========================================="
//     );

//     console.error(
//       "RAZORPAY WEBHOOK ERROR"
//     );

//     console.error(
//       "=========================================="
//     );

//     console.error(
//       "Error message:",
//       error.message
//     );

//     console.error(
//       "Error stack:",
//       error.stack
//     );

//     return res.status(500).json({
//       success: false,
//       message:
//         "Webhook processing failed",
//     });
//   }
// };



// const upgradeSubscription = async (req, res) => {
//   try {
//     const {
//       planId,
//       billingCycle,
//       tenantId
//     } = req.body;

  

//     // ------------------------------------------
//     // 1. VALIDATION
//     // ------------------------------------------

//     if (!tenantId) {
//       return res.status(403).json({
//         success: false,
//         message: "Tenant not found",
//       });
//     }

//     if (!planId) {
//       return res.status(400).json({
//         success: false,
//         message: "planId is required",
//       });
//     }

//     if (
//       !billingCycle ||
//       !["MONTHLY", "YEARLY"].includes(
//         billingCycle
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "billingCycle must be MONTHLY or YEARLY",
//       });
//     }

//     // ------------------------------------------
//     // 2. GET CURRENT SUBSCRIPTION
//     // ------------------------------------------

//     const currentSubscription = await prisma.subscription.findFirst({
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
//         message:
//           "Active subscription not found",
//       });
//     }

//     // ------------------------------------------
//     // 3. GET NEW PLAN
//     // ------------------------------------------

//     const newPlan = await prisma.plan.findUnique({
//         where: {
//           planId,
//         },
//       });

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

//     // ------------------------------------------
//     // 4. PREVENT SAME PLAN
//     // ------------------------------------------

//     if ( currentSubscription.planId === newPlan.planId && currentSubscription.billingCycle === billingCycle ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "You are already using this plan",
//       });
//     }

//     // ------------------------------------------
//     // 5. GET PRICES
//     // ------------------------------------------

//     const currentPrice = currentSubscription.billingCycle === "MONTHLY" ? Number( currentSubscription.plan.monthlyPrice)
//         : Number(currentSubscription.plan.yearlyPrice );

//     const newPrice = billingCycle === "MONTHLY"? Number(newPlan.monthlyPrice) : Number(newPlan.yearlyPrice);

//     // ------------------------------------------
//     // 6. CHECK UPGRADE
//     // ------------------------------------------

//     if (newPrice <= currentPrice) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "This is not an upgrade. Downgrade requires Super Admin approval.",
//       });
//     }

//     // ------------------------------------------
//     // 7. CALCULATE DIFFERENCE
//     // ------------------------------------------

//     const upgradeAmount = Number((newPrice - currentPrice).toFixed(2));

//     if (upgradeAmount <= 0) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid upgrade amount",
//       });
//     }

//     // ------------------------------------------
//     // 8. GET RAZORPAY PLAN ID
//     // ------------------------------------------

//     const razorpayPlanId =
//       billingCycle === "MONTHLY"
//         ? newPlan.razorpayMonthlyPlanId
//         : newPlan.razorpayYearlyPlanId;

//     if (!razorpayPlanId) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Razorpay plan is not configured",
//       });
//     }

//     // ------------------------------------------
//     // 9. CREATE RAZORPAY SUBSCRIPTION
//     // ------------------------------------------

//     const razorpaySubscription = await razorpay.subscriptions.create({
//         plan_id: razorpayPlanId,
//         quantity: 1,
//         customer_notify: 1,
//         total_count: billingCycle === "MONTHLY" ? 120 : 10,
//         notes: {
//           tenantId,
//           oldPlanId: currentSubscription.planId,
//           newPlanId: newPlan.planId,
//           billingCycle,
//           currentPrice: String(currentPrice),
//           newPrice: String(newPrice),
//           upgradeAmount: String(upgradeAmount),
//         },
//       });


//       // ============================================================
// // ⭐ ADD THIS
// // CREATE NEW SUBSCRIPTION AS PENDING
// // ============================================================

// const pendingSubscription = await prisma.subscription.create({
//   data: {
//     tenantId,
//     // ⭐ New plan
//     planId: newPlan.planId,
//     // ⭐ New billing cycle
//     billingCycle,
//     // ⭐ IMPORTANT
//     // Do NOT make it ACTIVE yet
//     status: "PENDING",
//     startDate: new Date(),

//     endDate: billingCycle === "MONTHLY" ? new Date( new Date().setMonth( new Date().getMonth() + 1 ) )
//      : new Date( new Date().setFullYear(  new Date().getFullYear() + 1 ) ),
    
//      razorpaySubscriptionId: razorpaySubscription.id,
//   },
// });

//     // ------------------------------------------
//     // 10. CREATE PAYMENT RECORD
//     // ------------------------------------------

//     const payment = await prisma.payment.create({
//         data: {
//           tenantId,
//           subscriptionId:
//           pendingSubscription.subscriptionId,
//           amount: String(upgradeAmount),
//           currency: "INR",
//           status: "PENDING",
//           razorpaySubscriptionId: razorpaySubscription.id,
//         },
//       });

//     // ------------------------------------------
//     // 11. RESPONSE
//     // ------------------------------------------

//     return res.status(201).json({
//       success: true,

//       message:"Upgrade subscription created successfully",

//       currentPlan: {
//         planId: currentSubscription.planId,
//         name: currentSubscription.plan.name,
//         billingCycle: currentSubscription.billingCycle,
//         price: currentPrice,
//       },

//       newPlan: {
//         planId: newPlan.planId,
//         name: newPlan.name,
//         billingCycle,
//         price: newPrice,
//       },

//       upgrade: {
//         currentPrice,
//         newPrice,
//         amountToPay: upgradeAmount,
//       },

//       razorpay: {
//         keyId: config.razorpay.keyId,
//         subscriptionId: razorpaySubscription.id,
//         planId: razorpayPlanId,
//       },

//       payment: {
//         paymentId: payment.paymentId,
//         amount: upgradeAmount,
//         currency: "INR",
//         status: "PENDING",
//       },
//     });
//   } catch (error) {
//     console.error(
//       "Upgrade Subscription Error:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message:
//         "Internal server error",
//     });
//   }
// };


// ==========================================================
// EXPORTS
// ==========================================================


module.exports = {
  getCurrentSubscription,
  getAvailablePlans,
  razorpayWebhook,
  upgradeSubscription,
};