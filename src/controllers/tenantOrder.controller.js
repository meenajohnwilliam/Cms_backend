
const crypto = require("crypto");
const Razorpay = require("razorpay");
const prisma = require("../config/prisma");






const createOrder = async (req, res) => {
  try {
    // 1. Validate API key
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "API key required",
      });
    }

    const keyHash = crypto
      .createHash("sha256")
      .update(apiKey)
      .digest("hex");

    const apiKeyData = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { project: true },
    });

    if (!apiKeyData || !apiKeyData.isActive ||
        !apiKeyData.project.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid API key",
      });
    }

    const { projectId, tenantId } = apiKeyData.project;
    const { recordId, submissionId, amount } = req.body;

    if (!recordId || !submissionId ||
        !Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "recordId, submissionId and amount are required",
      });
    }

    // 2. Validate record belongs to project
    const record = await prisma.record.findFirst({
      where: {
        recordId,
        collection: { projectId },
      },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // 3. Validate submission belongs to project
    const submission = await prisma.formSubmission.findFirst({
      where: {
        submissionId,
        form: { projectId },
      },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    // 4. Get project's Razorpay gateway
    const gateway = await prisma.projectPaymentGateway.findUnique({
      where: { projectId },
    });

    if (!gateway || !gateway.isVerified ||
        gateway.connectionStatus !== "CONNECTED") {
      return res.status(400).json({
        success: false,
        message: "Razorpay is not connected",
      });
    }

    const razorpay = new Razorpay({
      key_id: gateway.keyId,
      key_secret: gateway.keySecret,
    });

    // 5. Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `bf_${Date.now()}`,
      notes: {
        projectId,
        tenantId,
        recordId,
        submissionId,
      },
    });

    // 6. Save order and payment
    const order = await prisma.customerOrder.create({
      data: {
        tenantId,
        projectId,
        amount:amount/100,
        currency: "INR",
        status: "PENDING",
        customerSnapshot: {
          recordId,
          submissionId,
          customerData: submission.data,
        },
        payments: {
          create: {
            tenantId,
            projectId,
            razorpayOrderId: razorpayOrder.id,
            amount:amount/100,
            currency: "INR",
            status: "PENDING",
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        orderId: order.orderId,
        razorpayOrderId: razorpayOrder.id,
        keyId: gateway.keyId,
        amount,
        currency: "INR",
      },
    });
  } catch (error) {
    console.error("Create order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create order",
    });
  }
};


const getOrders = async (req, res) => {
    try {
        const { projectId } = req.params;
  
      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: "projectId is required",
        });
      }
  
      const page = Math.max(
        1,
        parseInt(req.query.page, 10) || 1
      );
  
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit, 10) || 10)
      );
  
      const skip = (page - 1) * limit;
  
      const [orders, totalOrders] = await Promise.all([
        prisma.customerOrder.findMany({
          where: { projectId },
          include: {
            payments: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
  
        prisma.customerOrder.count({
          where: { projectId },
        }),
      ]);
  
      return res.status(200).json({
        success: true,
        message: "Orders fetched successfully",
        pagination: {
          totalOrders,
          currentPage: page,
          limit,
          totalPages: Math.ceil(totalOrders / limit),
        },
        data: orders,
      });
    } catch (error) {
      console.error("Get orders error:", error);
  
      return res.status(500).json({
        success: false,
        message: "Unable to fetch orders",
      });
    }
  };
  


// const createOrder = async (req, res) => {
//     try {

//     const rawApiKey = req.headers["x-api-key"];

//       if (typeof rawApiKey !== "string" || !rawApiKey.trim()) {
//       return res.status(401).json({
//         success: false,
//         message: "API key is required",
//       });
//     }
    
//         // 2. Hash the supplied API key to match the stored keyHash
//         const keyHash = crypto
//           .createHash("sha256")
//           .update(rawApiKey)
//           .digest("hex");

//               // 3. Find the API key and resolve its project and tenant
//     const apiKey = await prisma.apiKey.findUnique({
//         where: { keyHash },
//         include: {
//           project: {
//             select: {
//               projectId: true,
//               tenantId: true,
//               isActive: true,
//               tenant: {
//                 select: { isActive: true },
//               },
//             },
//           },
//         },
//       });
  
//       if (
//         !apiKey ||
//         !apiKey.isActive ||
//         !apiKey.project ||
//         !apiKey.project.isActive ||
//         !apiKey.project.tenant ||
//         !apiKey.project.tenant.isActive
//       ) {
//         return res.status(401).json({
//           success: false,
//           message: "Invalid API key or inactive project",
//         });
//       }
  
//       const { projectId, tenantId } = apiKey.project;

//       const {
//         recordId,
//         amount,
//         currency = "INR",
//       } = req.body || {};
  
//       if (!tenantId) {
//         return res.status(401).json({
//           success: false,
//           message: "Tenant authentication required",
//         });
//       }
  
//       if (!recordId || !Number.isSafeInteger(amount) || amount <= 0 || currency !== "INR") {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid recordId, amount, or currency",
//         });
//       }
  

//      // 5. Verify the record belongs to this exact project
//     const record = await prisma.record.findFirst({
//         where: {
//           recordId,
//           collection: {
//             projectId,
//             project: {
//               tenantId,
//               isActive: true,
//               tenant: {
//                 isActive: true,
//               },
//             },
//           },
//         },
//         select: {
//           recordId: true,
//           data: true,
//         },
//       });
  
//       if (!record) {
//         return res.status(404).json({
//           success: false,
//           message: "Record not found",
//         });
//       }
  
//       // Get this tenant's own Razorpay configuration.
//       const gateway = await prisma.tenantPaymentGateway.findUnique({
//         where: { tenantId },
//       });
  
//       if ( !gateway || !gateway.isVerified || gateway.connectionStatus !== "CONNECTED" ) {
//         return res.status(400).json({
//           success: false,
//           message: "Razorpay is not connected",
//         });
//       }
  

//       if (!gateway.keyId || !gateway.keySecret) {
//         return res.status(400).json({
//           success: false,
//           message: "Razorpay credentials are missing",
//         });
//       }
//       // IMPORTANT: validate amount against trusted server-side pricing.
//       // Do not trust a price sent directly by a public browser.
  
//       const order = await prisma.tenantOrder.create({
//         data: {
//           tenantId,
//           projectId,
//           customerRecordId: record.recordId,
//           customerSnapshot: record.data,
//           amount,
//           currency,
//         },
//       });
  
//       try {
//         const razorpay = new Razorpay({
//           key_id: gateway.keyId,
//           key_secret: gateway.keySecret,
//         });
  
//         const razorpayOrder = await razorpay.orders.create({
//           amount: order.amount,
//           currency: order.currency,
//           receipt: order.orderId,
//           notes: {
//             buildfreeOrderId: order.orderId,
//             tenantId,
//           },
//         });
  
//         const payment = await prisma.tenantPayment.create({
//           data: {
//             tenantId,
//             orderId: order.orderId,
//             razorpayOrderId: razorpayOrder.id,
//             amount: order.amount,
//             currency: order.currency,
//             status: CustomerPaymentStatus.PENDING,
//           },
//         });
  
//         return res.status(201).json({
//           success: true,
//           message: "Order created successfully",
//           data: {
//             orderId: order.orderId,
//             paymentId: payment.paymentId,
//             razorpayOrderId: razorpayOrder.id,
//             amount: order.amount,
//             currency: order.currency,
//             keyId: gateway.keyId,
//           },
//         });
//       } catch (error) {
//         console.error("Razorpay order creation failed:", error);
  
//         await prisma.tenantOrder.update({
//           where: { orderId: order.orderId },
//           data: { status: "CANCELLED" },
//         });
  
//         return res.status(502).json({
//           success: false,
//           message: "Could not create Razorpay order",
//         });
//       }
//     } catch (error) {
//       console.error("createOrder error:", error);
  
//       return res.status(500).json({
//         success: false,
//         message: "Could not create order",
//       });
//     }
//   };

const getTenantOrders = async (req, res) => {
    try {
      // 1. Read BuildFree API key
      const rawApiKey = req.headers["x-api-key"];
  
      if (typeof rawApiKey !== "string" || !rawApiKey.trim()) {
        return res.status(401).json({
          success: false,
          message: "API key is required",
        });
      }
  
      // 2. Hash API key
      const keyHash = crypto
        .createHash("sha256")
        .update(rawApiKey)
        .digest("hex");
  
      // 3. Find API key and resolve tenant
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: {
          project: {
            select: {
              projectId: true,
              tenantId: true,
              isActive: true,
              tenant: {
                select: {
                  isActive: true,
                },
              },
            },
          },
        },
      });
  
      if (
        !apiKey ||
        !apiKey.isActive ||
        !apiKey.project ||
        !apiKey.project.isActive ||
        !apiKey.project.tenant ||
        !apiKey.project.tenant.isActive
      ) {
        return res.status(401).json({
          success: false,
          message: "Invalid API key or inactive project",
        });
      }
  
      // 5. Fetch only this tenant's orders
      const { projectId, tenantId } = apiKey.project;

      const orders = await prisma.tenantOrder.findMany({
        where: {
          tenantId,
          projectId,
        },
        include: {
          customerRecord: {
            select: {
              recordId: true,
              data: true,
            },
          },
          payments: {
            select: {
              paymentId: true,
              razorpayOrderId: true,
              razorpayPaymentId: true,
              amount: true,
              currency: true,
              status: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      
      return res.status(200).json({
        success: true,
        total: orders.length,
        data: orders,
      });
  
      
    } catch (error) {
      console.error("Get tenant orders error:", error);
  
      return res.status(500).json({
        success: false,
        message: "Failed to fetch orders",
      });
    }
  };



//   exports.createOrder = async (req, res) => {
//     try {
//       // 1. Validate project API key
//       const apiKey = req.headers["x-api-key"];
  
//       if (typeof apiKey !== "string" || !apiKey.trim()) {
//         return res.status(401).json({
//           success: false,
//           message: "API key is required",
//         });
//       }
  
//       const keyHash = crypto
//         .createHash("sha256")
//         .update(apiKey.trim())
//         .digest("hex");
  
//       const apiKeyData = await prisma.apiKey.findUnique({
//         where: { keyHash },
//         include: {
//           project: {
//             include: { tenant: true },
//           },
//         },
//       });
  
//       if (
//         !apiKeyData ||
//         !apiKeyData.isActive ||
//         !apiKeyData.project.isActive ||
//         !apiKeyData.project.tenant.isActive
//       ) {
//         return res.status(401).json({
//           success: false,
//           message: "Invalid API key or inactive project",
//         });
//       }
  
//       const { projectId, tenantId } = apiKeyData.project;
  
//       // 2. Validate request
//       const { recordId, submissionId, amount } = req.body;
  
//       if (
//         typeof recordId !== "string" ||
//         !recordId ||
//         typeof submissionId !== "string" ||
//         !submissionId ||
//         !Number.isSafeInteger(amount) ||
//         amount <= 0
//       ) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "recordId, submissionId and a valid amount in paise are required",
//         });
//       }
  
//       // 3. Validate product belongs to this project
//       const record = await prisma.record.findFirst({
//         where: {
//           recordId,
//           collection: { projectId },
//         },
//       });
  
//       if (!record) {
//         return res.status(404).json({
//           success: false,
//           message: "Record not found in this project",
//         });
//       }
  
//       // 4. Validate submission belongs to this project
//       const submission = await prisma.formSubmission.findFirst({
//         where: {
//           submissionId,
//           form: { projectId },
//         },
//       });
  
//       if (!submission) {
//         return res.status(404).json({
//           success: false,
//           message: "Submission not found in this project",
//         });
//       }
  
//       // 5. Check for an existing payment for this submission
//       // customerSnapshot stores submissionId in your current schema.
//       const existingOrders = await prisma.customerOrder.findMany({
//         where: {
//           tenantId,
//           projectId,
//         },
//         include: { payments: true },
//         orderBy: { createdAt: "desc" },
//       });
  
//       const existingOrder = existingOrders.find(
//         (order) =>
//           order.customerSnapshot?.submissionId === submissionId
//       );
  
//       if (existingOrder) {
//         const paid = existingOrder.payments.some(
//           (payment) => payment.status === "CAPTURED"
//         );
  
//         if (paid) {
//           return res.status(409).json({
//             success: false,
//             message: "This submission has already been paid",
//           });
//         }
  
//         const pendingPayment = existingOrder.payments.find(
//           (payment) => payment.status === "PENDING"
//         );
  
//         if (
//           pendingPayment &&
//           existingOrder.amount === amount
//         ) {
//           const gateway = await prisma.projectPaymentGateway.findUnique({
//             where: { projectId },
//           });
  
//           return res.status(200).json({
//             success: true,
//             message: "Existing payment order returned",
//             data: {
//               orderId: existingOrder.orderId,
//               razorpayOrderId: pendingPayment.razorpayOrderId,
//               keyId: gateway?.keyId,
//               amount: existingOrder.amount,
//               currency: existingOrder.currency,
//               status: "PENDING",
//             },
//           });
//         }
  
//         return res.status(409).json({
//           success: false,
//           message:
//             "An order already exists for this submission. Resolve it before creating another.",
//         });
//       }
  
//       // 6. Get this project's Razorpay configuration
//       const gateway = await prisma.projectPaymentGateway.findUnique({
//         where: { projectId },
//       });
  
//       if (
//         !gateway ||
//         !gateway.isVerified ||
//         gateway.connectionStatus !== "CONNECTED"
//       ) {
//         return res.status(400).json({
//           success: false,
//           message: "Razorpay is not connected to this project",
//         });
//       }
  
//       const razorpay = new Razorpay({
//         key_id: gateway.keyId,
//         key_secret: gateway.keySecret,
//       });
  
//       // 7. Create internal order
//       const customerOrder = await prisma.customerOrder.create({
//         data: {
//           tenantId,
//           projectId,
//           amount,
//           currency: "INR",
//           status: "PENDING",
//           customerSnapshot: {
//             submissionId,
//             recordId,
//             customerData: submission.data,
//           },
//         },
//       });
  
//       try {
//         // 8. Create Razorpay order
//         const razorpayOrder = await razorpay.orders.create({
//           amount,
//           currency: "INR",
//           receipt: customerOrder.orderId,
//           notes: {
//             customerOrderId: customerOrder.orderId,
//             projectId,
//             tenantId,
//             recordId,
//             submissionId,
//           },
//         });
  
//         // 9. Save payment details
//         await prisma.customerPayment.create({
//           data: {
//             tenantId,
//             projectId,
//             orderId: customerOrder.orderId,
//             razorpayOrderId: razorpayOrder.id,
//             amount,
//             currency: "INR",
//             status: "PENDING",
//           },
//         });
  
//         // 10. Return checkout details
//         return res.status(201).json({
//           success: true,
//           message: "Payment order created successfully",
//           data: {
//             orderId: customerOrder.orderId,
//             razorpayOrderId: razorpayOrder.id,
//             keyId: gateway.keyId,
//             amount,
//             currency: "INR",
//             status: "PENDING",
//           },
//         });
//       } catch (error) {
//         console.error("Razorpay order error:", error.message);
  
//         // Keep the failed attempt traceable.
//         // CANCELLED here means this order cannot proceed through checkout.
//         await prisma.customerOrder.update({
//           where: { orderId: customerOrder.orderId },
//           data: { status: "CANCELLED" },
//         });
  
//         return res.status(502).json({
//           success: false,
//           message: "Unable to create Razorpay order",
//           data: { orderId: customerOrder.orderId },
//         });
//       }
//     } catch (error) {
//       console.error("Create payment order error:", error);
  
//       return res.status(500).json({
//         success: false,
//         message: "Internal server error",
//       });
//     }
//   };
  
  module.exports = {
    createOrder,getTenantOrders,getOrders
  };