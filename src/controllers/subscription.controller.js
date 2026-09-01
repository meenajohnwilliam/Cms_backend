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

// ==========================================================
// UPGRADE SUBSCRIPTION
// FREE → PAID
// PAID → HIGHER PAID
// ==========================================================

// const upgradeSubscription = async (req, res) => {
//   try {

//     const {
//       planId,
//       tenantId,
//     } = req.body;

//     // ======================================================
//     // 1. REQUEST
//     // ======================================================


//     if (!tenantId){
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
//     // 2. CURRENT ACTIVE SUBSCRIPTION
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
//         message:"Active subscription not found"
//       });
//     }

//     // ======================================================
//     // 3. CURRENT PLAN
//     // ======================================================

//     const currentPlan = currentSubscription.plan;

//     const currentLevel = Number(currentPlan.planLevel);

//     const currentPrice = Number( currentPlan.price || 0 );

//     const currentType = currentPlan.type;


//     // ======================================================
//     // 4. NEW PLAN
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

//     const newLevel = Number( newPlan.planLevel );

//     const newPrice =
//       Number(
//         newPlan.price || 0
//       );

//     const newType =
//       newPlan.type;

//     const newBillingCycle = newPlan.billingCycle;


//     // ======================================================
//     // 5. CHECK ACTIVE
//     // ======================================================

//     if (!newPlan.isActive) {
//       return res.status(400).json({
//         success: false,
//         message: "Plan is inactive",
//       });
//     }


//     // ======================================================
//     // 6. NEW PLAN MUST BE PAID
//     // ======================================================

//     if ( newType !== "PAID" ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Only paid plans can be selected",
//       });
//     }


//     // ======================================================
//     // 7. SAME PLAN
//     // ======================================================

//     if (
//       currentPlan.planId ===
//       newPlan.planId
//     ) {
//       console.log(
//         "❌ Same plan selected"
//       );

//       return res.status(400).json({
//         success: false,
//         message:
//           "You are already using this plan",
//       });
//     }

//     // ======================================================
//     // 8. PLAN LEVEL CHECK
//     // ======================================================
//     //
//     // FREE LEVEL 0
//     // STARTER LEVEL 1
//     // PRO LEVEL 2
//     //
//     // FREE → STARTER
//     // 0 → 1 = ALLOWED
//     //
//     // STARTER → PRO
//     // 1 → 2 = ALLOWED
//     //
//     // PRO → STARTER
//     // 2 → 1 = DOWNGRADE
//     //
//     // ======================================================

//     console.log(
//       "\n5️⃣ CHECKING PLAN LEVEL"
//     );

//     console.log(
//       "Current Level:",
//       currentLevel
//     );

//     console.log(
//       "New Level:",
//       newLevel
//     );

//     if (
//       newLevel <= currentLevel
//     ) {
//       console.log(
//         "❌ Selected plan is not higher"
//       );

//       return res.status(400).json({
//         success: false,
//         message:
//           "Selected plan is not an upgrade. Downgrade requires Super Admin approval.",
//       });
//     }

//     console.log(
//       `✅ Upgrade allowed: ${currentLevel} → ${newLevel}`
//     );

//     // ======================================================
//     // 9. BILLING CYCLE
//     // ======================================================

//     if (
//       newBillingCycle !==
//         "MONTHLY" &&
//       newBillingCycle !==
//         "YEARLY"
//     ) {
//       console.log(
//         "❌ Invalid billing cycle"
//       );

//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid billing cycle",
//       });
//     }

//     // ======================================================
//     // 10. RAZORPAY PLAN ID
//     // ======================================================

//     console.log(
//       "\n6️⃣ CHECKING RAZORPAY PLAN"
//     );

//     const razorpayPlanId =
//       newPlan.razorpayPlanId;

//     if (!razorpayPlanId) {
//       console.log(
//         "❌ Razorpay plan ID missing"
//       );

//       return res.status(400).json({
//         success: false,
//         message:
//           "Razorpay plan is not configured",
//       });
//     }

//     console.log(
//       "Razorpay Plan ID:",
//       razorpayPlanId
//     );

//     // ======================================================
//     // 11. PAYMENT CALCULATION
//     // ======================================================
//     //
//     // CASE 1:
//     //
//     // FREE → PAID
//     //
//     // No unused credit.
//     //
//     // amountToPay = newPrice
//     //
//     // CASE 2:
//     //
//     // PAID → PAID
//     //
//     // Calculate unused credit.
//     //
//     // amountToPay =
//     // newPrice - unusedCredit
//     //
//     // ======================================================

//     let totalDays = 0;
//     let usedDays = 0;
//     let remainingDays = 0;
//     let unusedCredit = 0;
//     let amountToPay = 0;

//     // ======================================================
//     // CASE 1: FREE → PAID
//     // ======================================================

//     if (
//       currentType === "FREE"
//     ) {
//       console.log(
//         "\n7️⃣ FREE → PAID"
//       );

//       console.log(
//         "No previous paid subscription"
//       );

//       console.log(
//         "No unused credit calculation required"
//       );

//       unusedCredit = 0;

//       amountToPay =
//         Number(
//           newPrice.toFixed(2)
//         );

//       console.log(
//         "New Plan Price:",
//         newPrice
//       );

//       console.log(
//         "Unused Credit:",
//         unusedCredit
//       );

//       console.log(
//         "Amount To Pay:",
//         amountToPay
//       );
//     }

//     // ======================================================
//     // CASE 2: PAID → PAID
//     // ======================================================

//     else {
//       console.log(
//         "\n7️⃣ PAID → PAID UPGRADE"
//       );

//       const startDate =
//         new Date(
//           currentSubscription.startDate
//         );

//       const endDate =
//         new Date(
//           currentSubscription.endDate
//         );

//       const now =
//         new Date();

//       console.log(
//         "Current Start Date:",
//         startDate
//       );

//       console.log(
//         "Current End Date:",
//         endDate
//       );

//       console.log(
//         "Current Date:",
//         now
//       );

//       // ====================================================
//       // DAY
//       // ====================================================

//       const DAY =
//         1000 *
//         60 *
//         60 *
//         24;

//       // ====================================================
//       // CALCULATE DAYS
//       // ====================================================

//       const totalMilliseconds =
//         endDate.getTime() -
//         startDate.getTime();

//       const usedMilliseconds =
//         now.getTime() -
//         startDate.getTime();

//       const remainingMilliseconds =
//         endDate.getTime() -
//         now.getTime();

//       totalDays =
//         Math.max(
//           1,
//           Math.ceil(
//             totalMilliseconds /
//               DAY
//           )
//         );

//       usedDays =
//         Math.max(
//           0,
//           Math.ceil(
//             usedMilliseconds /
//               DAY
//           )
//         );

//       remainingDays =
//         Math.max(
//           0,
//           Math.ceil(
//             remainingMilliseconds /
//               DAY
//           )
//         );

//       console.log(
//         "\nSubscription Days:"
//       );

//       console.log(
//         "Total Days:",
//         totalDays
//       );

//       console.log(
//         "Used Days:",
//         usedDays
//       );

//       console.log(
//         "Remaining Days:",
//         remainingDays
//       );

//       // ====================================================
//       // UNUSED CREDIT
//       // ====================================================

//       unusedCredit =
//         Number(
//           (
//             currentPrice *
//             remainingDays /
//             totalDays
//           ).toFixed(2)
//         );

//       console.log(
//         "\nUnused Credit:"
//       );

//       console.log(
//         "Current Price:",
//         currentPrice
//       );

//       console.log(
//         "Remaining Days:",
//         remainingDays
//       );

//       console.log(
//         "Unused Credit:",
//         unusedCredit
//       );

//       // ====================================================
//       // AMOUNT TO PAY
//       // ====================================================

//       amountToPay =
//         Number(
//           (
//             newPrice -
//             unusedCredit
//           ).toFixed(2)
//         );

//       console.log(
//         "\nUpgrade Amount:"
//       );

//       console.log(
//         "New Plan Price:",
//         newPrice
//       );

//       console.log(
//         "Unused Credit:",
//         unusedCredit
//       );

//       console.log(
//         "Amount To Pay:",
//         amountToPay
//       );
//     }

//     // ======================================================
//     // 12. FINAL AMOUNT VALIDATION
//     // ======================================================

//     if (
//       amountToPay <= 0
//     ) {
//       console.log(
//         "❌ Invalid amount to pay:",
//         amountToPay
//       );

//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid upgrade amount",
//       });
//     }

//     // ======================================================
//     // 13. CREATE RAZORPAY ORDER
//     // ======================================================
//     //
//     // This collects the amount payable NOW.
//     //
//     // FREE → PAID
//     // Example: ₹999
//     //
//     // PAID → PAID
//     // Example: ₹1666
//     //
//     // ======================================================

//     console.log(
//       "\n8️⃣ CREATING RAZORPAY ORDER"
//     );

//     const razorpayOrder =
//       await razorpay.orders.create({
//         amount:
//           Math.round(
//             amountToPay * 100
//           ),

//         currency:
//           "INR",

//         receipt:
//           `upgrade_${tenantId}_${Date.now()}`,

//         notes: {
//           tenantId,

//           oldPlanId:
//             currentPlan.planId,

//           newPlanId:
//             newPlan.planId,

//           oldPlanLevel:
//             String(
//               currentLevel
//             ),

//           newPlanLevel:
//             String(
//               newLevel
//             ),

//           oldBillingCycle:
//             currentPlan.billingCycle ||
//             "NONE",

//           newBillingCycle,

//           currentPrice:
//             String(
//               currentPrice
//             ),

//           newPrice:
//             String(
//               newPrice
//             ),

//           unusedCredit:
//             String(
//               unusedCredit
//             ),

//           amountToPay:
//             String(
//               amountToPay
//             ),

//           upgradeType:
//             currentType === "FREE"
//               ? "FREE_TO_PAID"
//               : "PAID_TO_PAID",
//         },
//       });

//     console.log(
//       "✅ Razorpay Order Created"
//     );

//     console.log(
//       "Order ID:",
//       razorpayOrder.id
//     );

//     console.log(
//       "Order Amount:",
//       razorpayOrder.amount / 100
//     );

//     // ======================================================
//     // 14. CREATE RAZORPAY AUTOPAY SUBSCRIPTION
//     // ======================================================

//     console.log(
//       "\n9️⃣ CREATING RAZORPAY AUTOPAY SUBSCRIPTION"
//     );

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
//             currentPlan.planId,

//           newPlanId:
//             newPlan.planId,

//           oldPlanLevel:
//             String(
//               currentLevel
//             ),

//           newPlanLevel:
//             String(
//               newLevel
//             ),

//           oldBillingCycle:
//             currentPlan.billingCycle ||
//             "NONE",

//           newBillingCycle,

//           currentPrice:
//             String(
//               currentPrice
//             ),

//           newPrice:
//             String(
//               newPrice
//             ),

//           unusedCredit:
//             String(
//               unusedCredit
//             ),

//           amountToPay:
//             String(
//               amountToPay
//             ),

//           upgradeOrderId:
//             razorpayOrder.id,

//           upgradeType:
//             currentType === "FREE"
//               ? "FREE_TO_PAID"
//               : "PAID_TO_PAID",
//         },
//       });

//     console.log(
//       "✅ Razorpay AutoPay Subscription Created"
//     );

//     console.log(
//       "Razorpay Subscription ID:",
//       razorpaySubscription.id
//     );

//     // ======================================================
//     // 15. NEW SUBSCRIPTION DATES
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
//     }

//     else {
//       pendingEndDate.setFullYear(
//         pendingEndDate.getFullYear() + 1
//       );
//     }

//     console.log(
//       "\n🔟 NEW SUBSCRIPTION DATES"
//     );

//     console.log(
//       "Start:",
//       pendingStartDate
//     );

//     console.log(
//       "End:",
//       pendingEndDate
//     );

//     // ======================================================
//     // 16. CREATE DB SUBSCRIPTION
//     // ======================================================

//     console.log(
//       "\n1️⃣1️⃣ CREATING PENDING DB SUBSCRIPTION"
//     );

//     const pendingSubscription =
//       await prisma.subscription.create({
//         data: {
//           tenantId,

//           planId:
//             newPlan.planId,

//           status:
//             "PENDING",

//           /*
//            * Keep this only if billingCycle
//            * exists in Subscription model
//            * and is required.
//            */

//           billingCycle:
//             newPlan.billingCycle,

//           startDate:
//             pendingStartDate,

//           endDate:
//             pendingEndDate,

//           razorpaySubscriptionId:
//             razorpaySubscription.id,
//         },
//       });

//     console.log(
//       "✅ DB Subscription Created"
//     );

//     console.log(
//       "Subscription ID:",
//       pendingSubscription.subscriptionId
//     );

//     console.log(
//       "Status:",
//       pendingSubscription.status
//     );

//     // ======================================================
//     // 17. CREATE PAYMENT RECORD
//     // ======================================================

//     console.log(
//       "\n1️⃣2️⃣ CREATING PAYMENT RECORD"
//     );

//     const payment =
//       await prisma.payment.create({
//         data: {
//           tenantId,

//           subscriptionId:
//             pendingSubscription.subscriptionId,

//           amount:
//             String(
//               amountToPay
//             ),

//           currency:
//             "INR",

//           status:
//             "PENDING",

//           razorpayOrderId:
//             razorpayOrder.id,

//           razorpaySubscriptionId:
//             razorpaySubscription.id,
//         },
//       });

//     console.log(
//       "✅ Payment Record Created"
//     );

//     console.log(
//       "Payment ID:",
//       payment.paymentId
//     );

//     console.log(
//       "Amount:",
//       amountToPay
//     );

//     console.log(
//       "Status:",
//       payment.status
//     );

//     // ======================================================
//     // 18. FINAL LOG
//     // ======================================================

//     console.log(
//       "\n======================================================"
//     );

//     console.log(
//       "✅ UPGRADE CREATED SUCCESSFULLY"
//     );

//     console.log(
//       "======================================================"
//     );

//     console.log(
//       "Upgrade Type:",
//       currentType === "FREE"
//         ? "FREE → PAID"
//         : "PAID → PAID"
//     );

//     console.log(
//       "Old Plan:",
//       currentPlan.name
//     );

//     console.log(
//       "New Plan:",
//       newPlan.name
//     );

//     console.log(
//       "Amount To Pay:",
//       amountToPay
//     );

//     console.log(
//       "Razorpay Order:",
//       razorpayOrder.id
//     );

//     console.log(
//       "Razorpay Subscription:",
//       razorpaySubscription.id
//     );

//     console.log(
//       "======================================================\n"
//     );

//     // ======================================================
//     // 19. RESPONSE
//     // ======================================================

//     return res.status(201).json({
//       success: true,

//       message:
//         "Upgrade payment created successfully",

//       upgradeType:
//         currentType === "FREE"
//           ? "FREE_TO_PAID"
//           : "PAID_TO_PAID",

//       currentPlan: {
//         planId:
//           currentPlan.planId,

//         name:
//           currentPlan.name,

//         type:
//           currentPlan.type,

//         planLevel:
//           currentLevel,

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

//         planLevel:
//           newLevel,

//         billingCycle:
//           newPlan.billingCycle,

//         price:
//           newPrice,
//       },

//       upgrade: {
//         totalDays,

//         usedDays,

//         remainingDays,

//         unusedCredit,

//         newPlanPrice:
//           newPrice,

//         amountToPay,
//       },

//       razorpay: {
//         keyId:
//           config.razorpay.keyId,

//         orderId:
//           razorpayOrder.id,

//         orderAmount:
//           razorpayOrder.amount,

//         subscriptionId:
//           razorpaySubscription.id,

//         subscriptionPlanId:
//           razorpayPlanId,
//       },

//       payment: {
//         paymentId:
//           payment.paymentId,

//         amount:
//           amountToPay,

//         currency:
//           "INR",

//         status:
//           "PENDING",
//       },
//     });

//   } catch (error) {
//     console.error(
//       "\n======================================================"
//     );

//     console.error(
//       "❌ UPGRADE SUBSCRIPTION ERROR"
//     );

//     console.error(
//       "======================================================"
//     );

//     console.error(
//       "Message:",
//       error.message
//     );

//     console.error(
//       "Full Error:",
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
// RAZORPAY WEBHOOK
// ==========================================================


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
    // CASE 1
    // FREE → PAID
    // ======================================================

    if (currentPlan.type === "FREE") {
      //console.log("\n🆓 FREE → PAID");
      //console.log("Creating Razorpay Subscription only");

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
      // ----------------------------------------------------

      const razorpaySubscription = await razorpay.subscriptions.create({
          plan_id: newPlan.razorpayPlanId,
          quantity: 1,
          customer_notify: 1,
          total_count:
            newPlan.billingCycle === "MONTHLY"
              ? 120
              : 10,
          notes: {
            tenantId,
            subscriptionId: pendingSubscription.subscriptionId,
            planId: newPlan.planId,
            upgradeType: "FREE_TO_PAID",
          },
        });

      // ----------------------------------------------------
      // SAVE RAZORPAY SUBSCRIPTION ID
      // ----------------------------------------------------

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

      // console.log("✅ Razorpay Subscription Created");
      // console.log("Subscription:", razorpaySubscription.id);

      return res.status(201).json({
        success: true,
        message:
          "Subscription created. Complete AutoPay authorization.",
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

    const totalDays = Math.max( 1, Math.ceil( (endDate.getTime() - startDate.getTime()) / DAY ));

    const remainingDays = Math.max( 0, Math.ceil( (endDate.getTime() - now.getTime()) / DAY ));

    const unusedCredit = Number(
      (
        (currentPrice * remainingDays) /
        totalDays
      ).toFixed(2)
    );

    const amountToPay = Number(Math.max( 1, newPrice - unusedCredit ).toFixed(2));

    console.log("Current Price:", currentPrice);
    console.log("New Price:", newPrice);
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

    const razorpayOrder =
      await razorpay.orders.create({
        amount: Math.round(amountToPay * 100),
        currency: "INR",
        receipt:
          `upgrade_${tenantId}_${Date.now()}`,
        notes: {
          tenantId,
          subscriptionId:
            pendingSubscription.subscriptionId,
          oldPlanId:
            currentPlan.planId,
          newPlanId:
            newPlan.planId,
          upgradeType:
            "PAID_TO_PAID",
        },
      });

    console.log("✅ Upgrade Order Created");
    console.log("Order ID:", razorpayOrder.id);

    // ======================================================
    // CREATE PAYMENT RECORD
    // ======================================================

    const payment = await prisma.payment.create({
        data: {
          tenantId,
          subscriptionId:
            pendingSubscription.subscriptionId,
          amount:
            String(amountToPay),
          currency: "INR",
          status: "PENDING",
          razorpayOrderId:
            razorpayOrder.id,
        },
      });

    return res.status(201).json({
      success: true,
      message:
        "Upgrade payment created",
      upgradeType:
        "PAID_TO_PAID",
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
        keyId:
          config.razorpay.keyId,
        orderId:
          razorpayOrder.id,
        amount:
          razorpayOrder.amount,
      },

      payment: {
        paymentId:
          payment.paymentId,
        amount:
          amountToPay,
        status:
          "PENDING",
      },
    });

  } catch (error) {
    console.error(
      "❌ UPGRADE ERROR:",
      error
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
    console.log("\n======================================================");
    console.log("🚀 RAZORPAY WEBHOOK STARTED");
    console.log("======================================================");

    // ======================================================
    // 1. SIGNATURE
    // ======================================================

    const signature =
      req.headers["x-razorpay-signature"];

    if (!signature) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay signature missing",
      });
    }

    // ======================================================
    // 2. VERIFY SIGNATURE
    // ======================================================

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          config.razorpay.keySecret
        )
        .update(req.body)
        .digest("hex");

    const isValid =
      crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

    if (!isValid) {
      console.log(
        "❌ Invalid webhook signature"
      );

      return res.status(400).json({
        success: false,
        message:
          "Invalid signature",
      });
    }

    console.log(
      "✅ Webhook signature verified"
    );

    // ======================================================
    // 3. PARSE PAYLOAD
    // ======================================================

    const payload =
      JSON.parse(req.body.toString());

    const event =
      payload.event;

    const subscriptionEntity =
      payload.payload?.subscription?.entity;

    const paymentEntity =
      payload.payload?.payment?.entity;

    const razorpaySubscriptionId =
      subscriptionEntity?.id;

    console.log("Event:", event);
    console.log(
      "Subscription ID:",
      razorpaySubscriptionId
    );

    // ======================================================
    // HELPER: GET DB SUBSCRIPTION
    // ======================================================

    const getSubscription =
      async (razorpaySubscriptionId) => {

        if (!razorpaySubscriptionId) {
          return null;
        }

        return await prisma.subscription.findUnique({
          where: {
            razorpaySubscriptionId,
          },

          include: {
            plan: true,
          },
        });
      };

    // ======================================================
    // HELPER: ACTIVATE NEW SUBSCRIPTION
    // ======================================================

    const activateNewSubscription =
      async (subscription) => {

        if (!subscription) {
          return null;
        }

        if (
          subscription.status === "ACTIVE"
        ) {
          console.log(
            "ℹ️ Subscription already active"
          );

          return subscription;
        }

        console.log(
          "\n🟢 ACTIVATING NEW SUBSCRIPTION"
        );

        // ==================================================
        // GET OLD ACTIVE SUBSCRIPTION
        // ==================================================

        const oldSubscription =
          await prisma.subscription.findFirst({
            where: {
              tenantId:
                subscription.tenantId,

              status:
                "ACTIVE",

              NOT: {
                subscriptionId:
                  subscription.subscriptionId,
              },
            },

            include: {
              plan: true,
            },

            orderBy: {
              createdAt: "desc",
            },
          });

        // ==================================================
        // CANCEL OLD RAZORPAY SUBSCRIPTION
        // ==================================================

        if (
          oldSubscription?.razorpaySubscriptionId
        ) {
          console.log(
            "🔄 Cancelling old Razorpay subscription"
          );

          try {
            await razorpay.subscriptions.cancel(
              oldSubscription
                .razorpaySubscriptionId,
              false
            );

            console.log(
              "✅ Old Razorpay subscription cancelled"
            );

          } catch (error) {
            console.log(
              "⚠️ Razorpay cancellation:",
              error.message
            );
          }
        }

        // ==================================================
        // DATES FROM RAZORPAY
        // ==================================================

        const currentStart =
          subscriptionEntity?.current_start;

        const currentEnd =
          subscriptionEntity?.current_end;

        let startDate =
          currentStart
            ? new Date(
                Number(currentStart) * 1000
              )
            : new Date();

        let endDate =
          currentEnd
            ? new Date(
                Number(currentEnd) * 1000
              )
            : new Date(startDate);

        if (!currentEnd) {
          if (
            subscription.plan.billingCycle ===
            "MONTHLY"
          ) {
            endDate.setMonth(
              endDate.getMonth() + 1
            );
          }

          if (
            subscription.plan.billingCycle ===
            "YEARLY"
          ) {
            endDate.setFullYear(
              endDate.getFullYear() + 1
            );
          }
        }

        // ==================================================
        // DATABASE TRANSACTION
        // ==================================================

        return await prisma.$transaction(
          async (tx) => {

            // CANCEL OLD DB SUBSCRIPTION

            if (oldSubscription) {
              await tx.subscription.update({
                where: {
                  subscriptionId:
                    oldSubscription.subscriptionId,
                },

                data: {
                  status:
                    "CANCELLED",
                },
              });

              console.log(
                "✅ Old DB subscription cancelled"
              );
            }

            // ACTIVATE NEW SUBSCRIPTION

            const activated =
              await tx.subscription.update({
                where: {
                  subscriptionId:
                    subscription.subscriptionId,
                },

                data: {
                  status:
                    "ACTIVE",

                  startDate,

                  endDate,
                },

                include: {
                  plan: true,
                },
              });

            console.log(
              "🎉 New subscription activated"
            );

            return activated;
          }
        );
      };

    // ======================================================
    // SUBSCRIPTION AUTHENTICATED
    // ======================================================

    if (
      event ===
      "subscription.authenticated"
    ) {
      console.log(
        "🔐 SUBSCRIPTION AUTHENTICATED"
      );

      console.log(
        "⏳ Waiting for activation"
      );
    }

    // ======================================================
    // SUBSCRIPTION ACTIVATED
    // ======================================================

    else if (
      event ===
      "subscription.activated"
    ) {
      console.log(
        "🟢 SUBSCRIPTION ACTIVATED"
      );

      const subscription =
        await getSubscription(
          razorpaySubscriptionId
        );

      if (!subscription) {
        console.log(
          "❌ DB subscription not found"
        );
      } else {
        await activateNewSubscription(
          subscription
        );
      }
    }

    // ======================================================
    // SUBSCRIPTION CHARGED
    // ======================================================

    else if (
      event ===
      "subscription.charged"
    ) {
      console.log(
        "💰 SUBSCRIPTION CHARGED"
      );

      const subscription =
        await getSubscription(
          razorpaySubscriptionId
        );

      if (!subscription) {
        console.log(
          "❌ Subscription not found"
        );
      } else {

        // ================================================
        // UPDATE BILLING DATES
        // ================================================

        const currentStart =
          subscriptionEntity?.current_start;

        const currentEnd =
          subscriptionEntity?.current_end;

        if (
          currentStart &&
          currentEnd
        ) {
          await prisma.subscription.update({
            where: {
              subscriptionId:
                subscription.subscriptionId,
            },

            data: {
              status: "ACTIVE",

              startDate:
                new Date(
                  Number(currentStart) * 1000
                ),

              endDate:
                new Date(
                  Number(currentEnd) * 1000
                ),
            },
          });
        }

        // ================================================
        // SAVE PAYMENT
        // ================================================

        if (paymentEntity?.id) {

          const existing =
            await prisma.payment.findUnique({
              where: {
                razorpayPaymentId:
                  paymentEntity.id,
              },
            });

          if (!existing) {

            await prisma.payment.create({
              data: {
                tenantId:
                  subscription.tenantId,

                subscriptionId:
                  subscription.subscriptionId,

                amount:
                  String(
                    Number(
                      paymentEntity.amount
                    ) / 100
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

            console.log(
              "✅ Recurring payment saved"
            );
          }
        }
      }
    }

    // ======================================================
    // PAYMENT FAILED
    // ======================================================

    else if (
      event ===
      "payment.failed"
    ) {
      console.log(
        "❌ PAYMENT FAILED"
      );

      const subscription =
        await getSubscription(
          razorpaySubscriptionId
        );

      if (subscription) {
        await prisma.subscription.update({
          where: {
            subscriptionId:
              subscription.subscriptionId,
          },

          data: {
            status:
              "PAST_DUE",
          },
        });
      }
    }

    // ======================================================
    // SUBSCRIPTION HALTED
    // ======================================================

    else if (
      event ===
      "subscription.halted"
    ) {
      console.log(
        "🛑 SUBSCRIPTION HALTED"
      );

      const subscription =
        await getSubscription(
          razorpaySubscriptionId
        );

      if (subscription) {
        await prisma.subscription.update({
          where: {
            subscriptionId:
              subscription.subscriptionId,
          },

          data: {
            status:
              "SUSPENDED",
          },
        });
      }
    }

    // ======================================================
    // SUBSCRIPTION CANCELLED
    // ======================================================

    else if (
      event ===
      "subscription.cancelled"
    ) {
      console.log(
        "❌ SUBSCRIPTION CANCELLED"
      );

      const subscription =
        await getSubscription(
          razorpaySubscriptionId
        );

      if (subscription) {
        await prisma.subscription.update({
          where: {
            subscriptionId:
              subscription.subscriptionId,
            },

            data: {
              status:
                "CANCELLED",
            },
        });
      }
    }

    // ======================================================
    // UNKNOWN EVENT
    // ======================================================

    else {
      console.log(
        "ℹ️ Unhandled event:",
        event
      );
    }

    console.log(
      "======================================================"
    );

    console.log(
      "✅ WEBHOOK PROCESSED"
    );

    console.log(
      "======================================================\n"
    );

    return res.status(200).json({
      success: true,
      message:
        "Webhook processed",
    });

  } catch (error) {

    console.error(
      "❌ WEBHOOK ERROR:",
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
//     console.log("\n");
//     console.log(
//       "======================================================"
//     );
//     console.log("🚀 RAZORPAY WEBHOOK STARTED");
//     console.log(
//       "======================================================"
//     );

//     // ======================================================
//     // 1. GET SIGNATURE
//     // ======================================================

//     const signature =
//       req.headers["x-razorpay-signature"];

//     if (!signature) {
//       console.log(
//         "❌ Razorpay signature missing"
//       );

//       return res.status(400).json({
//         success: false,
//         message:
//           "Razorpay signature missing",
//       });
//     }

//     console.log(
//       "✅ Razorpay signature received"
//     );

//     // ======================================================
//     // 2. RAW BODY CHECK
//     // ======================================================

//     if (!Buffer.isBuffer(req.body)) {
//       console.log(
//         "❌ Raw webhook body is required"
//       );

//       return res.status(400).json({
//         success: false,
//         message:
//           "Raw webhook body is required",
//       });
//     }

//     console.log(
//       "✅ Raw webhook body available"
//     );

//     // ======================================================
//     // 3. VERIFY RAZORPAY SIGNATURE
//     // ======================================================

//     const expectedSignature =
//       crypto
//         .createHmac(
//           "sha256",
//           config.razorpay.keySecret
//         )
//         .update(req.body)
//         .digest("hex");

//     const receivedSignatureBuffer =
//       Buffer.from(
//         signature,
//         "utf8"
//       );

//     const expectedSignatureBuffer =
//       Buffer.from(
//         expectedSignature,
//         "utf8"
//       );

//     if (
//       receivedSignatureBuffer.length !==
//       expectedSignatureBuffer.length
//     ) {
//       console.log(
//         "❌ Invalid Razorpay signature"
//       );

//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid Razorpay webhook signature",
//       });
//     }

//     const isValid =
//       crypto.timingSafeEqual(
//         receivedSignatureBuffer,
//         expectedSignatureBuffer
//       );

//     if (!isValid) {
//       console.log(
//         "❌ Razorpay signature verification failed"
//       );

//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid Razorpay webhook signature",
//       });
//     }

//     console.log(
//       "✅ Razorpay signature verified"
//     );

//     // ======================================================
//     // 4. PARSE PAYLOAD
//     // ======================================================

//     const payload =
//       JSON.parse(
//         req.body.toString("utf8")
//       );

//     const event =
//       payload.event;

//     console.log(
//       "📌 Razorpay Event:",
//       event
//     );

//     // ======================================================
//     // 5. EXTRACT ENTITIES
//     // ======================================================

//     const subscriptionEntity =
//       payload.payload
//         ?.subscription
//         ?.entity;

//     const paymentEntity =
//       payload.payload
//         ?.payment
//         ?.entity;

//     const orderEntity =
//       payload.payload
//         ?.order
//         ?.entity;

//     const razorpaySubscriptionId =
//       subscriptionEntity?.id;

//     const razorpayPaymentId =
//       paymentEntity?.id;

//     const razorpayOrderId =
//       paymentEntity?.order_id ||
//       orderEntity?.id;

//     console.log(
//       "📌 Razorpay Subscription ID:",
//       razorpaySubscriptionId ||
//         "undefined"
//     );

//     console.log(
//       "📌 Razorpay Payment ID:",
//       razorpayPaymentId ||
//         "undefined"
//     );

//     console.log(
//       "📌 Razorpay Order ID:",
//       razorpayOrderId ||
//         "undefined"
//     );

//     // ======================================================
//     // HELPER 1
//     // GET DB SUBSCRIPTION
//     // ======================================================

//     const getDbSubscription =
//       async (
//         razorpaySubscriptionId
//       ) => {

//         if (
//           !razorpaySubscriptionId
//         ) {
//           return null;
//         }

//         return await prisma.subscription.findUnique({
//           where: {
//             razorpaySubscriptionId,
//           },

//           include: {
//             plan: true,
//           },
//         });
//       };

//     // ======================================================
//     // HELPER 2
//     // CANCEL OLD RAZORPAY SUBSCRIPTION
//     // ======================================================

//     const cancelOldRazorpaySubscription =
//       async (
//         oldSubscription
//       ) => {

//         if (
//           !oldSubscription
//             ?.razorpaySubscriptionId
//         ) {
//           console.log(
//             "ℹ️ Old Razorpay subscription ID not available"
//           );

//           return;
//         }

//         const oldRazorpayId =
//           oldSubscription
//             .razorpaySubscriptionId;

//         console.log(
//           "🔄 Cancelling old Razorpay subscription:",
//           oldRazorpayId
//         );

//         try {

//           await razorpay.subscriptions.cancel(
//             oldRazorpayId,
//             false
//           );

//           console.log(
//             "✅ Old Razorpay subscription cancelled"
//           );

//         } catch (error) {

//           console.error(
//             "⚠️ Old Razorpay subscription cancellation failed:",
//             error.message
//           );

//           /*
//            * If Razorpay says it is already cancelled/
//            * completed/expired, we don't want to crash
//            * the webhook.
//            *
//            * For any other error, throw it.
//            */

//           const message =
//             String(
//               error.message || ""
//             ).toLowerCase();

//           if (
//             message.includes(
//               "already been cancelled"
//             ) ||
//             message.includes(
//               "already cancelled"
//             ) ||
//             message.includes(
//               "expired"
//             ) ||
//             message.includes(
//               "completed"
//             )
//           ) {

//             console.log(
//               "ℹ️ Old Razorpay subscription is already inactive"
//             );

//             return;
//           }

//           throw error;
//         }
//       };

//     // ======================================================
//     // HELPER 3
//     // ACTIVATE NEW SUBSCRIPTION
//     // ======================================================

//     const activateSubscription =
//       async (
//         subscription
//       ) => {

//         if (!subscription) {
//           console.log(
//             "❌ Subscription not found"
//           );

//           return null;
//         }

//         console.log(
//           "\n======================================================"
//         );

//         console.log(
//           "🔄 ACTIVATING SUBSCRIPTION"
//         );

//         console.log(
//           "======================================================"
//         );

//         console.log(
//           "Subscription ID:",
//           subscription.subscriptionId
//         );

//         console.log(
//           "Tenant ID:",
//           subscription.tenantId
//         );

//         console.log(
//           "Plan:",
//           subscription.plan?.name
//         );

//         console.log(
//           "Plan Level:",
//           subscription.plan?.planLevel
//         );

//         console.log(
//           "Billing Cycle:",
//           subscription.plan?.billingCycle
//         );

//         console.log(
//           "Current DB Status:",
//           subscription.status
//         );

//         // ==================================================
//         // ALREADY ACTIVE
//         // ==================================================

//         if (
//           subscription.status ===
//           "ACTIVE"
//         ) {

//           console.log(
//             "ℹ️ Subscription already ACTIVE"
//           );

//           return subscription;
//         }

//         // ==================================================
//         // FIND OLD ACTIVE SUBSCRIPTION
//         // ==================================================

//         console.log(
//           "🔍 Finding old active subscription..."
//         );

//         const oldSubscription =
//           await prisma.subscription.findFirst({
//             where: {
//               tenantId:
//                 subscription.tenantId,

//               status:
//                 "ACTIVE",

//               NOT: {
//                 subscriptionId:
//                   subscription.subscriptionId,
//               },
//             },

//             include: {
//               plan: true,
//             },

//             orderBy: {
//               createdAt: "desc",
//             },
//           });

//         if (oldSubscription) {

//           console.log(
//             "✅ Old active subscription found"
//           );

//           console.log(
//             "Old DB Subscription:",
//             oldSubscription.subscriptionId
//           );

//           console.log(
//             "Old Plan:",
//             oldSubscription.plan?.name
//           );

//           console.log(
//             "Old Razorpay Subscription:",
//             oldSubscription.razorpaySubscriptionId ||
//               "undefined"
//           );

//         } else {

//           console.log(
//             "ℹ️ No old active subscription found"
//           );
//         }

//         // ==================================================
//         // CANCEL OLD RAZORPAY SUBSCRIPTION FIRST
//         // ==================================================

//         /*
//          * Important:
//          *
//          * We cancel the old Razorpay AutoPay before
//          * activating the new plan.
//          *
//          * Otherwise the customer could potentially
//          * continue getting charged for the old plan.
//          */

//         if (
//           oldSubscription
//         ) {

//           await cancelOldRazorpaySubscription(
//             oldSubscription
//           );
//         }

//         // ==================================================
//         // GET RAZORPAY PERIOD
//         // ==================================================

//         const razorpayCurrentStart =
//           subscriptionEntity
//             ?.current_start;

//         const razorpayCurrentEnd =
//           subscriptionEntity
//             ?.current_end;

//         let startDate;

//         let endDate;

//         if (
//           razorpayCurrentStart
//         ) {

//           startDate =
//             new Date(
//               Number(
//                 razorpayCurrentStart
//               ) * 1000
//             );

//         } else {

//           startDate =
//             new Date();
//         }

//         if (
//           razorpayCurrentEnd
//         ) {

//           endDate =
//             new Date(
//               Number(
//                 razorpayCurrentEnd
//               ) * 1000
//             );

//         } else {

//           /*
//            * Fallback only.
//            *
//            * Normally Razorpay gives current_end
//            * once the subscription is active.
//            */

//           endDate =
//             new Date(
//               startDate
//             );

//           if (
//             subscription.plan
//               ?.billingCycle ===
//             "MONTHLY"
//           ) {

//             endDate.setMonth(
//               endDate.getMonth() + 1
//             );

//           } else if (
//             subscription.plan
//               ?.billingCycle ===
//             "YEARLY"
//           ) {

//             endDate.setFullYear(
//               endDate.getFullYear() + 1
//             );
//           }
//         }

//         console.log(
//           "📅 Start Date:",
//           startDate
//         );

//         console.log(
//           "📅 End Date:",
//           endDate
//         );

//         // ==================================================
//         // DATABASE TRANSACTION
//         // ==================================================

//         const activatedSubscription =
//           await prisma.$transaction(
//             async (tx) => {

//               // ============================================
//               // CANCEL OLD DB SUBSCRIPTION
//               // ============================================

//               if (
//                 oldSubscription
//               ) {

//                 await tx.subscription.update({
//                   where: {
//                     subscriptionId:
//                       oldSubscription.subscriptionId,
//                   },

//                   data: {
//                     status:
//                       "CANCELLED",
//                   },
//                 });

//                 console.log(
//                   "✅ Old DB subscription CANCELLED"
//                 );
//               }

//               // ============================================
//               // ACTIVATE NEW SUBSCRIPTION
//               // ============================================

//               const updated =
//                 await tx.subscription.update({
//                   where: {
//                     subscriptionId:
//                       subscription.subscriptionId,
//                   },

//                   data: {
//                     status:
//                       "ACTIVE",

//                     startDate,

//                     endDate,
//                   },

//                   include: {
//                     plan: true,
//                   },
//                 });

//               console.log(
//                 "✅ New DB subscription ACTIVE"
//               );

//               return updated;
//             }
//           );

//         console.log(
//           "\n🎉 SUBSCRIPTION ACTIVATION COMPLETED"
//         );

//         console.log(
//           "Subscription ID:",
//           activatedSubscription.subscriptionId
//         );

//         console.log(
//           "Plan:",
//           activatedSubscription.plan?.name
//         );

//         console.log(
//           "Plan Level:",
//           activatedSubscription.plan?.planLevel
//         );

//         return activatedSubscription;
//       };

//     // ======================================================
//     // HELPER 4
//     // FIND UPGRADE PAYMENT
//     // ======================================================

//     const getUpgradePayment =
//       async (
//         subscriptionId
//       ) => {

//         return await prisma.payment.findFirst({
//           where: {
//             subscriptionId,

//             razorpayOrderId: {
//               not: null,
//             },
//           },

//           orderBy: {
//             createdAt: "desc",
//           },
//         });
//       };

//     // ======================================================
//     // HELPER 5
//     // ACTIVATE IF UPGRADE PAYMENT IS COMPLETE
//     // ======================================================

//     const activateIfReady =
//       async (
//         subscription
//       ) => {

//         if (!subscription) {
//           return null;
//         }

//         console.log(
//           "\n🔍 Checking whether subscription is ready..."
//         );

//         console.log(
//           "Subscription:",
//           subscription.subscriptionId
//         );

//         console.log(
//           "Plan:",
//           subscription.plan?.name
//         );

//         // ==================================================
//         // FIND ONE-TIME UPGRADE PAYMENT
//         // ==================================================

//         const upgradePayment =
//           await getUpgradePayment(
//             subscription.subscriptionId
//           );

//         // ==================================================
//         // NO ORDER PAYMENT
//         //
//         // This is FREE → PAID.
//         // ==================================================

//         if (
//           !upgradePayment
//         ) {

//           console.log(
//             "🆓 No upgrade Order found"
//           );

//           console.log(
//             "➡️ Treating as FREE → PAID"
//           );

//           return await activateSubscription(
//             subscription
//           );
//         }

//         // ==================================================
//         // UPGRADE PAYMENT FOUND
//         // ==================================================

//         console.log(
//           "💰 Upgrade payment found"
//         );

//         console.log(
//           "Payment ID:",
//           upgradePayment.paymentId
//         );

//         console.log(
//           "Order ID:",
//           upgradePayment.razorpayOrderId
//         );

//         console.log(
//           "Payment Amount:",
//           upgradePayment.amount
//         );

//         console.log(
//           "Payment Status:",
//           upgradePayment.status
//         );

//         // ==================================================
//         // PAYMENT NOT SUCCESS
//         // ==================================================

//         if (
//           upgradePayment.status !==
//           "SUCCESS"
//         ) {

//           console.log(
//             "⏳ Upgrade payment is not SUCCESS"
//           );

//           console.log(
//             "⛔ New subscription remains PENDING"
//           );

//           return null;
//         }

//         // ==================================================
//         // PAYMENT SUCCESS
//         // ==================================================

//         console.log(
//           "✅ Upgrade payment SUCCESS"
//         );

//         console.log(
//           "➡️ Activating new subscription..."
//         );

//         return await activateSubscription(
//           subscription
//         );
//       };

//     // ======================================================
//     // HELPER 6
//     // PROCESS ONE-TIME UPGRADE PAYMENT
//     // ======================================================

//     const processUpgradePayment =
//       async (
//         paymentEntity,
//         orderEntity
//       ) => {

//         if (!paymentEntity) {

//           console.log(
//             "⚠️ Payment entity missing"
//           );

//           return;
//         }

//         const orderId =
//           paymentEntity.order_id ||
//           orderEntity?.id;

//         const paymentId =
//           paymentEntity.id;

//         if (!orderId) {

//           console.log(
//             "ℹ️ Order ID missing"
//           );

//           console.log(
//             "This is probably a subscription payment"
//           );

//           return;
//         }

//         console.log(
//           "\n======================================================"
//         );

//         console.log(
//           "💰 PROCESSING ONE-TIME ORDER PAYMENT"
//         );

//         console.log(
//           "======================================================"
//         );

//         console.log(
//           "Razorpay Order ID:",
//           orderId
//         );

//         console.log(
//           "Razorpay Payment ID:",
//           paymentId
//         );

//         // ==================================================
//         // FIND OUR PAYMENT
//         // ==================================================

//         const dbPayment =
//           await prisma.payment.findUnique({
//             where: {
//               razorpayOrderId:
//                 orderId,
//             },
//           });

//         if (!dbPayment) {

//           console.log(
//             "ℹ️ No matching DB payment"
//           );

//           console.log(
//             "This Order does not belong to an upgrade"
//           );

//           return;
//         }

//         console.log(
//           "✅ Matching DB payment found"
//         );

//         console.log(
//           "DB Payment ID:",
//           dbPayment.paymentId
//         );

//         // ==================================================
//         // ALREADY SUCCESS
//         // ==================================================

//         if (
//           dbPayment.status ===
//           "SUCCESS"
//         ) {

//           console.log(
//             "ℹ️ Payment already SUCCESS"
//           );

//         } else {

//           // ================================================
//           // AMOUNT CHECK
//           // ================================================

//           const razorpayAmount =
//             Number(
//               paymentEntity.amount
//             ) / 100;

//           const databaseAmount =
//             Number(
//               dbPayment.amount
//             );

//           console.log(
//             "Razorpay Amount:",
//             razorpayAmount
//           );

//           console.log(
//             "Database Amount:",
//             databaseAmount
//           );

//           /*
//            * IMPORTANT:
//            *
//            * Never mark the payment SUCCESS if the amount
//            * received from Razorpay doesn't match the amount
//            * stored for this upgrade.
//            */

//           if (
//             Number(
//               razorpayAmount.toFixed(2)
//             ) !==
//             Number(
//               databaseAmount.toFixed(2)
//             )
//           ) {

//             console.error(
//               "❌ PAYMENT AMOUNT MISMATCH"
//             );

//             console.error(
//               "Expected:",
//               databaseAmount
//             );

//             console.error(
//               "Received:",
//               razorpayAmount
//             );

//             throw new Error(
//               "Razorpay payment amount mismatch"
//             );
//           }

//           // ================================================
//           // MARK PAYMENT SUCCESS
//           // ================================================

//           await prisma.payment.update({
//             where: {
//               paymentId:
//                 dbPayment.paymentId,
//             },

//             data: {
//               status:
//                 "SUCCESS",

//               razorpayPaymentId:
//                 paymentId,

//               paidAt:
//                 new Date(),
//             },
//           });

//           console.log(
//             "✅ Upgrade payment marked SUCCESS"
//           );
//         }

//         // ==================================================
//         // FIND LINKED SUBSCRIPTION
//         // ==================================================

//         const subscription =
//           await prisma.subscription.findUnique({
//             where: {
//               subscriptionId:
//                 dbPayment.subscriptionId,
//             },

//             include: {
//               plan: true,
//             },
//           });

//         if (!subscription) {

//           console.log(
//             "⚠️ Linked subscription not found"
//           );

//           return;
//         }

//         console.log(
//           "Linked Subscription:",
//           subscription.subscriptionId
//         );

//         console.log(
//           "Linked Plan:",
//           subscription.plan?.name
//         );

//         console.log(
//           "Linked Plan Level:",
//           subscription.plan?.planLevel
//         );

//         console.log(
//           "Subscription Status:",
//           subscription.status
//         );

//         // ==================================================
//         // IMPORTANT
//         //
//         // If Razorpay subscription has already been
//         // activated, activateSubscription() can safely
//         // continue because it checks ACTIVE.
//         // ==================================================

//         if (
//           subscription.status ===
//           "ACTIVE"
//         ) {

//           console.log(
//             "ℹ️ Subscription already ACTIVE"
//           );

//           return;
//         }

//         // ==================================================
//         // CHECK AUTO-PAY SUBSCRIPTION
//         // ==================================================

//         if (
//           !subscription
//             .razorpaySubscriptionId
//         ) {

//           console.log(
//             "⚠️ Razorpay subscription ID missing"
//           );

//           console.log(
//             "Payment is SUCCESS but AutoPay subscription is not ready"
//           );

//           return;
//         }

//         console.log(
//           "Razorpay AutoPay Subscription:",
//           subscription.razorpaySubscriptionId
//         );

//         /*
//          * We DO NOT activate here blindly.
//          *
//          * The new Razorpay Subscription must also have
//          * reached the activated state.
//          *
//          * subscription.activated will call the same
//          * activateIfReady() logic.
//          */

//         console.log(
//           "⏳ Waiting for subscription.activated"
//         );
//       };

//     // ======================================================
//     // 6. SUBSCRIPTION AUTHENTICATED
//     // ======================================================

//     if (
//       event ===
//       "subscription.authenticated"
//     ) {

//       console.log(
//         "\n======================================================"
//       );

//       console.log(
//         "🔐 SUBSCRIPTION AUTHENTICATED"
//       );

//       console.log(
//         "======================================================"
//       );

//       if (
//         !razorpaySubscriptionId
//       ) {

//         console.log(
//           "⚠️ Subscription ID missing"
//         );

//         return res.status(200).json({
//           success: true,
//           message:
//             "Webhook received",
//         });
//       }

//       const subscription =
//         await getDbSubscription(
//           razorpaySubscriptionId
//         );

//       if (!subscription) {

//         console.log(
//           "⚠️ Subscription not found in DB"
//         );

//         return res.status(200).json({
//           success: true,
//           message:
//             "Subscription not found",
//         });
//       }

//       console.log(
//         "Subscription:",
//         subscription.subscriptionId
//       );

//       console.log(
//         "Plan:",
//         subscription.plan?.name
//       );

//       console.log(
//         "Billing Cycle:",
//         subscription.plan?.billingCycle
//       );

//       console.log(
//         "Current DB Status:",
//         subscription.status
//       );

//       /*
//        * DO NOT activate here.
//        *
//        * Razorpay subscription.authenticated means
//        * the subscription has been authenticated.
//        *
//        * We wait for subscription.activated.
//        */

//       console.log(
//         "⏳ Keeping DB subscription PENDING"
//       );

//       console.log(
//         "➡️ Waiting for subscription.activated"
//       );
//     }

//     // ======================================================
//     // 7. SUBSCRIPTION ACTIVATED
//     // ======================================================

//     else if (
//       event ===
//       "subscription.activated"
//     ) {

//       console.log(
//         "\n======================================================"
//       );

//       console.log(
//         "🟢 SUBSCRIPTION ACTIVATED"
//       );

//       console.log(
//         "======================================================"
//       );

//       if (
//         !razorpaySubscriptionId
//       ) {

//         console.log(
//           "⚠️ Subscription ID missing"
//         );

//         return res.status(200).json({
//           success: true,
//           message:
//             "Webhook received",
//         });
//       }

//       const subscription =
//         await getDbSubscription(
//           razorpaySubscriptionId
//         );

//       if (!subscription) {

//         console.log(
//           "⚠️ Subscription not found in DB"
//         );

//         return res.status(200).json({
//           success: true,
//           message:
//             "Subscription not found",
//         });
//       }

//       console.log(
//         "Subscription ID:",
//         subscription.subscriptionId
//       );

//       console.log(
//         "Tenant ID:",
//         subscription.tenantId
//       );

//       console.log(
//         "Plan:",
//         subscription.plan?.name
//       );

//       console.log(
//         "Plan Level:",
//         subscription.plan?.planLevel
//       );

//       console.log(
//         "Billing Cycle:",
//         subscription.plan?.billingCycle
//       );

//       console.log(
//         "DB Status:",
//         subscription.status
//       );

//       // ==================================================
//       // CHECK WHETHER THIS IS PAID → PAID UPGRADE
//       // ==================================================

//       const upgradePayment =
//         await getUpgradePayment(
//           subscription.subscriptionId
//         );

//       if (
//         upgradePayment
//       ) {

//         console.log(
//           "\n💰 THIS IS A PAID → PAID UPGRADE"
//         );

//         console.log(
//           "Upgrade Payment ID:",
//           upgradePayment.paymentId
//         );

//         console.log(
//           "Upgrade Order ID:",
//           upgradePayment.razorpayOrderId
//         );

//         console.log(
//           "Upgrade Payment Status:",
//           upgradePayment.status
//         );

//         // ==============================================
//         // WAIT FOR ₹UPGRADE PAYMENT
//         // ==============================================

//         if (
//           upgradePayment.status !==
//           "SUCCESS"
//         ) {

//           console.log(
//             "⏳ One-time upgrade payment not completed"
//           );

//           console.log(
//             "⛔ New plan remains PENDING"
//           );

//           return;
//         }

//         console.log(
//           "✅ One-time upgrade payment already SUCCESS"
//         );
//       }

//       // ==================================================
//       // ACTIVATE
//       // ==================================================

//       await activateSubscription(
//         subscription
//       );
//     }

//     // ======================================================
//     // 8. ORDER PAID
//     // ======================================================

//     else if (
//       event ===
//       "order.paid"
//     ) {

//       console.log(
//         "\n======================================================"
//       );

//       console.log(
//         "💰 ORDER PAID"
//       );

//       console.log(
//         "======================================================"
//       );

//       /*
//        * Razorpay order.paid payload contains payment
//        * and order entities.
//        *
//        * This is the important event for the one-time
//        * prorated upgrade amount.
//        */

//       await processUpgradePayment(
//         paymentEntity,
//         orderEntity
//       );

//       /*
//        * IMPORTANT:
//        *
//        * processUpgradePayment() marks the Order payment
//        * SUCCESS.
//        *
//        * We then check whether Razorpay has already sent
//        * subscription.activated.
//        *
//        * If it has already activated, the DB subscription
//        * can now be activated.
//        */

//       if (
//         paymentEntity?.order_id
//       ) {

//         const dbPayment =
//           await prisma.payment.findUnique({
//             where: {
//               razorpayOrderId:
//                 paymentEntity.order_id,
//             },
//           });

//         if (
//           dbPayment
//         ) {

//           const subscription =
//             await prisma.subscription.findUnique({
//               where: {
//                 subscriptionId:
//                   dbPayment.subscriptionId,
//               },

//               include: {
//                 plan: true,
//               },
//             });

//           if (
//             subscription &&
//             subscription.status !==
//               "ACTIVE"
//           ) {

//             /*
//              * Only activate if Razorpay subscription
//              * itself is already ACTIVE.
//              *
//              * We don't trust the DB alone.
//              */

//             if (
//               subscriptionEntity
//                 ?.status ===
//               "active"
//             ) {

//               console.log(
//                 "🟢 Razorpay subscription already ACTIVE"
//               );

//               await activateSubscription(
//                 subscription
//               );

//             } else {

//               console.log(
//                 "⏳ Razorpay AutoPay subscription is not ACTIVE yet"
//               );

//               console.log(
//                 "➡️ Waiting for subscription.activated"
//               );
//             }
//           }
//         }
//       }
//     }

//     // ======================================================
//     // 9. PAYMENT CAPTURED
//     // ======================================================

//     else if (
//       event ===
//       "payment.captured"
//     ) {

//       console.log(
//         "\n======================================================"
//       );

//       console.log(
//         "💳 PAYMENT CAPTURED"
//       );

//       console.log(
//         "======================================================"
//       );

//       /*
//        * payment.captured and order.paid are both
//        * capture signals for an Order payment.
//        *
//        * Our DB payment update is idempotent.
//        */

//       await processUpgradePayment(
//         paymentEntity,
//         null
//       );

//       if (
//         paymentEntity?.order_id
//       ) {

//         const dbPayment =
//           await prisma.payment.findUnique({
//             where: {
//               razorpayOrderId:
//                 paymentEntity.order_id,
//             },
//           });

//         if (
//           dbPayment
//         ) {

//           const subscription =
//             await prisma.subscription.findUnique({
//               where: {
//                 subscriptionId:
//                   dbPayment.subscriptionId,
//               },

//               include: {
//                 plan: true,
//               },
//             });

//           if (
//             subscription &&
//             subscription.status !==
//               "ACTIVE"
//           ) {

//             /*
//              * If the subscription webhook already arrived
//              * and Razorpay says active, activate.
//              *
//              * Otherwise wait for subscription.activated.
//              */

//             if (
//               subscriptionEntity
//                 ?.status ===
//               "active"
//             ) {

//               await activateSubscription(
//                 subscription
//               );

//             } else {

//               console.log(
//                 "⏳ Waiting for subscription.activated"
//               );
//             }
//           }
//         }
//       }
//     }

//     // ======================================================
//     // 10. PAYMENT AUTHORIZED
//     // ======================================================

//     else if (
//       event ===
//       "payment.authorized"
//     ) {

//       console.log(
//         "\n======================================================"
//       );

//       console.log(
//         "🔐 PAYMENT AUTHORIZED"
//       );

//       console.log(
//         "======================================================"
//       );

//       console.log(
//         "Payment ID:",
//         razorpayPaymentId ||
//           "undefined"
//       );

//       console.log(
//         "Order ID:",
//         razorpayOrderId ||
//           "undefined"
//       );

//       /*
//        * Do NOT mark the upgrade payment SUCCESS here.
//        *
//        * We wait for order.paid/payment.captured.
//        */

//       console.log(
//         "⏳ Waiting for payment capture"
//       );
//     }

//     // ======================================================
//     // 11. PAYMENT FAILED
//     // ======================================================

//     else if (
//       event ===
//       "payment.failed"
//     ) {

//       console.log(
//         "\n======================================================"
//       );

//       console.log(
//         "❌ PAYMENT FAILED"
//       );

//       console.log(
//         "======================================================"
//       );

//       if (
//         paymentEntity?.order_id
//       ) {

//         const dbPayment =
//           await prisma.payment.findUnique({
//             where: {
//               razorpayOrderId:
//                 paymentEntity.order_id,
//             },
//           });

//         if (
//           dbPayment
//         ) {

//           await prisma.payment.update({
//             where: {
//               paymentId:
//                 dbPayment.paymentId,
//             },

//             data: {
//               status:
//                 "FAILED",
//             },
//           });

//           console.log(
//             "✅ Upgrade payment marked FAILED"
//           );
//         }
//       }
//     }

//     // ======================================================
//     // 12. SUBSCRIPTION CHARGED
//     // ======================================================

//     else if (
//       event ===
//       "subscription.charged"
//     ) {

//       console.log(
//         "\n======================================================"
//       );

//       console.log(
//         "💰 SUBSCRIPTION CHARGED"
//       );

//       console.log(
//         "======================================================"
//       );

//       if (
//         !razorpaySubscriptionId
//       ) {

//         console.log(
//           "⚠️ Subscription ID missing"
//         );

//         return res.status(200).json({
//           success: true,
//           message:
//             "Webhook received",
//         });
//       }

//       const subscription =
//         await getDbSubscription(
//           razorpaySubscriptionId
//         );

//       if (!subscription) {

//         console.log(
//           "⚠️ Subscription not found"
//         );

//         return res.status(200).json({
//           success: true,
//           message:
//             "Subscription not found",
//         });
//       }

//       console.log(
//         "Subscription ID:",
//         subscription.subscriptionId
//       );

//       console.log(
//         "Tenant ID:",
//         subscription.tenantId
//       );

//       console.log(
//         "Plan:",
//         subscription.plan?.name
//       );

//       console.log(
//         "Plan Level:",
//         subscription.plan?.planLevel
//       );

//       console.log(
//         "Billing Cycle:",
//         subscription.plan?.billingCycle
//       );

//       console.log(
//         "Razorpay Payment ID:",
//         razorpayPaymentId ||
//           "undefined"
//       );

//       // ==================================================
//       // USE RAZORPAY BILLING PERIOD
//       // ==================================================

//       let startDate;

//       let endDate;

//       if (
//         subscriptionEntity
//           ?.current_start
//       ) {

//         startDate =
//           new Date(
//             Number(
//               subscriptionEntity
//                 .current_start
//             ) * 1000
//           );

//       } else {

//         startDate =
//           new Date();
//       }

//       if (
//         subscriptionEntity
//           ?.current_end
//       ) {

//         endDate =
//           new Date(
//             Number(
//               subscriptionEntity
//                 .current_end
//             ) * 1000
//           );

//       } else {

//         endDate =
//           new Date(
//             startDate
//           );

//         if (
//           subscription.plan
//             ?.billingCycle ===
//           "MONTHLY"
//         ) {

//           endDate.setMonth(
//             endDate.getMonth() + 1
//           );

//         } else if (
//           subscription.plan
//             ?.billingCycle ===
//           "YEARLY"
//         ) {

//           endDate.setFullYear(
//             endDate.getFullYear() + 1
//           );
//         }
//       }

//       console.log(
//         "Razorpay Current Start:",
//         startDate
//       );

//       console.log(
//         "Razorpay Current End:",
//         endDate
//       );

//       // ==================================================
//       // UPDATE SUBSCRIPTION PERIOD
//       // ==================================================

//       await prisma.subscription.update({
//         where: {
//           subscriptionId:
//             subscription.subscriptionId,
//         },

//         data: {
//           status:
//             "ACTIVE",

//           startDate,

//           endDate,
//         },
//       });

//       console.log(
//         "✅ Subscription billing period updated"
//       );

//       // ==================================================
//       // CREATE / UPDATE RECURRING PAYMENT
//       // ==================================================

//       if (
//         paymentEntity?.id
//       ) {

//         const paymentAmount =
//           Number(
//             paymentEntity.amount
//           ) / 100;

//         const currency =
//           paymentEntity.currency ||
//           "INR";

//         console.log(
//           "\n💳 RECURRING AUTOPAY PAYMENT"
//         );

//         console.log(
//           "Payment ID:",
//           paymentEntity.id
//         );

//         console.log(
//           "Amount:",
//           paymentAmount
//         );

//         console.log(
//           "Currency:",
//           currency
//         );

//         // ==================================================
//         // CHECK DUPLICATE
//         // ==================================================

//         const existingPayment =
//           await prisma.payment.findUnique({
//             where: {
//               razorpayPaymentId:
//                 paymentEntity.id,
//             },
//           });

//         if (
//           existingPayment
//         ) {

//           console.log(
//             "ℹ️ Recurring payment already exists"
//           );

//           if (
//             existingPayment.status !==
//             "SUCCESS"
//           ) {

//             await prisma.payment.update({
//               where: {
//                 paymentId:
//                   existingPayment.paymentId,
//               },

//               data: {
//                 status:
//                   "SUCCESS",

//                 paidAt:
//                   new Date(),

//                 razorpaySubscriptionId:
//                   razorpaySubscriptionId,
//               },
//             });

//             console.log(
//               "✅ Existing payment marked SUCCESS"
//             );
//           }

//         } else {

//           const newPayment =
//             await prisma.payment.create({
//               data: {
//                 tenantId:
//                   subscription.tenantId,

//                 subscriptionId:
//                   subscription.subscriptionId,

//                 amount:
//                   String(
//                     paymentAmount
//                   ),

//                 currency,

//                 status:
//                   "SUCCESS",

//                 razorpayPaymentId:
//                   paymentEntity.id,

//                 razorpaySubscriptionId:
//                   razorpaySubscriptionId,

//                 paidAt:
//                   new Date(),
//               },
//             });

//           console.log(
//             "✅ Recurring payment created"
//           );

//           console.log(
//             "Payment ID:",
//             newPayment.paymentId
//           );
//         }
//       }

//       console.log(
//         "\n🎉 RECURRING AUTOPAY COMPLETED"
//       );
//     }

//     // ======================================================
//     // 13. SUBSCRIPTION PENDING
//     // ======================================================

//     else if (
//       event ===
//       "subscription.pending"
//     ) {

//       console.log(
//         "\n======================================================"
//       );

//       console.log(
//         "⚠️ SUBSCRIPTION PENDING"
//       );

//       console.log(
//         "======================================================"
//       );

//       if (
//         razorpaySubscriptionId
//       ) {

//         const subscription =
//           await prisma.subscription.findUnique({
//             where: {
//               razorpaySubscriptionId,
//             },
//           });

//         if (
//           subscription
//         ) {

//           /*
//            * Only change an ACTIVE subscription to PAST_DUE.
//            *
//            * If it is a new upgrade subscription still waiting
//            * for activation, keep it PENDING.
//            */

//           if (
//             subscription.status ===
//             "ACTIVE"
//           ) {

//             await prisma.subscription.update({
//               where: {
//                 subscriptionId:
//                   subscription.subscriptionId,
//               },

//               data: {
//                 status:
//                   "PAST_DUE",
//               },
//             });

//             console.log(
//               "⚠️ Active subscription marked PAST_DUE"
//             );

//           } else {

//             console.log(
//               "ℹ️ Subscription is not ACTIVE"
//             );

//             console.log(
//               "Current status:",
//               subscription.status
//             );
//           }
//         }
//       }
//     }

//     // ======================================================
//     // 14. SUBSCRIPTION HALTED
//     // ======================================================

//     else if (
//       event ===
//       "subscription.halted"
//     ) {

//       console.log(
//         "\n======================================================"
//       );

//       console.log(
//         "🛑 SUBSCRIPTION HALTED"
//       );

//       console.log(
//         "======================================================"
//       );

//       if (
//         razorpaySubscriptionId
//       ) {

//         const subscription =
//           await prisma.subscription.findUnique({
//             where: {
//               razorpaySubscriptionId,
//             },
//           });

//         if (
//           subscription
//         ) {

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
//             "✅ Subscription marked SUSPENDED"
//           );
//         }
//       }
//     }

//     // ======================================================
//     // 15. SUBSCRIPTION CANCELLED
//     // ======================================================

//     else if (
//       event ===
//       "subscription.cancelled"
//     ) {

//       console.log(
//         "\n======================================================"
//       );

//       console.log(
//         "❌ SUBSCRIPTION CANCELLED"
//       );

//       console.log(
//         "======================================================"
//       );

//       if (
//         razorpaySubscriptionId
//       ) {

//         const subscription =
//           await prisma.subscription.findUnique({
//             where: {
//               razorpaySubscriptionId,
//             },
//           });

//         if (
//           subscription
//         ) {

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
//             "✅ Subscription marked CANCELLED"
//           );
//         }
//       }
//     }

//     // ======================================================
//     // 16. SUBSCRIPTION COMPLETED
//     // ======================================================

//     else if (
//       event ===
//       "subscription.completed"
//     ) {

//       console.log(
//         "\n======================================================"
//       );

//       console.log(
//         "🏁 SUBSCRIPTION COMPLETED"
//       );

//       console.log(
//         "======================================================"
//       );

//       if (
//         razorpaySubscriptionId
//       ) {

//         const subscription =
//           await prisma.subscription.findUnique({
//             where: {
//               razorpaySubscriptionId,
//             },
//           });

//         if (
//           subscription
//         ) {

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
//             "✅ Subscription marked EXPIRED"
//           );
//         }
//       }
//     }

//     // ======================================================
//     // 17. UNKNOWN EVENT
//     // ======================================================

//     else {

//       console.log(
//         "\n======================================================"
//       );

//       console.log(
//         "ℹ️ UNKNOWN RAZORPAY EVENT"
//       );

//       console.log(
//         "======================================================"
//       );

//       console.log(
//         "Event:",
//         event
//       );
//     }

//     // ======================================================
//     // FINAL RESPONSE
//     // ======================================================

//     console.log(
//       "\n======================================================"
//     );

//     console.log(
//       "✅ RAZORPAY WEBHOOK PROCESSED"
//     );

//     console.log(
//       "Event:",
//       event
//     );

//     console.log(
//       "======================================================\n"
//     );

//     return res.status(200).json({
//       success: true,
//       message:
//         "Webhook processed successfully",
//     });

//   } catch (error) {

//     console.error(
//       "\n======================================================"
//     );

//     console.error(
//       "❌ RAZORPAY WEBHOOK ERROR"
//     );

//     console.error(
//       "======================================================"
//     );

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
//       message:
//         "Webhook processing failed",
//     });
//   }
// };


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