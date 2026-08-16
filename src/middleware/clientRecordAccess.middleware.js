// src/middleware/clientRecordAccess.middleware.js

const prisma = require("../config/prisma");

const clientRecordAccess = async (req, res, next) => {
  try {
    const { userId, tenantId, role } = req.user;

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
            collectionId: req.params.collectionId,

            project: {
              tenantId,
              isActive: true,
            },
          },

          select: {
            collectionId: true,
            projectId: true,

            project: {
              select: {
                projectId: true,
                isActive: true,
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

      const access =
        await prisma.userProjectAccess.findUnique({
          where: {
            userId_projectId: {
              userId,
              projectId: collection.projectId,
            },
          },
        });

      if (!access || !access.isActive) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      req.projectId = collection.projectId;
      req.collectionId = collection.collectionId;

      return next();
    }

    // ========================================================
    // RECORD REQUEST
    // ========================================================

    if (req.params.recordId) {
      const record =
        await prisma.record.findFirst({
          where: {
            recordId: req.params.recordId,

            collection: {
              project: {
                tenantId,
                isActive: true,
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
        return res.status(404).json({
          success: false,
          message: "Record not found",
        });
      }

      const access =
        await prisma.userProjectAccess.findUnique({
          where: {
            userId_projectId: {
              userId,
              projectId:
                record.collection.projectId,
            },
          },
        });

      if (!access || !access.isActive) {
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

    // ========================================================
    // PROJECT REQUEST
    // ========================================================

    if (req.params.projectId) {
      const project =
        await prisma.project.findFirst({
          where: {
            projectId: req.params.projectId,
            tenantId,
            isActive: true,
          },

          select: {
            projectId: true,
          },
        });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      const access =
        await prisma.userProjectAccess.findUnique({
          where: {
            userId_projectId: {
              userId,
              projectId:
                req.params.projectId,
            },
          },
        });

      if (!access || !access.isActive) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      req.projectId = project.projectId;

      return next();
    }

    // ========================================================
    // FORM REQUEST
    // ========================================================

    if (req.params.formId) {
      const form =
        await prisma.form.findFirst({
          where: {
            formId: req.params.formId,

            project: {
              tenantId,
              isActive: true,
            },
          },

          select: {
            formId: true,
            projectId: true,
          },
        });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: "Form not found",
        });
      }

      const access =
        await prisma.userProjectAccess.findUnique({
          where: {
            userId_projectId: {
              userId,
              projectId: form.projectId,
            },
          },
        });

      if (!access || !access.isActive) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      req.projectId = form.projectId;
      req.formId = form.formId;

      return next();
    }

    // ========================================================
    // FORM SUBMISSION REQUEST
    // ========================================================

    if (req.params.submissionId) {
      const submission =
        await prisma.formSubmission.findFirst({
          where: {
            submissionId:
              req.params.submissionId,

            form: {
              project: {
                tenantId,
                isActive: true,
              },
            },
          },

          select: {
            submissionId: true,

            form: {
              select: {
                formId: true,
                projectId: true,
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

      const access =
        await prisma.userProjectAccess.findUnique({
          where: {
            userId_projectId: {
              userId,
              projectId:
                submission.form.projectId,
            },
          },
        });

      if (!access || !access.isActive) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      req.projectId =
        submission.form.projectId;

      req.formId =
        submission.form.formId;

      req.submissionId =
        submission.submissionId;

      return next();
    }

    // ========================================================
    // NO VALID RESOURCE ID
    // ========================================================

    return res.status(400).json({
      success: false,
      message:
        "Project ID, Collection ID, Record ID, Form ID or Submission ID is required",
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

module.exports = clientRecordAccess;




// // src/middleware/clientRecordAccess.middleware.js

// const prisma = require("../config/prisma");

// const clientRecordAccess = async (req, res, next) => {
//   try {
//     const {
//       userId,
//       tenantId,
//       role,
//     } = req.user;


//     // ========================================================
//     // ADMIN
//     // ========================================================

//     if (role === "ADMIN") {
//       return next();
//     }


//     // ========================================================
//     // ONLY USER
//     // ========================================================

//     if (role !== "USER") {
//       return res.status(403).json({
//         success: false,
//         message: "Access denied",
//       });
//     }


//     // ========================================================
//     // COLLECTION REQUEST
//     // ========================================================

//     if (req.params.collectionId) {

//         const collection =
//         await prisma.collection.findFirst({
//           where: {
//             collectionId:
//               req.params.collectionId,
      
//             project: {
//               tenantId,
//             },
//           },
      
//           select: {
//             collectionId: true,
//             projectId: true,
      
//             project: {
//               select: {
//                 projectId: true,
//                 isActive: true,
//               },
//             },
//           },
//         });
      
      
//       // PROJECT NOT FOUND
//       if (!collection) {
//         return res.status(404).json({
//           success: false,
//           message: "No project found",
//         });
//       }
      
      
//       // PROJECT DELETED / INACTIVE
//       if (!collection.project.isActive) {
//         return res.status(404).json({
//           success: false,
//           message: "No project found",
//         });
//       }
      
      
//       // CHECK USER ACCESS
//       const access =
//         await prisma.userProjectAccess.findUnique({
//           where: {
//             userId_projectId: {
//               userId,
//               projectId: collection.projectId,
//             },
//           },
//         });
      
      
//       if (!access || !access.isActive) {
//         return res.status(403).json({
//           success: false,
//           message: "Access denied",
//         });
//       }




//       req.projectId =
//         collection.projectId;

//       req.collectionId =
//         collection.collectionId;

//       return next();
//     }


//     // ========================================================
//     // RECORD REQUEST
//     // ========================================================

//     if (req.params.recordId) {

//       const record =
//         await prisma.record.findFirst({
//           where: {
//             recordId:
//               req.params.recordId,

//             collection: {
//               project: {
//                 tenantId,
//                 isActive: true,

//                 userAccess: {
//                   some: {
//                     userId,
//                     isActive: true,
//                   },
//                 },
//               },
//             },
//           },

//           select: {
//             recordId: true,

//             collection: {
//               select: {
//                 collectionId: true,
//                 projectId: true,
//               },
//             },
//           },
//         });


//       if (!record) {
//         return res.status(403).json({
//           success: false,
//           message:
//             "You do not have access to this record",
//         });
//       }


//       req.projectId =
//         record.collection.projectId;

//       req.collectionId =
//         record.collection.collectionId;

//       return next();
//     }


//     return res.status(400).json({
//       success: false,
//       message:
//         "Collection ID or Record ID is required",
//     });

//   } catch (error) {

//     console.error(
//       "Client Record Access Error:",
//       error
//     );

//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// };


// module.exports =
//   clientRecordAccess;