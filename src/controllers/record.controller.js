// src/controllers/record.controller.js
const prisma = require("../config/prisma");

// ============================================================
// VALIDATE RECORD DATA
// ============================================================

const validateRecordData = (fields, data, files = []) => {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return "data must be an object";
  }

  for (const field of fields) {

    // ============================================================
    // FILE / IMAGE FIELD
    // ============================================================

    if (
      field.type === "IMAGE" ||
      field.type === "FILE"
    ) {
      const uploadedFile = files.find(
        (file) => file.fieldname === field.slug
      );

      if (
        field.isRequired &&
        !uploadedFile
      ) {
        return `${field.name} is required`;
      }

      // If file is not required and not uploaded,
      // nothing else to validate.
      continue;
    }

    // ============================================================
    // NORMAL FIELD
    // ============================================================

    const value = data[field.slug];

    if (
      field.isRequired &&
      (
        value === undefined ||
        value === null ||
        value === ""
      )
    ) {
      return `${field.name} is required`;
    }

    if (
      value === undefined ||
      value === null
    ) {
      continue;
    }

    // ============================================================
    // TYPE VALIDATION
    // ============================================================

    switch (field.type) {

      case "TEXT":
      case "RICHTEXT":

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
    let { data } = req.body;
    const { tenantId } = req.user;

    // console.log("========== UPLOAD DEBUG ==========");

    // // req.files.forEach((file) => {
    // //   console.log({
    // //     fieldname: file.fieldname,
    // //     originalname: file.originalname,
    // //     mimetype: file.mimetype,
    // //     size: file.size,
    // //     key: file.key,
    // //     location: file.location,
    // //     bucket: file.bucket,
    // //   });
    // // });

    // console.log("==================================");



    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const files = req.files || [];
    

    // multipart/form-data sends data as a string
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "data must be valid JSON",
        });
      }
    }

    const collection = await getCollectionForTenant(
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
        data,
        files
      );

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }


    // ========================================================
    // GET ACTIVE SUBSCRIPTION
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

      // ========================================================
    // GET TENANT USAGE
    // ========================================================

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
    // WRITE REQUEST LIMIT
    // ========================================================

    const writeRequestsLimit =
    subscription.plan.writeRequestsLimit;

  // -1 = Unlimited

  if (
    writeRequestsLimit !== -1 &&
    usage.writeRequestsUsed >= writeRequestsLimit
  ) {
    return res.status(403).json({
      success: false,
      message: "Write request limit reached",
      usage: {
        used: usage.writeRequestsUsed,
        limit: writeRequestsLimit,
      },
    });
  }


        // ========================================================
    // CALCULATE UPLOAD STORAGE
    // ========================================================

    const uploadedBytes = files.reduce(
      (total, file) => {
        return total + BigInt(file.size || 0);
      },
      0n
    );



    // ========================================================
    // STORAGE LIMIT
    // ========================================================

    const storageLimit = subscription.plan.storageLimit;

    if (storageLimit !== -1) {
      const storageLimitBytes =
        BigInt(storageLimit) *
        1024n *
        1024n *
        1024n;

      if (
        usage.storageUsedBytes + uploadedBytes >
        storageLimitBytes
      ) {
        return res.status(403).json({
          success: false,
          message: "Storage limit reached",
          usage: {
            usedBytes: usage.storageUsedBytes.toString(),
            limit: storageLimit,
          },
        });
      }
    }

    const record = await prisma.record.create({
        data: {
          collectionId,
          data,
        },
      });


 

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


       // ========================================================
    // INCREASE WRITE REQUEST USAGE
    // ========================================================

    await prisma.usage.update({
      where: {
        tenantId,
      },
      data: {
        writeRequestsUsed: {
          increment: 1,
        },
      },
    });


    if (uploadedBytes  > 0) {
      await prisma.usage.update({
        where: {
          tenantId,
        },
        data: {
          storageUsedBytes: {
            increment: uploadedBytes,
          },
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

    const records = await prisma.record.findMany({
      where: {
        collectionId,
      },
      include: {
        media: true,
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
        include: {
          media: true,
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
    let { data } = req.body;
    const { tenantId } = req.user;
    const files = req.files || [];

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    // multipart/form-data sends data as a string
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "data must be valid JSON",
        });
      }
    }

    // Get record + collection + fields
    const record = await prisma.record.findFirst({
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
        media: true,
      },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    if (record.collection.status !== "PUBLISHED") {
      return res.status(403).json({
        success: false,
        message: "Collection is not published",
      });
    }

    // Validate normal fields + newly uploaded files
    const validationError = validateRecordData(
      record.collection.fields,
      data,
      files
    );

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    // Update record data
    await prisma.record.update({
      where: {
        recordId,
      },
      data: {
        data,
      },
    });

    // Handle newly uploaded files
    for (const file of files) {
      const field = record.collection.fields.find(
        (item) => item.slug === file.fieldname
      );

      if (!field) {
        continue;
      }

      // Find existing media for this field
      const existingMedia = record.media.find(
        (media) => media.fieldId === field.fieldId
      );

      // Delete old media DB record
      if (existingMedia) {
        await prisma.media.delete({
          where: {
            mediaId: existingMedia.mediaId,
          },
        });

        // TODO:
        // Delete existingMedia.storageKey from S3 here
      }

      // Create new media DB record
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

    // Get final updated record
    const updatedRecord = await prisma.record.findUnique({
      where: {
        recordId,
      },
      include: {
        media: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Record updated successfully",
      record: updatedRecord,
    });
  } catch (error) {
    console.error("Update Record Error:", error);

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