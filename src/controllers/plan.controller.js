// controllers/plan.controller.js

const prisma = require("../config/prisma");
const { createRazorpayPlan } = require("../utils/services/razorpay.service");

const mbToBytes = (mb) => {
  if (Number(mb) === -1) {
    return -1n;
  }

  return BigInt(mb) * 1024n * 1024n;
};

const bytesToMB = (bytes) => {
  if (bytes === -1n) {
    return -1;
  }

  return Number(bytes) / (1024 * 1024);
};


const formatPlan = (plan) => {
  return {
    ...plan,
    storageLimit: bytesToMB(plan.storageLimit),
  };
};


// ==========================================
// CREATE PLAN
// ==========================================

const createPlan = async (req, res) => {
  try {
    const {
      name,
      type,
      billingCycle,
      price,
      planLevel,
      projectLimit,
      collectionLimit,
      apiKeyLimit,
      teamMemberLimit,
      storageLimit,
      getRequestsLimit,
      writeRequestsLimit,
      customDomain,
      mediaUpload,
      analytics,
      emailSupport,
      displayOrder,
      isPopular,
    } = req.body;

    // ------------------------------------------
    // 1. VALIDATE REQUIRED FIELDS
    // ------------------------------------------

    if (
      !name ||
      !type ||
      !billingCycle ||
      price === undefined ||
      planLevel === undefined ||
      projectLimit === undefined ||
      collectionLimit === undefined ||
      apiKeyLimit === undefined ||
      teamMemberLimit === undefined ||
      storageLimit === undefined ||
      getRequestsLimit === undefined ||
      writeRequestsLimit === undefined ||
      analytics === undefined ||
      emailSupport === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Required plan fields are missing",
      });
    }


       // ======================================================
    // 2. VALIDATE PLAN TYPE
    // ======================================================

    if (!["FREE", "PAID"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan type. Use FREE or PAID",
      });
    }

    // ======================================================
    // 3. VALIDATE BILLING CYCLE
    // ======================================================

    if (!["NONE", "MONTHLY", "YEARLY"].includes(billingCycle)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid billing cycle. Use NONE, MONTHLY or YEARLY",
      });
    }


     // ======================================================
    // 4. FREE PLAN VALIDATION
    // ======================================================

  
    if (type === "FREE") {
      if (billingCycle !== "NONE") {
        return res.status(400).json({
          success: false,
          message:
            "FREE plan billing cycle must be NONE",
        });
      }

      if (Number(price) !== 0) {
        return res.status(400).json({
          success: false,
          message:
            "FREE plan price must be 0",
        });
      }

      if (Number(planLevel) !== 0) {
        return res.status(400).json({
          success: false,
          message:
            "FREE plan level must be 0",
        });
      }
    }

    // ======================================================
    // 5. PAID PLAN VALIDATION
    // ======================================================

    if (type === "PAID") {
      if (
        billingCycle !== "MONTHLY" &&
        billingCycle !== "YEARLY"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "PAID plan billing cycle must be MONTHLY or YEARLY",
        });
      }

      if (Number(price) <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "PAID plan price must be greater than 0",
        });
      }

      if (Number(planLevel) <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "PAID plan level must be greater than 0",
        });
      }
    }

    // ------------------------------------------
    // 2. CHECK PLAN NAME
    // ------------------------------------------
    const existingPlan = await prisma.plan.findFirst({
      where: {
        name: name.trim(),
        billingCycle,
        type,
        isActive: true,
      },
    });

    if (existingPlan) {
      return res.status(409).json({
        success: false,
        message: "Active plan with the same name and billing cycle already exists",
      });
    }

      // ==========================================
    // 3. RAZORPAY PLAN IDS
    // ==========================================

    let razorpayPlanId = null;

    if (type === "PAID" && Number(price) > 0) {
      const razorpayPlan = await createRazorpayPlan({
        name: `${name.trim()} ${billingCycle}`,
        amount: price,
        period: billingCycle === "MONTHLY" ? "monthly" : "yearly",
        description: `${name.trim()} ${billingCycle.toLowerCase()} subscription`,
      });
    
      razorpayPlanId = razorpayPlan.id;
    }


    // ------------------------------------------
    // 3. CREATE PLAN
    // ------------------------------------------

    const plan = await prisma.plan.create({
        data: {
          name: name.trim(),
          type,
          version: 1,
          status: "ACTIVE",
          billingCycle: billingCycle,
          price: String(price),
          planLevel: Number(planLevel),
          projectLimit: Number(projectLimit),
          razorpayPlanId,
          collectionLimit:  Number(collectionLimit),
          apiKeyLimit:
            Number(apiKeyLimit),
          teamMemberLimit:
            Number(teamMemberLimit),
          storageLimit:
          mbToBytes(storageLimit),
          getRequestsLimit:
            Number(getRequestsLimit),
          writeRequestsLimit:
            Number(writeRequestsLimit),
          customDomain:
            customDomain ?? false,
          mediaUpload:
            mediaUpload ?? false,
          analytics:
            analytics.trim(),
          emailSupport:
            emailSupport.trim(),
          displayOrder:
            displayOrder !== undefined
              ? Number(displayOrder)
              : 0,

          isPopular:
            isPopular ?? false,
        },
      });

    // ------------------------------------------
    // 4. RESPONSE
    // ------------------------------------------
    return res.status(201).json({
      success: true,
      message: "Plan created successfully",

      plan: formatPlan(plan),
    });
  } catch (error) {
    console.error(
      "Create Plan Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ==========================================
// GET ALL PLANS
// ==========================================

const getPlans = async (req, res) => {
  try {
    const plans =
      await prisma.plan.findMany({
        where: {
          status: "ACTIVE",
          isActive: true,
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

      const formattedPlans = plans.map(formatPlan);

      return res.status(200).json({
        success: true,
        count: formattedPlans.length,
        plans: formattedPlans,
      });
  } catch (error) {
    console.error(
      "Get Plans Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ==========================================
// GET SINGLE PLAN
// ==========================================

const getPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await prisma.plan.findUnique({
        where: {
          planId,
        },
      });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    return res.status(200).json({
      success: true,
    
      plan:
      formatPlan(plan),
  });
  } catch (error) {
    console.error(
      "Get Plan Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================================
// UPDATE PLAN
// ==========================================================

const updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const {
      name,
      type,
      billingCycle,
      price,
      projectLimit,
      planLevel,
      collectionLimit,
      apiKeyLimit,
      teamMemberLimit,
      storageLimit,
      getRequestsLimit,
      writeRequestsLimit,
      customDomain,
      mediaUpload,
      analytics,
      emailSupport,
      displayOrder,
      isActive,
      isPopular,
    } = req.body;

    // ======================================================
    // 1. FIND EXISTING PLAN
    // ======================================================

    const existingPlan = await prisma.plan.findUnique({
      where: {
        planId,
      },

      include: {
        subscriptions: true,
      },
    });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // ======================================================
// 2.1 PREVENT ARCHIVED PLAN EDIT
// ======================================================

if (existingPlan.status === "ARCHIVED") {
  return res.status(400).json({
    success: false,
    message: "Archived plan cannot be edited.",
  });
}

    // ======================================================
    // 2. FINAL VALUES
    // ======================================================

    const finalName =
      name !== undefined
        ? name.trim()
        : existingPlan.name;

    const finalType =
      type !== undefined
        ? type
        : existingPlan.type;

    const finalBillingCycle =
      billingCycle !== undefined
        ? billingCycle
        : existingPlan.billingCycle;

    const finalPrice =
      price !== undefined
        ? String(price)
        : existingPlan.price;
    
        const finalPlanLevel =
      planLevel !== undefined
        ? Number(planLevel)
        : Number(
            existingPlan.planLevel
          );


    // ======================================================
    // 3. VALIDATE TYPE
    // ======================================================

    if (!["FREE", "PAID"].includes(finalType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan type",
      });
    }

    // ======================================================
    // 4. VALIDATE BILLING CYCLE
    // ======================================================

    if (
      !["NONE", "MONTHLY", "YEARLY"].includes(
        finalBillingCycle
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid billing cycle",
      });
    }

    // ======================================================
    // 5. FREE PLAN VALIDATION
    // ======================================================

    if (finalType === "FREE") {
      if (finalBillingCycle !== "NONE") {
        return res.status(400).json({
          success: false,
          message:
            "FREE plan must have billingCycle NONE",
        });
      }

      if (Number(finalPrice) !== 0) {
        return res.status(400).json({
          success: false,
          message: "FREE plan price must be 0",
        });
      }
      if (
        finalPlanLevel !== 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "FREE plan level must be 0",
        });
      }
    
    }

    // ======================================================
    // 6. PAID PLAN VALIDATION
    // ======================================================

    if (finalType === "PAID") {
      if (
        !["MONTHLY", "YEARLY"].includes(
          finalBillingCycle
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "PAID plan must have MONTHLY or YEARLY billing cycle",
        });
      }

      if (Number(finalPrice) <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "PAID plan price must be greater than 0",
        });
      }
      if (
        finalPlanLevel <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "PAID plan level must be greater than 0",
        });
      }
    }

    // ======================================================
// 7. PLAN TYPE CANNOT BE CHANGED
// ======================================================

if (finalType !== existingPlan.type) {
  return res.status(400).json({
    success: false,
    message: "Plan type cannot be changed. Create a new plan instead.",
  });
}
    

    // ======================================================
    // 7. CHECK DUPLICATE PLAN
    // ======================================================

    const duplicatePlan = await prisma.plan.findFirst({
      where: {
        name: finalName,
        type: finalType,
        billingCycle: finalBillingCycle,
        status: "ACTIVE",
        isActive: true,

        NOT: {
          planId,
        },
      },
    });

    if (duplicatePlan) {
      return res.status(409).json({
        success: false,
        message:
          "Another active plan already uses this name and billing cycle",
      });
    }

    // ======================================================
    // 8. CHECK SUBSCRIPTIONS
    // ======================================================

    const hasSubscriptions =
      existingPlan.subscriptions.length > 0;

    // ======================================================
    // 9. PLAN HAS SUBSCRIPTIONS
    // ======================================================
    //
    // IMPORTANT:
    //
    // Never modify the old plan if customers are using it.
    //
    // Create a NEW plan instead.
    //
    // Existing customers continue using OLD plan.
    //
    // ======================================================

    const shouldCreateNewVersion =
  existingPlan.type === "PAID" && hasSubscriptions;

    if (shouldCreateNewVersion) {
      let newRazorpayPlanId = null;

      // ----------------------------------------------------
      // CREATE NEW RAZORPAY PLAN
      // ----------------------------------------------------

      if (
        finalType === "PAID" &&
        Number(finalPrice) > 0
      ) {
        const razorpayPlan =
          await createRazorpayPlan({
            name: `${finalName} ${
              finalBillingCycle === "MONTHLY"
                ? "Monthly"
                : "Yearly"
            }`,

            amount: finalPrice,

            period:
              finalBillingCycle === "MONTHLY"
                ? "monthly"
                : "yearly",

            description:
              `${finalName} ${finalBillingCycle.toLowerCase()} subscription`,
          });

        newRazorpayPlanId = razorpayPlan.id;
      }

      // ----------------------------------------------------
      // CREATE NEW DATABASE PLAN
      // ----------------------------------------------------

      const newPlan = await prisma.plan.create({
        data: {
          name: finalName,
          version: existingPlan.version + 1,
          status: "ACTIVE",
          type: finalType,
          billingCycle: finalBillingCycle,

          price: finalPrice,
          planLevel: finalPlanLevel,

          razorpayPlanId: newRazorpayPlanId,

          projectLimit:
            projectLimit !== undefined
              ? Number(projectLimit)
              : existingPlan.projectLimit,

          collectionLimit:
            collectionLimit !== undefined
              ? Number(collectionLimit)
              : existingPlan.collectionLimit,

          apiKeyLimit:
            apiKeyLimit !== undefined
              ? Number(apiKeyLimit)
              : existingPlan.apiKeyLimit,

          teamMemberLimit:
            teamMemberLimit !== undefined
              ? Number(teamMemberLimit)
              : existingPlan.teamMemberLimit,

          storageLimit:
            storageLimit !== undefined
              ? mbToBytes(storageLimit)
              : existingPlan.storageLimit,

          getRequestsLimit:
            getRequestsLimit !== undefined
              ? Number(getRequestsLimit)
              : existingPlan.getRequestsLimit,

          writeRequestsLimit:
            writeRequestsLimit !== undefined
              ? Number(writeRequestsLimit)
              : existingPlan.writeRequestsLimit,

          customDomain:
            customDomain !== undefined
              ? Boolean(customDomain)
              : existingPlan.customDomain,

          mediaUpload:
            mediaUpload !== undefined
              ? Boolean(mediaUpload)
              : existingPlan.mediaUpload,

          analytics:
            analytics !== undefined
              ? analytics.trim()
              : existingPlan.analytics,

          emailSupport:
            emailSupport !== undefined
              ? emailSupport.trim()
              : existingPlan.emailSupport,

          displayOrder:
            displayOrder !== undefined
              ? Number(displayOrder)
              : existingPlan.displayOrder,

          isPopular:
            isPopular !== undefined
              ? Boolean(isPopular)
              : existingPlan.isPopular,

          isActive: true,
        },
      });

      // ----------------------------------------------------
      // DEACTIVATE OLD PLAN
      // ----------------------------------------------------

      await prisma.plan.update({
        where: {
          planId,
        },

        data: {
          status: "ARCHIVED",
          isActive: false,
        },
      });

      return res.status(200).json({
        success: true,

        message:
          "New plan created and old plan deactivated",

        plan: formatPlan(newPlan),
      });
    }

    // ======================================================
    // 10. PLAN HAS NO SUBSCRIPTIONS
    // ======================================================
    //
    // We can update the existing plan.
    //
    // But Razorpay plans cannot be modified.
    //
    // If price/billing cycle changes, create a new
    // Razorpay plan.
    //
    // ======================================================

    let razorpayPlanId =
      existingPlan.razorpayPlanId;

    // ======================================================
    // 11. CHECK WHETHER RAZORPAY PLAN NEEDS REPLACEMENT
    // ======================================================

    const priceChanged =
      String(finalPrice) !==
      String(existingPlan.price);

    const billingCycleChanged =
      finalBillingCycle !==
      existingPlan.billingCycle;

    const typeChanged =
      finalType !== existingPlan.type;

    // ======================================================
    // 12. CREATE NEW RAZORPAY PLAN IF REQUIRED
    // ======================================================

    if (
      finalType === "PAID" &&
      Number(finalPrice) > 0 &&
      (priceChanged ||
        billingCycleChanged ||
        typeChanged ||
        !existingPlan.razorpayPlanId)
    ) {
      const razorpayPlan =
        await createRazorpayPlan({
          name: `${finalName} ${
            finalBillingCycle === "MONTHLY"
              ? "Monthly"
              : "Yearly"
          }`,

          amount: finalPrice,

          period:
            finalBillingCycle === "MONTHLY"
              ? "monthly"
              : "yearly",

          description:
            `${finalName} ${finalBillingCycle.toLowerCase()} subscription`,
        });

      razorpayPlanId = razorpayPlan.id;
    }

    // ======================================================
    // 13. FREE PLAN
    // ======================================================

    if (finalType === "FREE") {
      razorpayPlanId = null;
    }

    // ======================================================
    // 14. UPDATE EXISTING PLAN
    // ======================================================

    const plan = await prisma.plan.update({
      where: {
        planId,
      },

      data: {
        ...(name !== undefined && {
          name: name.trim(),
        }),

        ...(type !== undefined && {
          type,
        }),

        ...(billingCycle !== undefined && {
          billingCycle,
        }),

        ...(price !== undefined && {
          price: String(price),
        }),
        
        planLevel: finalPlanLevel,

        razorpayPlanId,

        ...(projectLimit !== undefined && {
          projectLimit: Number(projectLimit),
        }),

        ...(collectionLimit !== undefined && {
          collectionLimit: Number(collectionLimit),
        }),

        ...(apiKeyLimit !== undefined && {
          apiKeyLimit: Number(apiKeyLimit),
        }),

        ...(teamMemberLimit !== undefined && {
          teamMemberLimit: Number(teamMemberLimit),
        }),

        ...(storageLimit !== undefined && {
          storageLimit: mbToBytes(storageLimit),
        }),

        ...(getRequestsLimit !== undefined && {
          getRequestsLimit:
            Number(getRequestsLimit),
        }),

        ...(writeRequestsLimit !== undefined && {
          writeRequestsLimit:
            Number(writeRequestsLimit),
        }),

        ...(customDomain !== undefined && {
          customDomain: Boolean(customDomain),
        }),

        ...(mediaUpload !== undefined && {
          mediaUpload: Boolean(mediaUpload),
        }),

        ...(analytics !== undefined && {
          analytics: analytics.trim(),
        }),

        ...(emailSupport !== undefined && {
          emailSupport: emailSupport.trim(),
        }),

        ...(displayOrder !== undefined && {
          displayOrder: Number(displayOrder),
        }),

        ...(isActive !== undefined && {
          isActive: Boolean(isActive),
        }),

        ...(isPopular !== undefined && {
          isPopular: Boolean(isPopular),
        }),
      },
    });

    // ======================================================
    // 15. RESPONSE
    // ======================================================

    return res.status(200).json({
      success: true,

      message: "Plan updated successfully",

      plan: formatPlan(plan),
    });
  } catch (error) {
    console.error("Update Plan Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ==========================================
// DELETE PLAN
// ==========================================

// ==========================================
// DELETE PLAN
// ==========================================

const deletePlan = async (req, res) => {
    try {
      const { planId } = req.params;
  
      // ==========================================
      // 1. CHECK PLAN
      // ==========================================
  
      const plan =
        await prisma.plan.findUnique({
          where: {
            planId,
          },
          include: {
            subscriptions: true,
          },
        });
  
      if (!plan) {
        return res.status(404).json({
          success: false,
          message:
            "Plan not found",
        });
      }
  
      // ==========================================
      // 2. PLAN IS USED
      // ==========================================
      //
      // DO NOT DELETE THE DB ROW.
      //
      // Existing subscriptions still point to
      // this plan.
      //
      // Just deactivate it.
      //
  
      if (
        plan.subscriptions.length > 0
      ) {
        const deactivatedPlan = await prisma.plan.update({
            where: {
              planId,
            },
            data: {
              status: "ARCHIVED",
              isActive: false,
            },
          });
  
        return res.status(200).json({
          success: true,
          message:
            "Plan is already used. Plan has been deactivated.",
            plan: {
              ...deactivatedPlan,
    
              storageLimit:
                deactivatedPlan.storageLimit === -1n
                  ? -1
                  : Number(
                      deactivatedPlan.storageLimit
                    ) / (1024 * 1024),
            },
        });
      }
  
      // ==========================================
      // 3. PLAN IS NOT USED
      // ==========================================
      //
      // Delete only from YOUR database.
      //
      // Razorpay Plan cannot be deleted.
      //
  
      await prisma.plan.delete({
        where: {
          planId,
        },
      });
  
      return res.status(200).json({
        success: true,
        message: "Plan deleted successfully",
      });
    } catch (error) {
      console.error(
        "Delete Plan Error:",
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
  createPlan,
  getPlans,
  getPlan,
  updatePlan,
  deletePlan,
};