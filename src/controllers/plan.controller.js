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


// ==========================================
// CREATE PLAN
// ==========================================

const createPlan = async (req, res) => {
  try {
    const {
      name,
      monthlyPrice,
      yearlyPrice,
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
      monthlyPrice === undefined ||
      yearlyPrice === undefined ||
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

    // ------------------------------------------
    // 2. CHECK PLAN NAME
    // ------------------------------------------

    const existingPlan =
      await prisma.plan.findFirst({
        where: {
          name: name.trim(),
          isActive: true,
        },
      });

    if (existingPlan) {
      return res.status(409).json({
        success: false,
        message: "Active plan name already exists",
      });
    }

      // ==========================================
    // 3. RAZORPAY PLAN IDS
    // ==========================================

    let razorpayMonthlyPlanId = null;
    let razorpayYearlyPlanId = null;

    // ==========================================
    // 4. CREATE RAZORPAY MONTHLY PLAN
    // ==========================================

    if (Number(monthlyPrice) > 0) {
      const monthlyPlan =
        await createRazorpayPlan({
          name: `${name.trim()} Monthly`,

          amount:
            monthlyPrice,

          period: "monthly",

          description:
            `${name.trim()} monthly subscription`,
        });

      razorpayMonthlyPlanId =
        monthlyPlan.id;
    }

    // ==========================================
    // 5. CREATE RAZORPAY YEARLY PLAN
    // ==========================================

    if (Number(yearlyPrice) > 0) {
      const yearlyPlan =
        await createRazorpayPlan({
          name: `${name.trim()} Yearly`,

          amount:
            yearlyPrice,

          period: "yearly",

          description:
            `${name.trim()} yearly subscription`,
        });

      razorpayYearlyPlanId =
        yearlyPlan.id;
    }

    // ------------------------------------------
    // 3. CREATE PLAN
    // ------------------------------------------

    const plan =
      await prisma.plan.create({
        data: {
          name: name.trim(),

          monthlyPrice:
            String(monthlyPrice),

          yearlyPrice:
            String(yearlyPrice),

          projectLimit:
            Number(projectLimit),
         
            razorpayMonthlyPlanId,

            razorpayYearlyPlanId,

          collectionLimit:
            Number(collectionLimit),

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
    
      plan: {
        ...plan,
    
        storageLimit:
          bytesToMB(plan.storageLimit),
      },
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
        orderBy: [
          {
            displayOrder: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
      });
      const formattedPlans = plans.map((plan) => ({
        ...plan,
  
        // BigInt -> MB for API response
        storageLimit:
          plan.storageLimit === -1n
            ? -1
            : Number(plan.storageLimit) /
              (1024 * 1024),
      }));
  
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

    const plan =
      await prisma.plan.findUnique({
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
    
      plan: {
        ...plan,
    
        storageLimit:
          bytesToMB(plan.storageLimit),
      },
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


// ==========================================
// UPDATE PLAN
// ==========================================

const updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const {
      name,
      monthlyPrice,
      yearlyPrice,
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
      isActive,
      isPopular,
    } = req.body;

    // ------------------------------------------
    // 1. CHECK PLAN
    // ------------------------------------------

    const existingPlan =
      await prisma.plan.findUnique({
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

     if (name !== undefined) {
           const duplicatePlan =
             await prisma.plan.findFirst({
               where: {
                 name: name.trim(),
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
                 "Another active plan already uses this name",
             });
           }
         }

    const hasSubscriptions =  existingPlan.subscriptions.length > 0;

    const finalName =
    name !== undefined
      ? name.trim()
      : existingPlan.name;

  const finalMonthlyPrice =
    monthlyPrice !== undefined
      ? String(monthlyPrice)
      : existingPlan.monthlyPrice;

  const finalYearlyPrice =
    yearlyPrice !== undefined
      ? String(yearlyPrice)
      : existingPlan.yearlyPrice;

      if (hasSubscriptions) {
        let newRazorpayMonthlyPlanId = null;
        let newRazorpayYearlyPlanId = null;
  
        // ========================================
        // NEW RAZORPAY MONTHLY PLAN
        // ========================================
  
        if (Number(finalMonthlyPrice) > 0) {
          const monthlyPlan =
            await createRazorpayPlan({
              name:
                `${finalName} Monthly`,
  
              amount:
                finalMonthlyPrice,
  
              period:
                "monthly",
  
              description:
                `${finalName} monthly subscription`,
            });
  
          newRazorpayMonthlyPlanId =
            monthlyPlan.id;
        }
  
        // ========================================
        // NEW RAZORPAY YEARLY PLAN
        // ========================================
  
        if (Number(finalYearlyPrice) > 0) {
          const yearlyPlan =
            await createRazorpayPlan({
              name:
                `${finalName} Yearly`,
  
              amount:
                finalYearlyPrice,
  
              period:
                "yearly",
  
              description:
                `${finalName} yearly subscription`,
            });
  
          newRazorpayYearlyPlanId =
            yearlyPlan.id;
        }
  // ========================================
      // CREATE NEW DB PLAN
      // ========================================

      const newPlan =
        await prisma.plan.create({
          data: {
            name:
              finalName,

            monthlyPrice:
              finalMonthlyPrice,

            yearlyPrice:
              finalYearlyPrice,

            razorpayMonthlyPlanId:
              newRazorpayMonthlyPlanId,

            razorpayYearlyPlanId:
              newRazorpayYearlyPlanId,

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

      // ========================================
      // DEACTIVATE OLD PLAN
      // ========================================

      await prisma.plan.update({
        where: {
          planId,
        },
        data: {
          isActive: false,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "New plan created and old plan deactivated",
        plan: newPlan,
      });
    }

    // ==========================================
    // 6. PLAN HAS NO SUBSCRIPTIONS
    // ==========================================
    //
    // We can update the existing DB row.
    //
    // BUT:
    // If price changes, Razorpay Plan cannot
    // be updated.
    //
    // Therefore create a NEW Razorpay Plan
    // and save its new ID.
    //

    let razorpayMonthlyPlanId =
      existingPlan.razorpayMonthlyPlanId;

    let razorpayYearlyPlanId =
      existingPlan.razorpayYearlyPlanId;

    // ==========================================
    // 7. MONTHLY PRICE CHANGED
    // ==========================================

    if (
      monthlyPrice !== undefined &&
      String(monthlyPrice) !==
        existingPlan.monthlyPrice
    ) {
      if (Number(finalMonthlyPrice) > 0) {
        const monthlyPlan =
          await createRazorpayPlan({
            name:
              `${finalName} Monthly`,

            amount:
              finalMonthlyPrice,

            period:
              "monthly",

            description:
              `${finalName} monthly subscription`,
          });

        razorpayMonthlyPlanId =
          monthlyPlan.id;
      } else {
        razorpayMonthlyPlanId = null;
      }
    }

    // ==========================================
    // 8. YEARLY PRICE CHANGED
    // ==========================================

    if (
      yearlyPrice !== undefined &&
      String(yearlyPrice) !==
        existingPlan.yearlyPrice
    ) {
      if (Number(finalYearlyPrice) > 0) {
        const yearlyPlan =
          await createRazorpayPlan({
            name:
              `${finalName} Yearly`,

            amount:
              finalYearlyPrice,

            period:
              "yearly",

            description:
              `${finalName} yearly subscription`,
          });

        razorpayYearlyPlanId =
          yearlyPlan.id;
      } else {
        razorpayYearlyPlanId = null;
      }
    }

    // ==========================================
    // 9. UPDATE EXISTING DB PLAN
    // ==========================================

    const plan =
      await prisma.plan.update({
        where: {
          planId,
        },

        data: {
          ...(name !== undefined && {
            name:
              name.trim(),
          }),

          ...(monthlyPrice !== undefined && {
            monthlyPrice:
              String(monthlyPrice),
          }),

          ...(yearlyPrice !== undefined && {
            yearlyPrice:
              String(yearlyPrice),
          }),

          razorpayMonthlyPlanId,
          razorpayYearlyPlanId,

          ...(projectLimit !== undefined && {
            projectLimit:
              Number(projectLimit),
          }),

          ...(collectionLimit !== undefined && {
            collectionLimit:
              Number(collectionLimit),
          }),

          ...(apiKeyLimit !== undefined && {
            apiKeyLimit:
              Number(apiKeyLimit),
          }),

          ...(teamMemberLimit !== undefined && {
            teamMemberLimit:
              Number(teamMemberLimit),
          }),

          ...(storageLimit !== undefined && {
            storageLimit:
              mbToBytes(storageLimit),
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
            customDomain:
              Boolean(customDomain),
          }),

          ...(mediaUpload !== undefined && {
            mediaUpload:
              Boolean(mediaUpload),
          }),

          ...(analytics !== undefined && {
            analytics:
              analytics.trim(),
          }),

          ...(emailSupport !== undefined && {
            emailSupport:
              emailSupport.trim(),
          }),

          ...(displayOrder !== undefined && {
            displayOrder:
              Number(displayOrder),
          }),

          ...(isActive !== undefined && {
            isActive:
              Boolean(isActive),
          }),

          ...(isPopular !== undefined && {
            isPopular:
              Boolean(isPopular),
          }),
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "New plan created and old plan deactivated",
      
        plan: {
          ...newPlan,
      
          storageLimit:
            newPlan.storageLimit === -1n
              ? -1
              : Number(newPlan.storageLimit) /
                (1024 * 1024),
        },
      });
  } catch (error) {
    console.error(
      "Update Plan Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
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
        const deactivatedPlan =
          await prisma.plan.update({
            where: {
              planId,
            },
            data: {
              isActive: false,
            },
          });
  
        return res.status(200).json({
          success: true,
          message:
            "Plan is already used. Plan has been deactivated.",
          plan:
            deactivatedPlan,
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