
const crypto = require("crypto");
const Razorpay = require("razorpay");
const prisma = require("../config/prisma");





const createOrder = async (req, res) => {
    try {

        const rawApiKey = req.headers["x-api-key"];

      if (typeof rawApiKey !== "string" || !rawApiKey.trim()) {
      return res.status(401).json({
        success: false,
        message: "API key is required",
      });
    }
    
        // 2. Hash the supplied API key to match the stored keyHash
        const keyHash = crypto
          .createHash("sha256")
          .update(rawApiKey)
          .digest("hex");

              // 3. Find the API key and resolve its project and tenant
    const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: {
          project: {
            select: {
              projectId: true,
              tenantId: true,
              isActive: true,
              tenant: {
                select: { isActive: true },
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
  
      const { projectId, tenantId } = apiKey.project;

      const {
        recordId,
        amount,
        currency = "INR",
      } = req.body || {};
  
      if (!tenantId) {
        return res.status(401).json({
          success: false,
          message: "Tenant authentication required",
        });
      }
  
      if (!recordId || !Number.isSafeInteger(amount) || amount <= 0 || currency !== "INR") {
        return res.status(400).json({
          success: false,
          message: "Invalid recordId, amount, or currency",
        });
      }
  

     // 5. Verify the record belongs to this exact project
    const record = await prisma.record.findFirst({
        where: {
          recordId,
          collection: {
            projectId,
            project: {
              tenantId,
              isActive: true,
              tenant: {
                isActive: true,
              },
            },
          },
        },
        select: {
          recordId: true,
          data: true,
        },
      });
  
      if (!record) {
        return res.status(404).json({
          success: false,
          message: "Record not found",
        });
      }
  
      // Get this tenant's own Razorpay configuration.
      const gateway = await prisma.tenantPaymentGateway.findUnique({
        where: { tenantId },
      });
  
      if ( !gateway || !gateway.isVerified || gateway.connectionStatus !== "CONNECTED" ) {
        return res.status(400).json({
          success: false,
          message: "Razorpay is not connected",
        });
      }
  

      if (!gateway.keyId || !gateway.keySecret) {
        return res.status(400).json({
          success: false,
          message: "Razorpay credentials are missing",
        });
      }
      // IMPORTANT: validate amount against trusted server-side pricing.
      // Do not trust a price sent directly by a public browser.
  
      const order = await prisma.tenantOrder.create({
        data: {
          tenantId,
          projectId,
          customerRecordId: record.recordId,
          customerSnapshot: record.data,
          amount,
          currency,
        },
      });
  
      try {
        const razorpay = new Razorpay({
          key_id: gateway.keyId,
          key_secret: gateway.keySecret,
        });
  
        const razorpayOrder = await razorpay.orders.create({
          amount: order.amount,
          currency: order.currency,
          receipt: order.orderId,
          notes: {
            buildfreeOrderId: order.orderId,
            tenantId,
          },
        });
  
        const payment = await prisma.tenantPayment.create({
          data: {
            tenantId,
            orderId: order.orderId,
            razorpayOrderId: razorpayOrder.id,
            amount: order.amount,
            currency: order.currency,
            status: CustomerPaymentStatus.PENDING,
          },
        });
  
        return res.status(201).json({
          success: true,
          message: "Order created successfully",
          data: {
            orderId: order.orderId,
            paymentId: payment.paymentId,
            razorpayOrderId: razorpayOrder.id,
            amount: order.amount,
            currency: order.currency,
            keyId: gateway.keyId,
          },
        });
      } catch (error) {
        console.error("Razorpay order creation failed:", error);
  
        await prisma.tenantOrder.update({
          where: { orderId: order.orderId },
          data: { status: "CANCELLED" },
        });
  
        return res.status(502).json({
          success: false,
          message: "Could not create Razorpay order",
        });
      }
    } catch (error) {
      console.error("createOrder error:", error);
  
      return res.status(500).json({
        success: false,
        message: "Could not create order",
      });
    }
  };

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

  
  module.exports = {
    createOrder,getTenantOrders
  };