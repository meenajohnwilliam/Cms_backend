// src/controllers/form.controller.js

const prisma = require("../config/prisma");


// ============================================================
// CREATE FORM
// ============================================================

const createForm = async (req, res) => {
  try {
    const { name, slug, description } = req.body;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can create forms",
      });
    }

    const { projectId } = req.params;

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: "Name and slug are required",
      });
    }

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

    const existingForm = await prisma.form.findFirst({
      where: {
        projectId,
        slug,
      },
    });

    if (existingForm) {
      return res.status(409).json({
        success: false,
        message: "Form with this slug already exists",
      });
    }

    const form = await prisma.form.create({
      data: {
        projectId,
        name,
        slug,
        description,
        status: "DRAFT",
      },
    });

    return res.status(201).json({
      success: true,
      message: "Form created successfully",
      form,
    });
  } catch (error) {
    console.error("Create Form Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ============================================================
// GET ALL FORMS
// ============================================================

const getForms = async (req, res) => {
  try {
    const { tenantId, role } = req.user;
    const { projectId } = req.params;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view forms",
      });
    }

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

    const forms = await prisma.form.findMany({
      where: {
        projectId,
      },

      include: {
        _count: {
          select: {
            fields: true,
            submissions: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: forms.length,
      forms,
    });
  } catch (error) {
    console.error("Get Forms Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ============================================================
// GET SINGLE FORM
// ============================================================

const getForm = async (req, res) => {
  try {
    const { tenantId, role } = req.user;
    const { formId } = req.params;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view form",
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

      include: {
        fields: {
          orderBy: {
            displayOrder: "asc",
          },
        },

        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    return res.status(200).json({
      success: true,
      form,
    });
  } catch (error) {
    console.error("Get Form Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ============================================================
// UPDATE FORM
// ============================================================

const updateForm = async (req, res) => {
  try {
    const { tenantId, role } = req.user;
    const { formId } = req.params;

    const {
      name,
      slug,
      description,
    } = req.body;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can update forms",
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

    if (slug && slug !== form.slug) {
      const existingForm =
        await prisma.form.findFirst({
          where: {
            projectId: form.projectId,
            slug,
            NOT: {
              formId,
            },
          },
        });

      if (existingForm) {
        return res.status(409).json({
          success: false,
          message:
            "Form with this slug already exists",
        });
      }
    }

    const updatedForm =
      await prisma.form.update({
        where: {
          formId,
        },

        data: {
          ...(name !== undefined && { name }),
          ...(slug !== undefined && { slug }),
          ...(description !== undefined && {
            description,
          }),
        },
      });

    return res.status(200).json({
      success: true,
      message: "Form updated successfully",
      form: updatedForm,
    });
  } catch (error) {
    console.error("Update Form Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ============================================================
// DELETE FORM
// ============================================================

const deleteForm = async (req, res) => {
  try {
    const { tenantId, role } = req.user;
    const { formId } = req.params;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete forms",
      });
    }

    const form = await prisma.form.findFirst({
      where: {
        formId,

        project: {
          tenantId,
        },
      },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    await prisma.form.delete({
      where: {
        formId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Form deleted successfully",
    });
  } catch (error) {
    console.error("Delete Form Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ============================================================
// PUBLISH FORM
// ============================================================

const publishForm = async (req, res) => {
  try {
    const { tenantId, role } = req.user;
    const { formId } = req.params;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can publish forms",
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

      include: {
        fields: true,
      },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    if (form.fields.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Form must have at least one field before publishing",
      });
    }

    const updatedForm =
      await prisma.form.update({
        where: {
          formId,
        },

        data: {
          status: "PUBLISHED",
        },
      });

    return res.status(200).json({
      success: true,
      message: "Form published successfully",
      form: updatedForm,
    });
  } catch (error) {
    console.error("Publish Form Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ============================================================
// UNPUBLISH FORM
// ============================================================

const unpublishForm = async (req, res) => {
  try {
    const { tenantId, role } = req.user;
    const { formId } = req.params;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can unpublish forms",
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

    const updatedForm =
      await prisma.form.update({
        where: {
          formId,
        },

        data: {
          status: "DRAFT",
        },
      });

    return res.status(200).json({
      success: true,
      message: "Form unpublished successfully",
      form: updatedForm,
    });
  } catch (error) {
    console.error("Unpublish Form Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


module.exports = {
  createForm,
  getForms,
  getForm,
  updateForm,
  deleteForm,
  publishForm,
  unpublishForm,
};