// src/controllers/formSubmission.controller.js

const prisma = require("../config/prisma");

// ============================================================
// GET ALL FORM SUBMISSIONS
// ============================================================

const getFormSubmissions = async (req, res) => {
  try {
    const { formId } = req.params;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view form submissions",
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

    const submissions =
      await prisma.formSubmission.findMany({
        where: {
          formId,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      submissions,
    });
  } catch (error) {
    console.error(
      "Get Form Submissions Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ============================================================
// GET SINGLE FORM SUBMISSION
// ============================================================

const getFormSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view form submissions",
      });
    }

    const submission =
      await prisma.formSubmission.findFirst({
        where: {
          submissionId,

          form: {
            project: {
              tenantId,
              isActive: true,
            },
          },
        },
      });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Form submission not found",
      });
    }

    return res.status(200).json({
      success: true,
      submission,
    });
  } catch (error) {
    console.error(
      "Get Form Submission Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// ============================================================
// DELETE FORM SUBMISSION
// ============================================================

const deleteFormSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete form submissions",
      });
    }

    const submission =
      await prisma.formSubmission.findFirst({
        where: {
          submissionId,

          form: {
            project: {
              tenantId,
              isActive: true,
            },
          },
        },
      });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Form submission not found",
      });
    }

    await prisma.formSubmission.delete({
      where: {
        submissionId,
      },
    });


    return res.status(200).json({
      success: true,
      message: "Form submission deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Form Submission Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


module.exports = {
  getFormSubmissions,
  getFormSubmission,
  deleteFormSubmission,
};