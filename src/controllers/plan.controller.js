// controllers/plan.controller.js

const prisma = require("../config/prisma");

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
      await prisma.plan.findUnique({
        where: {
          name: name.trim(),
        },
      });

    if (existingPlan) {
      return res.status(409).json({
        success: false,
        message: "Plan name already exists",
      });
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

          collectionLimit:
            Number(collectionLimit),

          apiKeyLimit:
            Number(apiKeyLimit),

          teamMemberLimit:
            Number(teamMemberLimit),

          storageLimit:
            Number(storageLimit),

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
      plan,
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

    return res.status(200).json({
      success: true,
      count: plans.length,
      plans,
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
      plan,
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
      });

    if (!existingPlan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // ------------------------------------------
    // 2. CHECK DUPLICATE NAME
    // ------------------------------------------

    if (name !== undefined) {
      const duplicatePlan =
        await prisma.plan.findFirst({
          where: {
            name: name.trim(),
            NOT: {
              planId,
            },
          },
        });

      if (duplicatePlan) {
        return res.status(409).json({
          success: false,
          message:
            "Another plan already uses this name",
        });
      }
    }

    // ------------------------------------------
    // 3. UPDATE ONLY PROVIDED FIELDS
    // ------------------------------------------

    const plan =
      await prisma.plan.update({
        where: {
          planId,
        },

        data: {
          ...(name !== undefined && {
            name: name.trim(),
          }),

          ...(monthlyPrice !== undefined && {
            monthlyPrice:
              String(monthlyPrice),
          }),

          ...(yearlyPrice !== undefined && {
            yearlyPrice:
              String(yearlyPrice),
          }),

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
              Number(storageLimit),
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
      message: "Plan updated successfully",
      plan,
    });
  } catch (error) {
    console.error(
      "Update Plan Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ==========================================
// DELETE PLAN
// ==========================================

const deletePlan = async (req, res) => {
  try {
    const { planId } = req.params;

    // ------------------------------------------
    // 1. CHECK PLAN
    // ------------------------------------------

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
        message: "Plan not found",
      });
    }

    // ------------------------------------------
    // 2. DO NOT DELETE USED PLAN
    // ------------------------------------------

    if (
      plan.subscriptions.length > 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This plan is already used by a subscription. Deactivate it instead.",
      });
    }

    // ------------------------------------------
    // 3. DELETE PLAN
    // ------------------------------------------

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
      message: "Internal server error",
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