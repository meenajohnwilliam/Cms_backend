// src/controllers/record.controller.js
const prisma = require("../config/prisma");
const upload = require("../config/upload")

// ============================================================
// VALIDATE RECORD DATA
// ============================================================

const validateRecordData = (fields, data) => {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return "data must be an object";
  }

  for (const field of fields) {
    const value = data[field.slug];

    if (
      field.isRequired &&
      (value === undefined ||
        value === null ||
        value === "")
    ) {
      return `${field.name} is required`;
    }

    if (
      value === undefined ||
      value === null
    ) {
      continue;
    }

    switch (field.type) {
      case "TEXT":
      case "RICHTEXT":
      case "IMAGE":
      case "FILE":
        if (typeof value !== "string") {
          return `${field.name} must be a string`;
        }
        break;

      case "NUMBER":
        if (
          typeof value !== "number" ||
          Number.isNaN(value)
        ) {
          return `${field.name} must be a number`;
        }
        break;

      case "BOOLEAN":
        if (typeof value !== "boolean") {
          return `${field.name} must be a boolean`;
        }
        break;

      case "DATE":
        if (
          typeof value !== "string" ||
          Number.isNaN(
            new Date(value).getTime()
          )
        ) {
          return `${field.name} must be a valid date`;
        }
        break;

      case "JSON":
        if (
          typeof value !== "object" ||
          Array.isArray(value)
        ) {
          return `${field.name} must be a JSON object`;
        }
        break;

      default:
        return `Unsupported field type: ${field.type}`;
    }
  }

  return null;
};

// ============================================================
// CHECK COLLECTION
// ============================================================

const getCollectionForTenant = async (
  collectionId,
  tenantId
) => {
  return await prisma.collection.findFirst({
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
    },
  });
};

// ============================================================
// CREATE RECORD
// ============================================================

const createRecord = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { data } = req.body;
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const collection =
      await getCollectionForTenant(
        collectionId,
        tenantId
      );

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    if (collection.status !== "PUBLISHED") {
      return res.status(403).json({
        success: false,
        message:
          "Collection is not published",
      });
    }

    const validationError =
      validateRecordData(
        collection.fields,
        data
      );

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const record =
      await prisma.record.create({
        data: {
          collectionId,
          data,
        },
      });


      // Profile image + Resume
    const files = req.files || [];

    for (const file of files) {
      const field = collection.fields.find(
        (item) => item.slug === file.fieldname
      );

      if (!field) {
        continue;
      }

      await prisma.media.create({
        data: {
          recordId: record.recordId,
          fieldId: field.fieldId,
          type: field.type,

          originalName: file.originalname,
          fileName: file.key.split("/").pop(),
          mimeType: file.mimetype,
          size: file.size,

          storageKey: file.key,
          url: file.location,
        },
      });
    }

    const finalRecord =
      await prisma.record.findUnique({
        where: {
          recordId: record.recordId,
        },
        include: {
          media: true,
        },
      });

    return res.status(201).json({
      success: true,
      message: "Record created successfully",
      record: finalRecord,
    });



  } catch (error) {
    console.error(
      "Create Record Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// GET ALL RECORDS
// ============================================================

const getRecords = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const collection =
      await getCollectionForTenant(
        collectionId,
        tenantId
      );

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    const records =
      await prisma.record.findMany({
        where: {
          collectionId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error(
      "Get Records Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// GET SINGLE RECORD
// ============================================================

const getRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const record =
      await prisma.record.findFirst({
        where: {
          recordId,
          collection: {
            project: {
              tenantId,
              isActive: true,
            },
          },
        },
      });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    return res.status(200).json({
      success: true,
      record,
    });
  } catch (error) {
    console.error(
      "Get Record Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// UPDATE RECORD
// ============================================================

const updateRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { data } = req.body;
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const record =
      await prisma.record.findFirst({
        where: {
          recordId,
          collection: {
            project: {
              tenantId,
              isActive: true,
            },
          },
        },
        include: {
          collection: {
            include: {
              fields: {
                orderBy: {
                  displayOrder: "asc",
                },
              },
            },
          },
        },
      });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    if (
      record.collection.status !==
      "PUBLISHED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Collection is not published",
      });
    }

    const validationError =
      validateRecordData(
        record.collection.fields,
        data
      );

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const updatedRecord =
      await prisma.record.update({
        where: {
          recordId,
        },
        data: {
          data,
        },
      });

    return res.status(200).json({
      success: true,
      message: "Record updated successfully",
      record: updatedRecord,
    });
  } catch (error) {
    console.error(
      "Update Record Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// DELETE RECORD
// ============================================================

const deleteRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const record =
      await prisma.record.findFirst({
        where: {
          recordId,
          collection: {
            project: {
              tenantId,
              isActive: true,
            },
          },
        },
        include: {
          collection: true,
        },
      });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    if (
      record.collection.status !==
      "PUBLISHED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Collection is not published",
      });
    }

    await prisma.record.delete({
      where: {
        recordId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Record deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Record Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createRecord,
  getRecords,
  getRecord,
  updateRecord,
  deleteRecord,
};