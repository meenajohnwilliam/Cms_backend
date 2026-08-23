// src/controllers/apiKey.controller.js

const crypto = require("crypto");
const prisma = require("../config/prisma");

// ============================================================
// GENERATE API KEY
// ============================================================

const generateApiKey = () => {
  return `cms_live_${crypto.randomBytes(32).toString("hex")}`;
};

// ============================================================
// HASH API KEY
// ============================================================

const hashApiKey = (apiKey) => {
  return crypto
    .createHash("sha256")
    .update(apiKey)
    .digest("hex");
};

// ============================================================
// CREATE API KEY
// ============================================================

const createApiKey = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name } = req.body;
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "API key name is required",
      });
    }

    // ========================================================
    // CHECK PROJECT
    // ========================================================

    const project = await prisma.project.findFirst({
      where: {
        projectId,
        tenantId,
        isActive: true,
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // ========================================================
    // CHECK ACTIVE SUBSCRIPTION
    // ========================================================

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
      return res.status(403).json({
        success: false,
        message: "Active subscription required",
      });
    }


    const usage = await prisma.usage.findUnique({
      where: {
        tenantId,
      },
    });

    if (!usage) {
      return res.status(500).json({
        success: false,
        message: "Tenant usage record not found",
      });
    }

    // ========================================================
    // CHECK API KEY LIMIT
    // ========================================================

    const apiKeyLimit = subscription.plan.apiKeyLimit;

  // -1 = Unlimited

  if (
    apiKeyLimit !== -1 &&
    usage.apiKeysUsed >= apiKeyLimit
  ) {
    return res.status(403).json({
      success: false,
      message: "API key limit reached",
      usage: {
        used: usage.apiKeysUsed,
        limit: apiKeyLimit,
      },
    });
  }

    // ========================================================
    // GENERATE KEY
    // ========================================================

    const apiKey = generateApiKey();

    const keyHash = hashApiKey(apiKey);

    const keyPrefix = apiKey.substring(0, 16);

    // ========================================================
    // SAVE KEY
    // ========================================================

    const createdApiKey =
      await prisma.apiKey.create({
        data: {
          projectId,
          name: name.trim(),
          keyHash,
          keyPrefix,
        },
      });

  // ========================================================
    // INCREASE API KEY USAGE
    // ========================================================

    const updatedUsage =
      await prisma.usage.update({
        where: {
          tenantId,
        },
        data: {
          apiKeysUsed: {
            increment: 1,
          },
        },
      });

    return res.status(201).json({
      success: true,
      message:
        "API key created successfully",

      apiKey: {
        apiKeyId:
          createdApiKey.apiKeyId,

        name:
          createdApiKey.name,

        key:
          apiKey,

        keyPrefix:
          createdApiKey.keyPrefix,

        createdAt:
          createdApiKey.createdAt,
      },
      usage: {
        apiKeysUsed: updatedUsage.apiKeysUsed,
        apiKeyLimit,
      },
    });
  } catch (error) {
    console.error(
      "Create API Key Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// GET API KEYS
// ============================================================

const getApiKeys = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tenantId } = req.user;

    const project = await prisma.project.findFirst({
      where: {
        projectId,
        tenantId,
        isActive: true,
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const apiKeys =
      await prisma.apiKey.findMany({
        where: {
          projectId,
        },
        select: {
          apiKeyId: true,
          name: true,
          keyPrefix: true,
          isActive: true,
          lastUsedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      count: apiKeys.length,
      apiKeys,
    });
  } catch (error) {
    console.error(
      "Get API Keys Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// GET SINGLE API KEY
// ============================================================

const getApiKey = async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const { tenantId } = req.user;

    const apiKey =
      await prisma.apiKey.findFirst({
        where: {
          apiKeyId,
          project: {
            tenantId,
            isActive: true,
          },
        },
        select: {
          apiKeyId: true,
          projectId: true,
          name: true,
          keyPrefix: true,
          isActive: true,
          lastUsedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: "API key not found",
      });
    }

    return res.status(200).json({
      success: true,
      apiKey,
    });
  } catch (error) {
    console.error(
      "Get API Key Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// REVOKE API KEY
// ============================================================

const revokeApiKey = async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const { tenantId } = req.user;

    const apiKey =
      await prisma.apiKey.findFirst({
        where: {
          apiKeyId,
          project: {
            tenantId,
            isActive: true,
          },
        },
      });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: "API key not found",
      });
    }

    if (!apiKey.isActive) {
      return res.status(400).json({
        success: false,
        message: "API key already revoked",
      });
    }

    await prisma.apiKey.update({
      where: {
        apiKeyId,
      },
      data: {
        isActive: false,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "API key revoked successfully",
    });
  } catch (error) {
    console.error(
      "Revoke API Key Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// ACTIVATE API KEY
// ============================================================

const activateApiKey = async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const { tenantId } = req.user;

    const apiKey =
      await prisma.apiKey.findFirst({
        where: {
          apiKeyId,
          project: {
            tenantId,
            isActive: true,
          },
        },
      });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: "API key not found",
      });
    }

    if (apiKey.isActive) {
      return res.status(400).json({
        success: false,
        message: "API key already active",
      });
    }

    await prisma.apiKey.update({
      where: {
        apiKeyId,
      },
      data: {
        isActive: true,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "API key activated successfully",
    });
  } catch (error) {
    console.error(
      "Activate API Key Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// DELETE API KEY
// ============================================================

const deleteApiKey = async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const apiKey = await prisma.apiKey.findFirst({
        where: {
          apiKeyId,
          project: {
            tenantId,
            isActive: true,
          },
        },
      });

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        message: "API key not found",
      });
    }

    await prisma.apiKey.delete({
      where: {
        apiKeyId,
      },
    });

    await prisma.usage.update({
      where: {
        tenantId,
      },
      data: {
        apiKeysUsed: {
          decrement: 1,
        },
      },
    })

    return res.status(200).json({
      success: true,
      message: "API key deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete API Key Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createApiKey,
  getApiKeys,
  getApiKey,
  revokeApiKey,
  activateApiKey,
  deleteApiKey,
};