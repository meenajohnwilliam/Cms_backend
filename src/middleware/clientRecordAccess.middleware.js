// src/middleware/clientRecordAccess.middleware.js

const prisma = require("../config/prisma");

const clientRecordAccess = async (req, res, next) => {
  try {
    const {
      userId,
      tenantId,
      role,
    } = req.user;


    // ========================================================
    // ADMIN
    // ========================================================

    if (role === "ADMIN") {
      return next();
    }


    // ========================================================
    // ONLY USER
    // ========================================================

    if (role !== "USER") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }


    // ========================================================
    // COLLECTION REQUEST
    // ========================================================

    if (req.params.collectionId) {

      const collection =
        await prisma.collection.findFirst({
          where: {
            collectionId:
              req.params.collectionId,

            project: {
              tenantId,
              isActive: true,

              userAccess: {
                some: {
                  userId,
                  isActive: true,
                },
              },
            },
          },

          select: {
            collectionId: true,
            projectId: true,
          },
        });


      if (!collection) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have access to this collection",
        });
      }


      req.projectId =
        collection.projectId;

      req.collectionId =
        collection.collectionId;

      return next();
    }


    // ========================================================
    // RECORD REQUEST
    // ========================================================

    if (req.params.recordId) {

      const record =
        await prisma.record.findFirst({
          where: {
            recordId:
              req.params.recordId,

            collection: {
              project: {
                tenantId,
                isActive: true,

                userAccess: {
                  some: {
                    userId,
                    isActive: true,
                  },
                },
              },
            },
          },

          select: {
            recordId: true,

            collection: {
              select: {
                collectionId: true,
                projectId: true,
              },
            },
          },
        });


      if (!record) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have access to this record",
        });
      }


      req.projectId =
        record.collection.projectId;

      req.collectionId =
        record.collection.collectionId;

      return next();
    }


    return res.status(400).json({
      success: false,
      message:
        "Collection ID or Record ID is required",
    });

  } catch (error) {

    console.error(
      "Client Record Access Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


module.exports =
  clientRecordAccess;