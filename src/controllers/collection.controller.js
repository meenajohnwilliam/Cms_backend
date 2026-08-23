// src/controllers/collection.controller.js

const prisma = require("../config/prisma");

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// ============================================================
// CREATE COLLECTION
// ============================================================

const createCollection = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name } = req.body;
    const { tenantId } = req.user
  

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Collection name is required",
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
    // CHECK COLLECTION LIMIT
    // ========================================================

    const collectionLimit =
      subscription.plan.collectionLimit;

    // -1 = Unlimited

    if (
      collectionLimit !== -1 &&
      usage.collectionsUsed >= collectionLimit
    ) {
      return res.status(403).json({
        success: false,
        message: "Collection limit reached",
        usage: {
          used: usage.collectionsUsed,
          limit: collectionLimit,
        },
      });
    }
    // ========================================================
    // GENERATE SLUG
    // ========================================================

    const slug = generateSlug(name);

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Invalid collection name",
      });
    }

    // ========================================================
    // CHECK DUPLICATE COLLECTION
    // ========================================================

    const existingCollection =
      await prisma.collection.findUnique({
        where: {
          projectId_slug: {
            projectId,
            slug,
          },
        },
      });

    if (existingCollection) {
      return res.status(409).json({
        success: false,
        message: "Collection already exists",
      });
    }

    // ========================================================
    // CREATE COLLECTION
    // ========================================================

    const collection = await prisma.collection.create({
        data: {
          projectId,
          name: name.trim(),
          slug,
          status: "DRAFT",
        },
      });


    const updatedUsage = await prisma.usage.update({
      where: {
        tenantId,
      },
      data: {
        collectionsUsed: {
          increment: 1,
        },
      },
    });


    return res.status(201).json({
      success: true,
      message: "Collection created successfully",
      collection,
      usage: {
        collectionsUsed: updatedUsage.collectionsUsed,
        collectionLimit,
      },
    });
  } catch (error) {
    console.error(
      "Create Collection Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// GET ALL COLLECTIONS
// ============================================================

const getCollections = async (req, res) => {
  try {
    const { projectId } = req.params;
    const  {tenantId}  = req.user;

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
    // GET COLLECTIONS
    // ========================================================

    const collections =
      await prisma.collection.findMany({
        where: {
          projectId,
        },
        include: {
          fields: {
            orderBy: {
              displayOrder: "asc",
            },
          },
          _count: {
            select: {
              records: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      count: collections.length,
      collections,
    });
  } catch (error) {
    console.error(
      "Get Collections Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// GET SINGLE COLLECTION
// ============================================================

const getCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const  {tenantId}  = req.user;

    const collection =
      await prisma.collection.findFirst({
        where: {
          collectionId,
          project: {
            tenantId,
            isActive: true,
          },
        },
        include: {
          fields: {
            orderBy: {
              displayOrder: "asc",
            },
          },
          _count: {
            select: {
              records: true,
            },
          },
        },
      });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    return res.status(200).json({
      success: true,
      collection,
    });
  } catch (error) {
    console.error(
      "Get Collection Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// UPDATE COLLECTION
// ============================================================

const updateCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { name } = req.body;
    const {tenantId} = req.user
 

    if (
      name !== undefined &&
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Collection name cannot be empty",
      });
    }

    // ========================================================
    // CHECK COLLECTION
    // ========================================================

    const collection =
      await prisma.collection.findFirst({
        where: {
          collectionId,
          project: {
            tenantId,
            isActive: true,
          },
        },
      });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    let slug;

    // ========================================================
    // UPDATE SLUG IF NAME CHANGED
    // ========================================================

    if (
      name !== undefined &&
      name.trim() !== collection.name
    ) {
      slug = generateSlug(name);

      const existingCollection =
        await prisma.collection.findFirst({
          where: {
            projectId: collection.projectId,
            slug,
            NOT: {
              collectionId,
            },
          },
        });

      if (existingCollection) {
        return res.status(409).json({
          success: false,
          message:
            "Collection name already exists",
        });
      }
    }

    // ========================================================
    // UPDATE
    // ========================================================

    const updatedCollection =
      await prisma.collection.update({
        where: {
          collectionId,
        },
        data: {
          ...(name !== undefined && {
            name: name.trim(),
          }),

          ...(slug !== undefined && {
            slug,
          }),

       
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Collection updated successfully",
      collection: updatedCollection,
    });
  } catch (error) {
    console.error(
      "Update Collection Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// DELETE COLLECTION
// ============================================================

const deleteCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const  {tenantId}  = req.user;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }


    const collection =
      await prisma.collection.findFirst({
        where: {
          collectionId,
          project: {
            tenantId,
            isActive: true,
          },
        },
      });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    await prisma.collection.delete({
      where: {
        collectionId,
      },
    });

    await prisma.usage.update({
      where: {
        tenantId,
      },
      data: {
        collectionsUsed: {
          decrement: 1,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Collection deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Collection Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// PUBLISH COLLECTION
// ============================================================

const publishCollection = async (
  req,
  res
) => {
  try {
    const { collectionId } = req.params;
    const  {tenantId}  = req.user;

    const collection =
      await prisma.collection.findFirst({
        where: {
          collectionId,
          project: {
            tenantId,
            isActive: true,
          },
        },
        include: {
          fields: true,
        },
      });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    if (collection.fields.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Add at least one field before publishing",
      });
    }

    const updatedCollection =
      await prisma.collection.update({
        where: {
          collectionId,
        },
        data: {
          status: "PUBLISHED",
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Collection published successfully",
      collection: updatedCollection,
    });
  } catch (error) {
    console.error(
      "Publish Collection Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// UNPUBLISH COLLECTION
// ============================================================

const unpublishCollection = async (
  req,
  res
) => {
  try {
    const { collectionId } = req.params;
    const  {tenantId}  = req.user;

    const collection =
      await prisma.collection.findFirst({
        where: {
          collectionId,
          project: {
            tenantId,
            isActive: true,
          },
        },
      });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    const updatedCollection =
      await prisma.collection.update({
        where: {
          collectionId,
        },
        data: {
          status: "DRAFT",
        },
      });

    return res.status(200).json({
      success: true,
      message:
        "Collection unpublished successfully",
      collection: updatedCollection,
    });
  } catch (error) {
    console.error(
      "Unpublish Collection Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createCollection,
  getCollections,
  getCollection,
  updateCollection,
  deleteCollection,
  publishCollection,
  unpublishCollection,
};