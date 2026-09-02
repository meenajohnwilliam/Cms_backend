// controllers/subscription.controller.js

const prisma = require("../config/prisma");
const crypto = require("crypto");
const config = require("../config/config");
const { razorpay } = require("../utils/services/razorpay.service");



// ============================================================
// RAZORPAY
// ============================================================

const razorpay = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

// ============================================================
// CONFIG
// ============================================================

const RAZORPAY_KEY_ID = config.razorpay.keyId;
const RAZORPAY_WEBHOOK_SECRET = config.razorpay.keySecret

// ============================================================
// MONEY HELPERS
// ============================================================

const roundMoney = (amount) => {
  return Math.round(Number(amount) * 100) / 100;
};

const rupeesToPaise = (amount) => {
  return Math.round(Number(amount) * 100);
};

// ============================================================
// DATE HELPERS
// ============================================================

const addBillingCycle = (date, billingCycle) => {
  const newDate = new Date(date);

  if (billingCycle === "MONTHLY") {
    newDate.setMonth(newDate.getMonth() + 1);
  }

  if (billingCycle === "YEARLY") {
    newDate.setFullYear(newDate.getFullYear() + 1);
  }

  return newDate;
};

const getUnixTimestamp = (date) => {
  return Math.floor(
    new Date(date).getTime() / 1000
  );
};

// ============================================================
// GET TOTAL RAZORPAY BILLING COUNT
// ============================================================

const getTotalCount = (billingCycle) => {
  if (billingCycle === "MONTHLY") {
    return 120;
  }

  if (billingCycle === "YEARLY") {
    return 10;
  }

  throw new Error("Invalid billing cycle");
};

// ============================================================
// GET ACTIVE SUBSCRIPTION
// ============================================================

const getCurrentSubscriptions = async (tenantId) => {
  return prisma.subscription.findFirst({
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
};

// ============================================================
// GET PENDING SUBSCRIPTION
// ============================================================

const getPendingSubscription = async (tenantId) => {
  return prisma.subscription.findFirst({
    where: {
      tenantId,
      status: "PENDING",
    },

    include: {
      plan: true,
    },

    orderBy: {
      createdAt: "desc",
    },
  });
};

// ============================================================
// CALCULATE UNUSED CREDIT
// ============================================================

const calculateUnusedCredit = (subscription) => {
  if (!subscription) {
    return {
      totalDays: 0,
      remainingDays: 0,
      unusedCredit: 0,
    };
  }

  const now = new Date();

  const startDate = new Date(
    subscription.startDate
  );

  const endDate = new Date(
    subscription.endDate
  );

  if (now >= endDate) {
    return {
      totalDays: 0,
      remainingDays: 0,
      unusedCredit: 0,
    };
  }

  const ONE_DAY =
    1000 * 60 * 60 * 24;

  const totalDays = Math.max(
    1,
    Math.ceil(
      (endDate.getTime() -
        startDate.getTime()) /
        ONE_DAY
    )
  );

  const remainingDays = Math.max(
    0,
    Math.ceil(
      (endDate.getTime() -
        now.getTime()) /
        ONE_DAY
    )
  );

  // IMPORTANT:
  // Use the SNAPSHOT PRICE stored on subscription
  // if you have one.
  //
  // If you do not have subscriptionPrice,
  // it will use plan.price.

  const currentPlanPrice =
    subscription.subscriptionPrice
      ? Number(
          subscription.subscriptionPrice
        )
      : Number(subscription.plan.price);

  const unusedCredit = roundMoney(
    (currentPlanPrice *
      remainingDays) /
      totalDays
  );

  return {
    totalDays,
    remainingDays,
    unusedCredit,
  };
};

// ============================================================
// CALCULATE EXACT AMOUNT TO PAY TODAY
// ============================================================

const calculateAmountDue = ({
  newPlanPrice,
  unusedCredit = 0,
}) => {
  const price =
    Number(newPlanPrice);

  const credit =
    Number(unusedCredit);

  const amountDue =
    Math.max(
      0,
      roundMoney(price - credit)
    );

  return {
    newPlanPrice: price,
    unusedCredit: credit,
    amountDue,
  };
};

// ============================================================
// CHECK IF PLAN IS AN UPGRADE
// ============================================================

const validateUpgrade = ({
  currentPlan,
  newPlan,
}) => {
  if (!currentPlan) {
    return;
  }

  if (
    currentPlan.planId ===
    newPlan.planId
  ) {
    throw new Error(
      "You are already using this plan"
    );
  }

  if (
    Number(newPlan.planLevel) <=
    Number(currentPlan.planLevel)
  ) {
    throw new Error(
      "Selected plan is not an upgrade"
    );
  }

  // ==========================================================
  // BLOCK YEARLY → MONTHLY
  // ==========================================================

  if (
    currentPlan.billingCycle ===
      "YEARLY" &&
    newPlan.billingCycle ===
      "MONTHLY"
  ) {
    throw new Error(
      "Yearly to monthly downgrade is not allowed immediately"
    );
  }
};

// ============================================================
// CREATE RAZORPAY SUBSCRIPTION
// ============================================================

const createRazorpaySubscription = async ({
  tenantId,
  localSubscriptionId,
  plan,
  upgradeType,
  amountDueToday = 0,
  oldSubscriptionId = null,
}) => {
  if (!plan.razorpayPlanId) {
    throw new Error(
      "Razorpay Plan ID is missing for this plan"
    );
  }

  const payload = {
    plan_id:
      plan.razorpayPlanId,

    total_count:
      getTotalCount(
        plan.billingCycle
      ),

    quantity: 1,

    customer_notify: true,

    notes: {
      tenantId,
      localSubscriptionId,
      upgradeType,
      oldSubscriptionId:
        oldSubscriptionId || "",
    },
  };

  // ==========================================================
  // CASE 1: FREE → PAID
  // ==========================================================
  //
  // DO NOT ADD ADDON
  //
  // Razorpay will charge the normal plan amount
  // because the subscription starts immediately.
  //
  // Example:
  //
  // Starter Monthly = ₹649
  //
  // Today = ₹649
  // Next Month = ₹649
  //
  // ==========================================================

  if (
    upgradeType ===
    "FREE_TO_PAID"
  ) {
    return razorpay.subscriptions.create(
      payload
    );
  }

  // ==========================================================
  // CASE 2: PAID → PAID
  // ==========================================================
  //
  // Example:
  //
  // Pro Monthly = ₹999
  // Credit = ₹200
  //
  // Today = ₹799
  //
  // We create a FUTURE subscription start.
  //
  // So Razorpay DOES NOT charge ₹999 today.
  //
  // Instead:
  //
  // ADDON ₹799 is collected today.
  //
  // At the future start date:
  //
  // ₹999/month AutoPay begins.
  //
  // ==========================================================

  if (
    upgradeType ===
    "PAID_TO_PAID"
  ) {
    // --------------------------------------------------------
    // NEW PLAN ACCESS PERIOD STARTS NOW
    // --------------------------------------------------------

    const now = new Date();

    // --------------------------------------------------------
    // RAZORPAY RECURRING BILLING STARTS
    // AFTER THE NEW PLAN'S FIRST PERIOD
    // --------------------------------------------------------

    const futureStartDate =
      addBillingCycle(
        now,
        plan.billingCycle
      );

    payload.start_at =
      getUnixTimestamp(
        futureStartDate
      );

    // --------------------------------------------------------
    // EXACT AMOUNT TO COLLECT TODAY
    // --------------------------------------------------------

    if (
      Number(amountDueToday) > 0
    ) {
      payload.addons = [
        {
          item: {
            name:
              "Subscription Upgrade",

            amount:
              rupeesToPaise(
                amountDueToday
              ),

            currency: "INR",

            description:
              "Upgrade amount after unused plan credit",
          },
        },
      ];
    }

    return razorpay.subscriptions.create(
      payload
    );
  }

  throw new Error(
    "Invalid upgrade type"
  );
};

// ============================================================
// CREATE UPGRADE
// ============================================================

const upgradeSubscription = async (
  req,
  res
) => {
  try {
    const {
      tenantId,
      planId,
    } = req.body;

    // ========================================================
    // VALIDATION
    // ========================================================

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message:
          "tenantId is required",
      });
    }

    if (!planId) {
      return res.status(400).json({
        success: false,
        message:
          "planId is required",
      });
    }

    // ========================================================
    // CHECK TENANT
    // ========================================================

    const tenant =
      await prisma.tenant.findUnique({
        where: {
          tenantId,
        },
      });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message:
          "Tenant not found",
      });
    }

    // ========================================================
    // GET NEW PLAN
    // ========================================================

    const newPlan =
      await prisma.plan.findUnique({
        where: {
          planId,
        },
      });

    if (!newPlan) {
      return res.status(404).json({
        success: false,
        message:
          "Selected plan not found",
      });
    }

    if (!newPlan.isActive) {
      return res.status(400).json({
        success: false,
        message:
          "Selected plan is inactive",
      });
    }

    if (
      newPlan.type !== "PAID"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You can only upgrade to a paid plan",
      });
    }

    if (
      !newPlan.razorpayPlanId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay Plan ID is missing",
      });
    }

    // ========================================================
    // CHECK EXISTING PENDING UPGRADE
    // ========================================================

    const existingPending =
      await getPendingSubscription(
        tenantId
      );

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message:
          "You already have a pending subscription. Complete or cancel it before creating another upgrade.",
      });
    }

    // ========================================================
    // GET CURRENT SUBSCRIPTION
    // ========================================================

    const currentSubscription =
      await getCurrentSubscriptions(
        tenantId
      );

    // ========================================================
    // CASE:
    // FREE → PAID
    // ========================================================

    if (!currentSubscription) {
      const upgradeType =
        "FREE_TO_PAID";

      const newPlanPrice =
        Number(newPlan.price);

      // ------------------------------------------------------
      // CREATE LOCAL PENDING SUBSCRIPTION
      // ------------------------------------------------------

      const localSubscription =
        await prisma.subscription.create({
          data: {
            tenantId,

            planId:
              newPlan.planId,

            billingCycle:
              newPlan.billingCycle,

            status:
              "PENDING",

            // Will be updated by webhook
            startDate:
              new Date(),

            endDate:
              addBillingCycle(
                new Date(),
                newPlan.billingCycle
              ),

            // Snapshot price if your schema has this field
            // Remove this line if not present.
            subscriptionPrice:
              newPlanPrice,
          },
        });

      // ------------------------------------------------------
      // CREATE RAZORPAY SUBSCRIPTION
      // ------------------------------------------------------

      const razorpaySubscription =
        await createRazorpaySubscription({
          tenantId,

          localSubscriptionId:
            localSubscription.subscriptionId,

          plan: newPlan,

          upgradeType,

          amountDueToday: 0,
        });

      // ------------------------------------------------------
      // SAVE RAZORPAY ID
      // ------------------------------------------------------

      await prisma.subscription.update({
        where: {
          subscriptionId:
            localSubscription.subscriptionId,
        },

        data: {
          razorpaySubscriptionId:
            razorpaySubscription.id,
        },
      });

      return res.status(201).json({
        success: true,

        message:
          "Subscription created successfully",

        upgradeType,

        paymentSummary: {
          payToday:
            newPlanPrice,

          unusedCredit: 0,

          futureAutoPay:
            newPlanPrice,

          billingCycle:
            newPlan.billingCycle,
        },

        razorpay: {
          keyId:
            RAZORPAY_KEY_ID,

          subscriptionId:
            razorpaySubscription.id,
        },
      });
    }

    // ========================================================
    // CASE:
    // PAID → PAID
    // ========================================================

    const currentPlan =
      currentSubscription.plan;

    // --------------------------------------------------------
    // VALIDATE UPGRADE
    // --------------------------------------------------------

    validateUpgrade({
      currentPlan,
      newPlan,
    });

    // --------------------------------------------------------
    // CALCULATE OLD PLAN CREDIT
    // --------------------------------------------------------

    const credit =
      calculateUnusedCredit(
        currentSubscription
      );

    // --------------------------------------------------------
    // CALCULATE TODAY'S AMOUNT
    // --------------------------------------------------------

    const calculation =
      calculateAmountDue({
        newPlanPrice:
          newPlan.price,

        unusedCredit:
          credit.unusedCredit,
      });

    // --------------------------------------------------------
    // CREATE NEW PENDING LOCAL SUBSCRIPTION
    // --------------------------------------------------------

    const now = new Date();

    const newPlanEndDate =
      addBillingCycle(
        now,
        newPlan.billingCycle
      );

    const localSubscription =
      await prisma.subscription.create({
        data: {
          tenantId,

          planId:
            newPlan.planId,

          billingCycle:
            newPlan.billingCycle,

          status:
            "PENDING",

          // New plan period starts NOW in your application
          startDate: now,

          endDate:
            newPlanEndDate,

          // Snapshot price
          subscriptionPrice:
            Number(newPlan.price),
        },
      });

    // --------------------------------------------------------
    // CREATE RAZORPAY SUBSCRIPTION
    // --------------------------------------------------------

    const razorpaySubscription =
      await createRazorpaySubscription({
        tenantId,

        localSubscriptionId:
          localSubscription.subscriptionId,

        plan: newPlan,

        upgradeType:
          "PAID_TO_PAID",

        amountDueToday:
          calculation.amountDue,

        oldSubscriptionId:
          currentSubscription.subscriptionId,
      });

    // --------------------------------------------------------
    // SAVE RAZORPAY SUBSCRIPTION ID
    // --------------------------------------------------------

    await prisma.subscription.update({
      where: {
        subscriptionId:
          localSubscription.subscriptionId,
      },

      data: {
        razorpaySubscriptionId:
          razorpaySubscription.id,
      },
    });

    return res.status(201).json({
      success: true,

      message:
        "Upgrade created successfully. Complete Razorpay Checkout.",

      upgradeType:
        "PAID_TO_PAID",

      currentPlan: {
        name:
          currentPlan.name,

        price:
          Number(
            currentPlan.price
          ),

        billingCycle:
          currentPlan.billingCycle,
      },

      newPlan: {
        name:
          newPlan.name,

        price:
          Number(
            newPlan.price
          ),

        billingCycle:
          newPlan.billingCycle,
      },

      calculation: {
        oldPlanRemainingDays:
          credit.remainingDays,

        unusedCredit:
          calculation.unusedCredit,

        newPlanPrice:
          calculation.newPlanPrice,

        payToday:
          calculation.amountDue,

        futureAutoPay:
          Number(newPlan.price),

        nextBillingDate:
          newPlanEndDate,
      },

      razorpay: {
        keyId:
          RAZORPAY_KEY_ID,

        subscriptionId:
          razorpaySubscription.id,
      },
    });
  } catch (error) {
    console.error(
      "UPGRADE SUBSCRIPTION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to upgrade subscription",
    });
  }
};

// ============================================================
// ACTIVATE LOCAL SUBSCRIPTION
// ============================================================

const activateLocalSubscription = async (
  razorpaySubscriptionId,
  eventType
) => {
  const newSubscription =
    await prisma.subscription.findUnique({
      where: {
        razorpaySubscriptionId,
      },

      include: {
        plan: true,
      },
    });

  if (!newSubscription) {
    console.log(
      "LOCAL SUBSCRIPTION NOT FOUND:",
      razorpaySubscriptionId
    );

    return;
  }

  // Already active
  if (
    newSubscription.status ===
    "ACTIVE"
  ) {
    return;
  }

  // ==========================================================
  // FIND OLD ACTIVE SUBSCRIPTION
  // ==========================================================

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

  // ==========================================================
  // ACTIVATE NEW SUBSCRIPTION
  // ==========================================================

  await prisma.$transaction(
    async (tx) => {
      // ------------------------------------------------------
      // CANCEL OLD LOCAL SUBSCRIPTION
      // ------------------------------------------------------

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
      }

      // ------------------------------------------------------
      // ACTIVATE NEW SUBSCRIPTION
      // ------------------------------------------------------

      await tx.subscription.update({
        where: {
          subscriptionId:
            newSubscription.subscriptionId,
        },

        data: {
          status:
            "ACTIVE",
        },
      });

      // ------------------------------------------------------
      // UPDATE TENANT
      // ------------------------------------------------------

      await tx.tenant.update({
        where: {
          tenantId:
            newSubscription.tenantId,
        },

        data: {
          selectedPlanId:
            newSubscription.planId,

          selectedBillingCycle:
            newSubscription.billingCycle,

          status:
            "ACTIVE",
        },
      });
    }
  );

  // ==========================================================
  // CANCEL OLD RAZORPAY SUBSCRIPTION
  // ==========================================================

  if (
    oldSubscription?.razorpaySubscriptionId
  ) {
    try {
      await razorpay.subscriptions.cancel(
        oldSubscription.razorpaySubscriptionId,
        false
      );

      console.log(
        "OLD RAZORPAY SUBSCRIPTION CANCELLED:",
        oldSubscription.razorpaySubscriptionId
      );
    } catch (error) {
      console.error(
        "FAILED TO CANCEL OLD RAZORPAY SUBSCRIPTION:",
        error.message
      );
    }
  }

  console.log(
    "SUBSCRIPTION ACTIVATED:",
    newSubscription.subscriptionId,
    "EVENT:",
    eventType
  );
};

// ============================================================
// UPDATE RAZORPAY SUBSCRIPTION STATUS
// ============================================================

const updateSubscriptionStatus = async (
  razorpaySubscriptionId,
  status
) => {
  if (!razorpaySubscriptionId) {
    return;
  }

  await prisma.subscription.updateMany({
    where: {
      razorpaySubscriptionId,
    },

    data: {
      status,
    },
  });
};

// ============================================================
// WEBHOOK CONTROLLER
// ============================================================

const razorpayWebhook = async (
  req,
  res
) => {
  try {
    const razorpaySignature =
      req.headers[
        "x-razorpay-signature"
      ];

    if (!razorpaySignature) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay signature missing",
      });
    }

    // ========================================================
    // VERIFY WEBHOOK
    // ========================================================

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          RAZORPAY_WEBHOOK_SECRET
        )
        .update(req.body)
        .digest("hex");

    const isValid =
      crypto.timingSafeEqual(
        Buffer.from(
          expectedSignature
        ),
        Buffer.from(
          razorpaySignature
        )
      );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Razorpay webhook signature",
      });
    }

    // ========================================================
    // PARSE PAYLOAD
    // ========================================================

    const payload =
      JSON.parse(
        req.body.toString("utf8")
      );

    const event =
      payload.event;

    const razorpaySubscriptionId =
      payload.payload
        ?.subscription
        ?.entity
        ?.id;

    // ========================================================
    // SUBSCRIPTION AUTHENTICATED
    // ========================================================
    //
    // IMPORTANT:
    //
    // PAID → PAID has future start_at.
    //
    // The addon is collected today.
    //
    // Therefore the subscription may be
    // AUTHENTICATED before Razorpay marks
    // it ACTIVE.
    //
    // We activate SaaS access here after
    // successful authorization.
    //
    // ========================================================

    if (
      event ===
      "subscription.authenticated"
    ) {
      if (razorpaySubscriptionId) {
        await activateLocalSubscription(
          razorpaySubscriptionId,
          event
        );
      }
    }

    // ========================================================
    // SUBSCRIPTION ACTIVATED
    // ========================================================

    if (
      event ===
      "subscription.activated"
    ) {
      if (razorpaySubscriptionId) {
        await activateLocalSubscription(
          razorpaySubscriptionId,
          event
        );
      }
    }

    // ========================================================
    // SUBSCRIPTION CHARGED
    // ========================================================

    if (
      event ===
      "subscription.charged"
    ) {
      if (razorpaySubscriptionId) {
        const subscription =
          await prisma.subscription.findUnique({
            where: {
              razorpaySubscriptionId,
            },

            include: {
              plan: true,
            },
          });

        if (subscription) {
          const now =
            new Date();

          const endDate =
            addBillingCycle(
              now,
              subscription.billingCycle
            );

          await prisma.subscription.update({
            where: {
              subscriptionId:
                subscription.subscriptionId,
            },

            data: {
              status:
                "ACTIVE",

              startDate:
                now,

              endDate,
            },
          });
        }
      }
    }

    // ========================================================
    // SUBSCRIPTION PENDING
    // ========================================================

    if (
      event ===
      "subscription.pending"
    ) {
      await updateSubscriptionStatus(
        razorpaySubscriptionId,
        "PAST_DUE"
      );
    }

    // ========================================================
    // SUBSCRIPTION HALTED
    // ========================================================

    if (
      event ===
      "subscription.halted"
    ) {
      await updateSubscriptionStatus(
        razorpaySubscriptionId,
        "SUSPENDED"
      );
    }

    // ========================================================
    // SUBSCRIPTION CANCELLED
    // ========================================================

    if (
      event ===
      "subscription.cancelled"
    ) {
      await updateSubscriptionStatus(
        razorpaySubscriptionId,
        "CANCELLED"
      );
    }

    // ========================================================
    // SUBSCRIPTION COMPLETED
    // ========================================================

    if (
      event ===
      "subscription.completed"
    ) {
      await updateSubscriptionStatus(
        razorpaySubscriptionId,
        "EXPIRED"
      );
    }

    return res.status(200).json({
      success: true,
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