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

    const apiKey = req.headers["x-api-key"];

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
          projectId: apiKeyRecord.projectId,
          slug: projectSlug,
          isActive: true,
        },
      });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Invalid Project Api Key",
      });
    }

    // ========================================================
    // CHECK SUBSCRIPTION
    // ========================================================

    const subscription = await prisma.subscription.findFirst({
        where: {
          tenantId: project.tenantId,
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
        message:
          "Subscription inactive. Please make payment to use the API.",
      });
    }


        // ========================================================
    // GET TENANT USAGE
    // ========================================================

    const usage = await prisma.usage.findUnique({
      where: {
        tenantId: project.tenantId,
      },
    });

    if (!usage) {
      return res.status(500).json({
        success: false,
        message: "Tenant usage record not found",
      });
    }


        // ========================================================
    // CHECK GET REQUEST LIMIT
    // ========================================================

    const getRequestsLimit = subscription.plan.getRequestsLimit;

    if (
      getRequestsLimit !== -1 &&
      usage.getRequestsUsed >= getRequestsLimit
    ) {
      return res.status(403).json({
        success: false,
        message: "GET request limit reached",
        usage: {
          used: usage.getRequestsUsed,
          limit: getRequestsLimit,
        },
      });
    }

    // ========================================================
    // FIND COLLECTION
    // ========================================================

    const collection = await prisma.collection.findFirst({
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

    const records = await prisma.record.findMany({
      where: {
        collectionId: collection.collectionId,
      },
      include: {
        media: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    await prisma.usage.update({
      where: {
        tenantId: project.tenantId,
      },
      data: {
        getRequestsUsed: {
          increment: 1,
        },
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

      // project: {
      //   projectId: project.projectId,
      //   name: project.name,
      //   slug: project.slug,
      // },

      // collection: {
      //   collectionId:
      //     collection.collectionId,

      //   name: collection.name,
      //   slug: collection.slug,
      // },

      // fields: collection.fields.map(
      //   (field) => ({
      //     fieldId: field.fieldId,
      //     name: field.name,
      //     slug: field.slug,
      //     type: field.type,
      //     isRequired:
      //       field.isRequired,
      //     displayOrder:
      //       field.displayOrder,
      //   })
      // ),

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


const getPublicRecord = async (req, res) => {
  try {
    const {
      projectSlug,
      collectionSlug,
      recordId,
    } = req.params;

    const apiKey = req.headers["x-api-key"];

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
        message: "Invalid Project API Key",
      });
    }

    // ========================================================
    // CHECK ACTIVE SUBSCRIPTION
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
        include: {
          plan: true,
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
    // GET TENANT USAGE
    // ========================================================

    const usage =
      await prisma.usage.findUnique({
        where: {
          tenantId: project.tenantId,
        },
      });

    if (!usage) {
      return res.status(500).json({
        success: false,
        message:
          "Tenant usage record not found",
      });
    }

    // ========================================================
    // CHECK GET REQUEST LIMIT
    // ========================================================

    const getRequestsLimit =
      subscription.plan.getRequestsLimit;

    // -1 = Unlimited

    if (
      getRequestsLimit !== -1 &&
      usage.getRequestsUsed >=
        getRequestsLimit
    ) {
      return res.status(403).json({
        success: false,
        message:
          "GET request limit reached",

        usage: {
          used:
            usage.getRequestsUsed,

          limit:
            getRequestsLimit,
        },
      });
    }

    // ========================================================
    // FIND PUBLISHED COLLECTION
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
    // FIND PARTICULAR RECORD
    // ========================================================

    const record =
      await prisma.record.findFirst({
        where: {
          recordId,

          // IMPORTANT:
          // Record must belong to this collection

          collectionId:
            collection.collectionId,
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

    // ========================================================
    // INCREASE GET REQUEST USAGE
    // ========================================================

    await prisma.usage.update({
      where: {
        tenantId:
          project.tenantId,
      },

      data: {
        getRequestsUsed: {
          increment: 1,
        },
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

      // project: {
      //   projectId:
      //     project.projectId,
      //   name:
      //     project.name,
      //   slug:
      //     project.slug,
      // },

      // collection: {
      //   collectionId:
      //     collection.collectionId,

      //   name:
      //     collection.name,

      //   slug:
      //     collection.slug,
      // },

      // fields:
      //   collection.fields.map(
      //     (field) => ({
      //       fieldId:
      //         field.fieldId,

      //       name:
      //         field.name,

      //       slug:
      //         field.slug,

      //       type:
      //         field.type,

      //       isRequired:
      //         field.isRequired,

      //       displayOrder:
      //         field.displayOrder,
      //     })
      //   ),

      record,
    });
  } catch (error) {
    console.error(
      "Public GET Record Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
};

// YES — KEEP YOUR EXISTING getPublicCollection()
// It is already for:
// GET collection data
//
// For FORM, create a separate public endpoint.
//
// DO NOT change getPublicCollection().
// Add the form API below in the same
// publicApi.controller.js.

// ============================================================
// PUBLIC GET FORM
// ============================================================

const getPublicForm = async (req, res) => {
    try {
      const { projectSlug, formSlug } = req.params;
  
      const apiKey = req.headers["x-api-key"];
  
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
      // FIND PUBLISHED FORM
      // ========================================================
  
      const form =
        await prisma.form.findFirst({
          where: {
            projectId:
              project.projectId,
  
            slug: formSlug,
  
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
  
      if (!form) {
        return res.status(404).json({
          success: false,
          message:
            "Published form not found",
        });
      }
  
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
  
        form: {
          formId: form.formId,
          name: form.name,
          slug: form.slug,
          description: form.description,
          status: form.status,
        },
  
        fields: form.fields.map(
          (field) => ({
            fieldId: field.fieldId,
            name: field.name,
            label: field.label,
            type: field.type,
            required: field.required,
            placeholder: field.placeholder,
            options: field.options,
            displayOrder:
              field.displayOrder,
          })
        ),
      });
    } catch (error) {
      console.error(
        "Public GET Form API Error:",
        error
      );
  
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };


 
  
  // ============================================================
  // PUBLIC SUBMIT FORM
  // ============================================================
  
  // const submitPublicForm = async (req, res) => {
  //   try {
  //     const { projectSlug, formSlug } = req.params;
  
  //     const apiKey = req.headers["x-api-key"];
  
  //     // ========================================================
  //     // CHECK API KEY
  //     // ========================================================
  
  //     if (!apiKey) {
  //       return res.status(401).json({
  //         success: false,
  //         message: "API key is required",
  //       });
  //     }
  
  //     if (
  //       typeof apiKey !== "string" ||
  //       !apiKey.startsWith("cms_live_")
  //     ) {
  //       return res.status(401).json({
  //         success: false,
  //         message: "Invalid API key",
  //       });
  //     }
  
  //     const keyHash = hashApiKey(apiKey);
  
  //     // ========================================================
  //     // FIND API KEY
  //     // ========================================================
  
  //     const apiKeyRecord =
  //       await prisma.apiKey.findUnique({
  //         where: {
  //           keyHash,
  //         },
  
  //         include: {
  //           project: true,
  //         },
  //       });
  
  //     if (!apiKeyRecord) {
  //       return res.status(401).json({
  //         success: false,
  //         message: "Invalid API key",
  //       });
  //     }
  
  //     if (!apiKeyRecord.isActive) {
  //       return res.status(403).json({
  //         success: false,
  //         message: "API key is inactive",
  //       });
  //     }
  
  //     // ========================================================
  //     // CHECK PROJECT
  //     // ========================================================
  
  //     const project =
  //       await prisma.project.findFirst({
  //         where: {
  //           projectId:
  //             apiKeyRecord.projectId,
  
  //           slug: projectSlug,
  
  //           isActive: true,
  //         },
  //       });
  
  //     if (!project) {
  //       return res.status(404).json({
  //         success: false,
  //         message: "Project not found",
  //       });
  //     }
  
  //     // ========================================================
  //     // CHECK SUBSCRIPTION
  //     // ========================================================
  
  //     const subscription =
  //       await prisma.subscription.findFirst({
  //         where: {
  //           tenantId: project.tenantId,
  
  //           status: "ACTIVE",
  //         },
  
  //         orderBy: {
  //           createdAt: "desc",
  //         },
  //       });
  
  //     if (!subscription) {
  //       return res.status(403).json({
  //         success: false,
  //         message:
  //           "Subscription inactive. Please make payment to use the API.",
  //       });
  //     }
  
  //     // ========================================================
  //     // FIND PUBLISHED FORM
  //     // ========================================================
  
  //     const form =
  //       await prisma.form.findFirst({
  //         where: {
  //           projectId:
  //             project.projectId,
  
  //           slug: formSlug,
  
  //           status: "PUBLISHED",
  //         },
  
  //         include: {
  //           fields: {
  //             orderBy: {
  //               displayOrder: "asc",
  //             },
  //           },
  //         },
  //       });
  
  //     if (!form) {
  //       return res.status(404).json({
  //         success: false,
  //         message:
  //           "Published form not found",
  //       });
  //     }
  
  //     // ========================================================
  //     // VALIDATE SUBMITTED DATA
  //     // ========================================================
  
  //     const data = req.body;
  
  //     if (
  //       !data ||
  //       typeof data !== "object" ||
  //       Array.isArray(data)
  //     ) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Form data is required",
  //       });
  //     }
  
  //     // ========================================================
  //     // CHECK REQUIRED FIELDS
  //     // ========================================================
  
  //     for (const field of form.fields) {
  //       if (!field.required) {
  //         continue;
  //       }
  
  //       const value = data[field.name];
  
  //       if (
  //         value === undefined ||
  //         value === null ||
  //         value === ""
  //       ) {
  //         return res.status(400).json({
  //           success: false,
  //           message:
  //             `${field.label} is required`,
  //           field: field.name,
  //         });
  //       }
  //     }
  
  //     // ========================================================
  //     // SAVE SUBMISSION
  //     // ========================================================
  
  //     const submission =
  //       await prisma.formSubmission.create({
  //         data: {
  //           formId: form.formId,
  //           data,
  //         },
  //       });
  
  //     // ========================================================
  //     // UPDATE SUBMISSION COUNT
  //     // ========================================================
  
  //   //   await prisma.form.update({
  //   //     where: {
  //   //       formId: form.formId,
  //   //     },
  
  //   //     data: {
  //   //       submissionCount: {
  //   //         increment: 1,
  //   //       },
  //   //     },
  //   //   });
  
  //     // ========================================================
  //     // UPDATE API KEY LAST USED
  //     // ========================================================
  
  //     await prisma.apiKey.update({
  //       where: {
  //         apiKeyId:
  //           apiKeyRecord.apiKeyId,
  //       },
  
  //       data: {
  //         lastUsedAt: new Date(),
  //       },
  //     });
  
  //     // ========================================================
  //     // RESPONSE
  //     // ========================================================
  
  //     return res.status(201).json({
  //       success: true,
  
  //       message:
  //         "Form submitted successfully",
  
  //       submissionId:
  //         submission.submissionId,
  //     });
  //   } catch (error) {
  //     console.error(
  //       "Public Form Submit API Error:",
  //       error
  //     );
  
  //     return res.status(500).json({
  //       success: false,
  //       message: "Internal server error",
  //     });
  //   }
  // };

  const submitPublicForm = async (req, res) => {
  try {
    const { projectSlug, formSlug } = req.params;

    const apiKey = req.headers["x-api-key"];

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
          projectId: apiKeyRecord.projectId,
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
    // FIND PUBLISHED FORM
    // ========================================================

    const form =
      await prisma.form.findFirst({
        where: {
          projectId: project.projectId,
          slug: formSlug,
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

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Published form not found",
      });
    }

    // ========================================================
    // FORM DATA
    // ========================================================

    let data = req.body;

    // ========================================================
    // CHECK REQUIRED FIELDS
    // ========================================================

    for (const field of form.fields) {

      if (!field.required) {
        continue;
      }

      // FILE / IMAGE FIELD
      if (
        field.type === "IMAGE" ||
        field.type === "FILE"
      ) {
        const uploadedFile =
          (req.files || []).find(
            (file) =>
              file.fieldname === field.name
          );

        if (!uploadedFile) {
          return res.status(400).json({
            success: false,
            message:
              `${field.label} is required`,
            field: field.name,
          });
        }

        continue;
      }

      // NORMAL FIELD
      const value = data[field.name];

      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${field.label} is required`,
          field: field.name,
        });
      }
    }

    // ========================================================
    // SAVE SUBMISSION
    // ========================================================

    const submission =
      await prisma.formSubmission.create({
        data: {
          formId: form.formId,
          data,
        },
      });

    // ========================================================
    // SAVE UPLOADED FILES
    // ========================================================

    const files = req.files || [];

    for (const file of files) {

      const field =
        form.fields.find(
          (item) =>
            item.name === file.fieldname
        );

      if (!field) {
        continue;
      }

      await prisma.media.create({
        data: {
          submissionId:
            submission.submissionId,

          fieldId:
            field.fieldId,

          type:
            field.type,

          originalName:
            file.originalname,

          fileName:
            file.key.split("/").pop(),

          mimeType:
            file.mimetype,

          size:
            file.size,

          storageKey:
            file.key,

          url:
            file.location,
        },
      });
    }

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

    return res.status(201).json({
      success: true,

      message:
        "Form submitted successfully",

      submissionId:
        submission.submissionId,
    });

  } catch (error) {

    console.error(
      "Public Form Submit API Error:",
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
  getPublicRecord,
  getPublicForm,
  submitPublicForm,
};