// controllers/usageController.js
const prisma = require("../config/prisma")


// ============================================================
// GET USAGE
// ============================================================

const getUsage = async (req, res) => {
  try {
    const { tenantId } = req.user;

    // ========================================================
    // CHECK TENANT ID
    // ========================================================

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }

    // ========================================================
    // GET USAGE
    // ========================================================

    const usage = await prisma.usage.findUnique({
      where: {
        tenantId,
      },
    });

    if (!usage) {
      return res.status(404).json({
        success: false,
        message: "Usage not found",
      });
    }

    // ========================================================
    // GET ACTIVE SUBSCRIPTION
    // ========================================================

    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Active subscription not found",
      });
    }

    // ========================================================
    // PLAN
    // ========================================================

    const plan = subscription.plan;

    // ========================================================
    // STORAGE
    // ========================================================
    //
    // Database:
    //
    // usage.storageUsedBytes -> BYTES
    // plan.storageLimit      -> BYTES
    //
    // -1n = UNLIMITED
    //
    // Example:
    //
    // 104857600  = 100 MB
    // 1073741824 = 1024 MB = 1 GB
    // 5368709120 = 5120 MB = 5 GB
    // ========================================================

    const storageUsedBytes = usage.storageUsedBytes;

    const storageIsUnlimited =
      plan.storageLimit === -1n;

    let storageLimitBytes = null;
    let storageRemainingBytes = null;

    let storageUsedMB = null;
    let storageLimitMB = null;
    let storageRemainingMB = null;

    let storagePercentage = 0;

    // ========================================================
    // CALCULATE STORAGE
    // ========================================================

    if (!storageIsUnlimited) {
      // IMPORTANT:
      // storageLimit is ALREADY stored in bytes.
      storageLimitBytes = plan.storageLimit;

      // Remaining storage
      storageRemainingBytes =
        storageLimitBytes > storageUsedBytes
          ? storageLimitBytes - storageUsedBytes
          : 0n;

      // ======================================================
      // BYTES -> MB
      // 1 MB = 1024 * 1024 bytes
      // ======================================================

      storageUsedMB =
        Number(storageUsedBytes) /
        (1024 * 1024);

      storageLimitMB =
        Number(storageLimitBytes) /
        (1024 * 1024);

      storageRemainingMB =
        Number(storageRemainingBytes) /
        (1024 * 1024);

      // ======================================================
      // STORAGE PERCENTAGE
      // ======================================================

      if (storageLimitBytes > 0n) {
        storagePercentage =
          Number(
            (storageUsedBytes * 10000n) /
              storageLimitBytes
          ) / 100;

        // Don't allow percentage above 100
        storagePercentage = Math.min(
          storagePercentage,
          100
        );
      }
    }

    // ========================================================
    // API USAGE
    // ========================================================

    const getRequestsUsed =
      usage.getRequestsUsed;

    const writeRequestsUsed =
      usage.writeRequestsUsed;

    const getRequestsLimit =
      plan.getRequestsLimit;

    const writeRequestsLimit =
      plan.writeRequestsLimit;

    const getRequestsRemaining =
      getRequestsLimit === -1
        ? null
        : Math.max(
            getRequestsLimit - getRequestsUsed,
            0
          );

    const writeRequestsRemaining =
      writeRequestsLimit === -1
        ? null
        : Math.max(
            writeRequestsLimit - writeRequestsUsed,
            0
          );

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      tenantId,

      plan: {
        planId: plan.planId,
        name: plan.name,
      },

      usage: {
        // ====================================================
        // STORAGE
        // ====================================================

        storage: {
          // Original database value
          usedBytes:
            storageUsedBytes.toString(),

          // Original database limit
          limitBytes:
            storageLimitBytes !== null
              ? storageLimitBytes.toString()
              : null,

          // Remaining bytes
          remainingBytes:
            storageRemainingBytes !== null
              ? storageRemainingBytes.toString()
              : null,

          // Display values
          usedMB:
            storageUsedMB !== null
              ? Number(storageUsedMB.toFixed(2))
              : null,

          limitMB:
            storageLimitMB !== null
              ? Number(storageLimitMB.toFixed(2))
              : null,

          remainingMB:
            storageRemainingMB !== null
              ? Number(storageRemainingMB.toFixed(2))
              : null,

          // Percentage
          percentage: storagePercentage,

          // Unlimited
          unlimited: storageIsUnlimited,
        },

        // ====================================================
        // API
        // ====================================================

        api: {
          get: {
            used: getRequestsUsed,
            limit: getRequestsLimit,
            remaining: getRequestsRemaining,
            unlimited:
              getRequestsLimit === -1,
          },

          write: {
            used: writeRequestsUsed,
            limit: writeRequestsLimit,
            remaining: writeRequestsRemaining,
            unlimited:
              writeRequestsLimit === -1,
          },
        },

        // ====================================================
        // RESOURCES
        // ====================================================

        resources: {
          apiKeys: {
            used: usage.apiKeysUsed,
            limit: plan.apiKeyLimit,
            unlimited:
              plan.apiKeyLimit === -1,
          },

          projects: {
            used: usage.projectsUsed,
            limit: plan.projectLimit,
            unlimited:
              plan.projectLimit === -1,
          },

          collections: {
            used: usage.collectionsUsed,
            limit: plan.collectionLimit,
            unlimited:
              plan.collectionLimit === -1,
          },

          teamMembers: {
            used: usage.teamMembersUsed,
            limit: plan.teamMemberLimit,
            unlimited:
              plan.teamMemberLimit === -1,
          },
        },
      },
    });
  } catch (error) {
    console.error(
      "GET USAGE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get usage",
    });
  }
};


// ============================================================
// CREATE USAGE FOR TENANT
// ============================================================

// const createUsage = async (req, res) => {
//   try {
//     const { tenantId } = req.params;

//     const tenant = await prisma.tenant.findUnique({
//       where: {
//         tenantId,
//       },
//     });

//     if (!tenant) {
//       return res.status(404).json({
//         success: false,
//         message: "Tenant not found",
//       });
//     }

//     const existingUsage = await prisma.usage.findUnique({
//       where: {
//         tenantId,
//       },
//     });

//     if (existingUsage) {
//       return res.status(409).json({
//         success: false,
//         message: "Usage already exists",
//         usage: existingUsage,
//       });
//     }

//     const usage = await prisma.usage.create({
//       data: {
//         tenantId,
//         storageUsedMB: 0,
//         getRequestsUsed: 0,
//         writeRequestsUsed: 0,
//         apiKeysUsed: 0,
//         projectsUsed: 0,
//         collectionsUsed: 0,
//         teamMembersUsed: 0,
//       },
//     });

//     return res.status(201).json({
//       success: true,
//       message: "Usage created successfully",
//       usage,
//     });
//   } catch (error) {
//     console.error("CREATE USAGE ERROR:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to create usage",
//       error: error.message,
//     });
//   }
// };


// // ============================================================
// // STORAGE CHECK
// // ============================================================

// const checkStorageLimit = async (tenantId, fileSizeMB) => {
//   const subscription = await prisma.subscription.findFirst({
//     where: {
//       tenantId,
//       status: "ACTIVE",
//     },
//     orderBy: {
//       createdAt: "desc",
//     },
//     include: {
//       plan: true,
//     },
//   });

//   if (!subscription) {
//     return {
//       allowed: false,
//       message: "Active subscription not found",
//     };
//   }

//   const usage = await prisma.usage.findUnique({
//     where: {
//       tenantId,
//     },
//   });

//   if (!usage) {
//     return {
//       allowed: false,
//       message: "Usage record not found",
//     };
//   }

//   const newStorage = usage.storageUsedMB + fileSizeMB;

//   if (newStorage > subscription.plan.storageLimit) {
//     return {
//       allowed: false,
//       message: "Storage limit exceeded",
//       usedMB: usage.storageUsedMB,
//       limitMB: subscription.plan.storageLimit,
//       remainingMB: Math.max(
//         subscription.plan.storageLimit -
//           usage.storageUsedMB,
//         0
//       ),
//     };
//   }

//   return {
//     allowed: true,
//     usage,
//     plan: subscription.plan,
//   };
// };


// // ============================================================
// // ADD STORAGE
// // ============================================================

// const addStorage = async (tenantId, fileSizeMB) => {
//   await prisma.usage.update({
//     where: {
//       tenantId,
//     },
//     data: {
//       storageUsedMB: {
//         increment: fileSizeMB,
//       },
//     },
//   });
// };


// // ============================================================
// // REMOVE STORAGE
// // ============================================================

// const removeStorage = async (tenantId, fileSizeMB) => {
//   await prisma.usage.update({
//     where: {
//       tenantId,
//     },
//     data: {
//       storageUsedMB: {
//         decrement: fileSizeMB,
//       },
//     },
//   });
// };


// // ============================================================
// // API REQUEST CHECK
// // ============================================================

// const checkApiLimit = async (tenantId, type) => {
//   const subscription = await prisma.subscription.findFirst({
//     where: {
//       tenantId,
//       status: "ACTIVE",
//     },
//     orderBy: {
//       createdAt: "desc",
//     },
//     include: {
//       plan: true,
//     },
//   });

//   if (!subscription) {
//     return {
//       allowed: false,
//       message: "Active subscription not found",
//     };
//   }

//   const usage = await prisma.usage.findUnique({
//     where: {
//       tenantId,
//     },
//   });

//   if (!usage) {
//     return {
//       allowed: false,
//       message: "Usage record not found",
//     };
//   }

//   if (type === "GET") {
//     if (
//       usage.getRequestsUsed >=
//       subscription.plan.getRequestsLimit
//     ) {
//       return {
//         allowed: false,
//         message: "GET API request limit exceeded",
//         used: usage.getRequestsUsed,
//         limit: subscription.plan.getRequestsLimit,
//       };
//     }
//   }

//   if (type === "WRITE") {
//     if (
//       usage.writeRequestsUsed >=
//       subscription.plan.writeRequestsLimit
//     ) {
//       return {
//         allowed: false,
//         message: "WRITE API request limit exceeded",
//         used: usage.writeRequestsUsed,
//         limit: subscription.plan.writeRequestsLimit,
//       };
//     }
//   }

//   return {
//     allowed: true,
//   };
// };


// // ============================================================
// // INCREMENT API USAGE
// // ============================================================

// const incrementApiUsage = async (tenantId, type) => {
//   if (type === "GET") {
//     await prisma.usage.update({
//       where: {
//         tenantId,
//       },
//       data: {
//         getRequestsUsed: {
//           increment: 1,
//         },
//       },
//     });
//   }

//   if (type === "WRITE") {
//     await prisma.usage.update({
//       where: {
//         tenantId,
//       },
//       data: {
//         writeRequestsUsed: {
//           increment: 1,
//         },
//       },
//     });
//   }
// };


// // ============================================================
// // RESOURCE LIMIT CHECK
// // ============================================================

// const checkResourceLimit = async (
//   tenantId,
//   resource
// ) => {
//   const subscription = await prisma.subscription.findFirst({
//     where: {
//       tenantId,
//       status: "ACTIVE",
//     },
//     orderBy: {
//       createdAt: "desc",
//     },
//     include: {
//       plan: true,
//     },
//   });

//   if (!subscription) {
//     return {
//       allowed: false,
//       message: "Active subscription not found",
//     };
//   }

//   const usage = await prisma.usage.findUnique({
//     where: {
//       tenantId,
//     },
//   });

//   if (!usage) {
//     return {
//       allowed: false,
//       message: "Usage record not found",
//     };
//   }

//   const limits = {
//     apiKeys: {
//       used: usage.apiKeysUsed,
//       limit: subscription.plan.apiKeyLimit,
//     },

//     projects: {
//       used: usage.projectsUsed,
//       limit: subscription.plan.projectLimit,
//     },

//     collections: {
//       used: usage.collectionsUsed,
//       limit: subscription.plan.collectionLimit,
//     },

//     teamMembers: {
//       used: usage.teamMembersUsed,
//       limit: subscription.plan.teamMemberLimit,
//     },
//   };

//   const selected = limits[resource];

//   if (!selected) {
//     return {
//       allowed: false,
//       message: "Invalid resource",
//     };
//   }

//   if (selected.used >= selected.limit) {
//     return {
//       allowed: false,
//       message: `${resource} limit exceeded`,
//       used: selected.used,
//       limit: selected.limit,
//     };
//   }

//   return {
//     allowed: true,
//     used: selected.used,
//     limit: selected.limit,
//   };
// };


// // ============================================================
// // INCREMENT RESOURCE
// // ============================================================

// const incrementResourceUsage = async (
//   tenantId,
//   resource
// ) => {
//   const fieldMap = {
//     apiKeys: "apiKeysUsed",
//     projects: "projectsUsed",
//     collections: "collectionsUsed",
//     teamMembers: "teamMembersUsed",
//   };

//   const field = fieldMap[resource];

//   if (!field) {
//     throw new Error("Invalid resource");
//   }

//   await prisma.usage.update({
//     where: {
//       tenantId,
//     },
//     data: {
//       [field]: {
//         increment: 1,
//       },
//     },
//   });
// };


// // ============================================================
// // DECREMENT RESOURCE
// // ============================================================

// const decrementResourceUsage = async (
//   tenantId,
//   resource
// ) => {
//   const fieldMap = {
//     apiKeys: "apiKeysUsed",
//     projects: "projectsUsed",
//     collections: "collectionsUsed",
//     teamMembers: "teamMembersUsed",
//   };

//   const field = fieldMap[resource];

//   if (!field) {
//     throw new Error("Invalid resource");
//   }

//   const usage = await prisma.usage.findUnique({
//     where: {
//       tenantId,
//     },
//   });

//   if (!usage) {
//     throw new Error("Usage not found");
//   }

//   if (usage[field] <= 0) {
//     return;
//   }

//   await prisma.usage.update({
//     where: {
//       tenantId,
//     },
//     data: {
//       [field]: {
//         decrement: 1,
//       },
//     },
//   });
// };


// // ============================================================
// // RESET API USAGE
// // ============================================================

// const resetApiUsage = async (req, res) => {
//   try {
//     const { tenantId } = req.params;

//     const usage = await prisma.usage.update({
//       where: {
//         tenantId,
//       },
//       data: {
//         getRequestsUsed: 0,
//         writeRequestsUsed: 0,
//       },
//     });

//     return res.status(200).json({
//       success: true,
//       message: "API usage reset successfully",
//       usage,
//     });
//   } catch (error) {
//     console.error("RESET API USAGE ERROR:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to reset API usage",
//       error: error.message,
//     });
//   }
// };


module.exports = {
  getUsage,
  // createUsage,

  // checkStorageLimit,
  // addStorage,
  // removeStorage,

  // checkApiLimit,
  // incrementApiUsage,

  // checkResourceLimit,
  // incrementResourceUsage,
  // decrementResourceUsage,

  // resetApiUsage,
};