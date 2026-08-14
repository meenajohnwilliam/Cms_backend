// src/controllers/field.controller.js

const prisma = require("../config/prisma");

const allowedFieldTypes = [
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "RICHTEXT",
  "IMAGE",
  "FILE",
  "DATE",
  "JSON",
];

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

// ============================================================
// CREATE FIELD
// ============================================================

const createField = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const {
      name,
      type,
      isRequired = false,
      displayOrder = 0,
      tenantId
    } = req.body;



    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Field name is required",
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Field type is required",
      });
    }

    if (!allowedFieldTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid field type",
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

    const slug = generateSlug(name);

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Invalid field name",
      });
    }

    const existingField =
      await prisma.collectionField.findUnique({
        where: {
          collectionId_slug: {
            collectionId,
            slug,
          },
        },
      });

    if (existingField) {
      return res.status(409).json({
        success: false,
        message: "Field already exists",
      });
    }

    const field =
      await prisma.collectionField.create({
        data: {
          collectionId,
          name: name.trim(),
          slug,
          type,
          isRequired: Boolean(isRequired),
          displayOrder: Number(displayOrder),
        },
      });

    return res.status(201).json({
      success: true,
      message: "Field created successfully",
      field,
    });
  } catch (error) {
    console.error(
      "Create Field Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// GET FIELDS
// ============================================================

const getFields = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { tenantId } = req.body;

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

    const fields =
      await prisma.collectionField.findMany({
        where: {
          collectionId,
        },
        orderBy: {
          displayOrder: "asc",
        },
      });

    return res.status(200).json({
      success: true,
      count: fields.length,
      fields,
    });
  } catch (error) {
    console.error(
      "Get Fields Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// GET SINGLE FIELD
// ============================================================

const getField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { tenantId } = req.body;

    const field =
      await prisma.collectionField.findFirst({
        where: {
          fieldId,
          collection: {
            project: {
              tenantId,
              isActive: true,
            },
          },
        },
      });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: "Field not found",
      });
    }

    return res.status(200).json({
      success: true,
      field,
    });
  } catch (error) {
    console.error(
      "Get Field Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// UPDATE FIELD
// ============================================================

const updateField = async (req, res) => {
  try {
    const { fieldId } = req.params;

    const {
      name,
      type,
      isRequired,
      displayOrder,
      tenantId
    } = req.body;


    const field =
      await prisma.collectionField.findFirst({
        where: {
          fieldId,
          collection: {
            project: {
              tenantId,
              isActive: true,
            },
          },
        },
      });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: "Field not found",
      });
    }

    if (
      type !== undefined &&
      !allowedFieldTypes.includes(type)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid field type",
      });
    }

    let slug;

    if (
      name !== undefined &&
      name.trim() !== field.name
    ) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Field name cannot be empty",
        });
      }

      slug = generateSlug(name);

      const existingField =
        await prisma.collectionField.findFirst({
          where: {
            collectionId: field.collectionId,
            slug,
            NOT: {
              fieldId,
            },
          },
        });

      if (existingField) {
        return res.status(409).json({
          success: false,
          message: "Field already exists",
        });
      }
    }

    const updatedField =
      await prisma.collectionField.update({
        where: {
          fieldId,
        },
        data: {
          ...(name !== undefined && {
            name: name.trim(),
          }),

          ...(slug !== undefined && {
            slug,
          }),

          ...(type !== undefined && {
            type,
          }),

          ...(isRequired !== undefined && {
            isRequired: Boolean(isRequired),
          }),

          ...(displayOrder !== undefined && {
            displayOrder: Number(displayOrder),
          }),
        },
      });

    return res.status(200).json({
      success: true,
      message: "Field updated successfully",
      field: updatedField,
    });
  } catch (error) {
    console.error(
      "Update Field Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// DELETE FIELD
// ============================================================

const deleteField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { tenantId } = req.body;

    const field =
      await prisma.collectionField.findFirst({
        where: {
          fieldId,
          collection: {
            project: {
              tenantId,
              isActive: true,
            },
          },
        },
      });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: "Field not found",
      });
    }

    await prisma.collectionField.delete({
      where: {
        fieldId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Field deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Field Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createField,
  getFields,
  getField,
  updateField,
  deleteField,
};