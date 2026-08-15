// src/controllers/publicApi.controller.js

const crypto = require("crypto");
const prisma = require("../config/prisma");

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
// PUBLIC GET COLLECTION
// ============================================================

const getPublicCollection = async (req, res) => {
  try {
    const { projectSlug, collectionSlug } = req.params;

    const apiKey =
      req.headers["x-api-key"];

    // ========================================================
    // CHECK API KEY
    // ========================================================

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "API key is required",
      });
    }

    if (
      typeof apiKey !== "string" ||
      !apiKey.startsWith("cms_live_")
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid API key",
      });
    }

    const keyHash = hashApiKey(apiKey);

    // ========================================================
    // FIND API KEY
    // ========================================================

    const apiKeyRecord =
      await prisma.apiKey.findUnique({
        where: {
          keyHash,
        },
        include: {
          project: true,
        },
      });

    if (!apiKeyRecord) {
      return res.status(401).json({
        success: false,
        message: "Invalid API key",
      });
    }

    if (!apiKeyRecord.isActive) {
      return res.status(403).json({
        success: false,
        message: "API key is inactive",
      });
    }

    // ========================================================
    // CHECK PROJECT
    // ========================================================

    const project =
      await prisma.project.findFirst({
        where: {
          projectId:
            apiKeyRecord.projectId,

          slug: projectSlug,

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
    // CHECK SUBSCRIPTION
    // ========================================================

    const subscription =
      await prisma.subscription.findFirst({
        where: {
          tenantId: project.tenantId,
          status: "ACTIVE",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message:
          "Subscription inactive. Please make payment to use the API.",
      });
    }

    // ========================================================
    // FIND COLLECTION
    // ========================================================

    const collection =
      await prisma.collection.findFirst({
        where: {
          projectId:
            project.projectId,

          slug: collectionSlug,

          status: "PUBLISHED",
        },

        include: {
          fields: {
            orderBy: {
              displayOrder: "asc",
            },
          },
        },
      });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message:
          "Published collection not found",
      });
    }

    // ========================================================
    // GET RECORDS
    // ========================================================

    const records =
      await prisma.record.findMany({
        where: {
          collectionId:
            collection.collectionId,
        },

        select: {
          recordId: true,
          data: true,
          createdAt: true,
          updatedAt: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    // ========================================================
    // UPDATE API KEY LAST USED
    // ========================================================

    await prisma.apiKey.update({
      where: {
        apiKeyId:
          apiKeyRecord.apiKeyId,
      },

      data: {
        lastUsedAt: new Date(),
      },
    });

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      project: {
        projectId: project.projectId,
        name: project.name,
        slug: project.slug,
      },

      collection: {
        collectionId:
          collection.collectionId,

        name: collection.name,
        slug: collection.slug,
      },

      fields: collection.fields.map(
        (field) => ({
          fieldId: field.fieldId,
          name: field.name,
          slug: field.slug,
          type: field.type,
          isRequired:
            field.isRequired,
          displayOrder:
            field.displayOrder,
        })
      ),

      count: records.length,

      data: records,
    });
  } catch (error) {
    console.error(
      "Public GET API Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getPublicCollection,
};