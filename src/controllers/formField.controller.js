// src/controllers/formField.controller.js

const prisma = require("../config/prisma");

// ============================================================
// CREATE FORM FIELD
// ============================================================

const createFormField = async (req, res) => {
  try {
    const { formId } = req.params;
    const { tenantId, role } = req.user;

    const {
      name,
      label,
      type,
      required,
      placeholder,
      options,
      displayOrder,
    } = req.body;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can create form fields",
      });
    }

    if (!name || !label || !type) {
      return res.status(400).json({
        success: false,
        message: "Name, label and type are required",
      });
    }

    const form = await prisma.form.findFirst({
      where: {
        formId,
        project: {
          tenantId,
          isActive: true,
        },
      },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    if (form.status === "PUBLISHED") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot add fields to a published form",
      });
    }

    const existingField =
      await prisma.formField.findFirst({
        where: {
          formId,
          name,
        },
      });

    if (existingField) {
      return res.status(409).json({
        success: false,
        message:
          "Field with this name already exists",
      });
    }

    const field =
      await prisma.formField.create({
        data: {
          formId,
          name,
          label,
          type,
          required: required ?? false,
          placeholder: placeholder ?? null,
          options: options ?? null,
          displayOrder: displayOrder ?? 0,
        },
      });

    return res.status(201).json({
      success: true,
      message: "Form field created successfully",
      field,
    });
  } catch (error) {
    console.error(
      "Create Form Field Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ============================================================
// GET FORM FIELDS
// ============================================================

const getFormFields = async (req, res) => {
  try {
    const { formId } = req.params;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view form fields",
      });
    }

    const form = await prisma.form.findFirst({
      where: {
        formId,
        project: {
          tenantId,
          isActive: true,
        },
      },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const fields =
      await prisma.formField.findMany({
        where: {
          formId,
        },

        orderBy: [
          {
            displayOrder: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      });

    return res.status(200).json({
      success: true,
      count: fields.length,
      fields,
    });
  } catch (error) {
    console.error(
      "Get Form Fields Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ============================================================
// GET SINGLE FORM FIELD
// ============================================================

const getFormField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view form fields",
      });
    }

    const field =
      await prisma.formField.findFirst({
        where: {
          fieldId,

          form: {
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
        message: "Form field not found",
      });
    }

    return res.status(200).json({
      success: true,
      field,
    });
  } catch (error) {
    console.error(
      "Get Form Field Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ============================================================
// UPDATE FORM FIELD
// ============================================================

const updateFormField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { tenantId, role } = req.user;

    const {
      name,
      label,
      type,
      required,
      placeholder,
      options,
      displayOrder,
    } = req.body;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can update form fields",
      });
    }

    const field =
      await prisma.formField.findFirst({
        where: {
          fieldId,

          form: {
            project: {
              tenantId,
              isActive: true,
            },
          },
        },

        include: {
          form: true,
        },
      });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: "Form field not found",
      });
    }

    if (field.form.status === "PUBLISHED") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot update fields of a published form",
      });
    }

    if (name && name !== field.name) {
      const existingField =
        await prisma.formField.findFirst({
          where: {
            formId: field.formId,
            name,

            NOT: {
              fieldId,
            },
          },
        });

      if (existingField) {
        return res.status(409).json({
          success: false,
          message:
            "Field with this name already exists",
        });
      }
    }

    const updatedField =
      await prisma.formField.update({
        where: {
          fieldId,
        },

        data: {
          ...(name !== undefined && { name }),
          ...(label !== undefined && { label }),
          ...(type !== undefined && { type }),
          ...(required !== undefined && {
            required,
          }),
          ...(placeholder !== undefined && {
            placeholder,
          }),
          ...(options !== undefined && {
            options,
          }),
          ...(displayOrder !== undefined && {
            displayOrder,
          }),
        },
      });

    return res.status(200).json({
      success: true,
      message: "Form field updated successfully",
      field: updatedField,
    });
  } catch (error) {
    console.error(
      "Update Form Field Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ============================================================
// DELETE FORM FIELD
// ============================================================

const deleteFormField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete form fields",
      });
    }

    const field =
      await prisma.formField.findFirst({
        where: {
          fieldId,

          form: {
            project: {
              tenantId,
              isActive: true,
            },
          },
        },

        include: {
          form: true,
        },
      });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: "Form field not found",
      });
    }

    if (field.form.status === "PUBLISHED") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete fields from a published form",
      });
    }

    await prisma.formField.delete({
      where: {
        fieldId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Form field deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Form Field Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


module.exports = {
  createFormField,
  getFormFields,
  getFormField,
  updateFormField,
  deleteFormField,
};