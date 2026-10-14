
const crypto = require("crypto");
const Razorpay = require("razorpay");
const prisma = require("../config/prisma");
const axios = require("axios");
const config = require("../config/config")



const connectGateway = async (req, res) => {
  try {
    const tenantId = "cmu10wts9000am51gie4iprm6";

    const {
      provider,
      keyId,
      keySecret,
      websiteUrl,
    } = req.body;
    
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Tenant not found",
      });
    }
    
    if (!provider || !keyId || !keySecret || !websiteUrl) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate credentials before saving.
    const razorpay = new Razorpay({
      key_id: keyId.trim(),
      key_secret: keySecret.trim(),
    });

    await razorpay.orders.all({ count: 1 });

    // Generate a unique webhook secret for this tenant.
    const webhookSecret = crypto.randomBytes(32).toString("hex");

    const webhookUrl =`${config.buildFreeWebhookUrl}/${tenantId}`;

    await prisma.tenantPaymentGateway.upsert({
      where: { tenantId },

      create: {
        tenantId,
        provider: provider ,
        keyId: keyId.trim(),
        keySecret: keySecret.trim(),
        webhookSecret,
        webhookUrl,
        websiteUrl,
        isVerified: false,
        connectionStatus: "WEBHOOK_PENDING",
      },

      update: {
        keyId: keyId.trim(),
        keySecret: keySecret.trim(),
        webhookSecret,
        websiteUrl,
        webhookUrl,
        testPaymentOrderId: null,
        testPaymentId: null,
        testPaymentAt: null,
        webhookVerifiedAt: null,
        lastVerifiedAt: null,
        isVerified: false,
        connectionStatus: "WEBHOOK_PENDING",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Successfully Credentials validated.",
    });
  } catch (error) {
    console.error("Connect gateway error:", error.message);

    return res.status(400).json({
      success: false,
      message: "Credential validation failed",
    });
  }
};

const createTestOrder = async (req, res) => {
    try {
      // 1. Get tenant ID
      const tenantId = req.user?.tenantId || "cmu10wts9000am51gie4iprm6";
  
      // 2. Find tenant Razorpay configuration
      const gateway = await prisma.tenantPaymentGateway.findUnique({
        where: { tenantId },
      });
  
      if (!gateway) {
        return res.status(404).json({
          success: false,
          message: "Connect Razorpay first",
        });
      }
  
      // 3. Create Razorpay instance
      const razorpay = new Razorpay({
        key_id: gateway.keyId,
        key_secret: gateway.keySecret,
      });
  
      // 4. Create ₹1 test order
      const order = await razorpay.orders.create({
        amount: 100,
        currency: "INR",
        notes: {
          tenantId,
          purpose: "gateway_connection_test",
        },
      });
  
      // 5. Update gateway status
      await prisma.tenantPaymentGateway.update({
        where: { tenantId },
        data: {
          testPaymentOrderId: order.id,
          testPaymentId: null,
          testPaymentAt: null,
          isVerified: false,
          connectionStatus: "TEST_PAYMENT_PENDING",
        },
      });
  
      // 6. Send response
      return res.status(201).json({
        success: true,
        message: "Test order created.",
        data: {
          keyId: gateway.keyId,
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
        },
      });
    } catch (error) {
      console.error(
        "Test order error:",
        error.error?.description || error.message
      );
  
      return res.status(500).json({
        success: false,
        message: "Unable to create test order",
        error: error.error?.description || error.message,
      });
    }
};

const getGatewayStatus = async (req, res) => {
  try {
    const gateway = await prisma.tenantPaymentGateway.findUnique({
      where: { tenantId: req.tenant.tenantId },
      select: {
        provider: true,
        isVerified: true,
        connectionStatus: true,
        testPaymentAt: true,
        webhookVerifiedAt: true,
        lastVerifiedAt: true,
      },
    });

    return res.json({
      success: true,
      data: gateway,
    });
  } catch (error) {
    console.error("Gateway status error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve gateway status",
    });
  }
};

const testWebhookConnection = async (req, res) => {
  try {
    //const { tenantId } = req.params;
    const  tenantId  = "cmu10wts9000am51gie4iprm6"

    const gateway = await prisma.tenantPaymentGateway.findUnique({
      where: { tenantId },
    });

    if (!gateway?.webhookSecret) {
      return res.status(400).json({
        success: false,
        message: "Webhook secret not configured",
      });
    }

    const dummyPayment = {
        id: "pay_dummy_123",
        order_id: "order_dummy_123",
        amount: 100,
        currency: "INR",
        status: "captured",
      };
      
      const payload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: dummyPayment,
          },
        },
      });
      
      await prisma.tenantPaymentGateway.update({
        where: { tenantId },
        data: {
            webhookVerificationOrderId: dummyPayment.order_id,
            testPaymentId: dummyPayment.id,
        },
      });



    const signature = crypto
      .createHmac("sha256", gateway.webhookSecret)
      .update(payload)
      .digest("hex");

    const response = await axios.post(
      `${config.buildFreeWebhookUrl}/${tenantId}`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": signature,
        },
        transformRequest: [(data) => data],
      }
    );

    return res.status(200).json({
      success: true,
      message: "Event sent to webhook",
      webhookResponse: response.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to trigger webhook",
      error: error.response?.data || error.message,
    });
  }
};

// const tenantRazorpayWebhook = async (req, res) => {
//   try {
//     const { tenantId } = req.params;

//     const rawBody = req.body;
//     const signature = req.headers["x-razorpay-signature"];

//     // 1. Validate request
//     if (!Buffer.isBuffer(rawBody) || !signature) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid webhook request",
//       });
//     }

//     // 2. Find tenant gateway
//     const gateway = await prisma.tenantPaymentGateway.findUnique({
//       where: { tenantId },
//     });

//     console.log(gateway)

//     if (!gateway || !gateway.webhookSecret) {
//       return res.status(404).json({
//         success: false,
//         message: "Tenant gateway not found",
//       });
//     }

//     // 3. Verify signature
//     const expectedSignature = crypto
//       .createHmac("sha256", gateway.webhookSecret)
//       .update(rawBody)
//       .digest("hex");

//     if (signature !== expectedSignature) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid webhook signature",
//       });
//     }

//     console.log("jaromjery na webhook ahh hit paniten")

//     // 4. Read webhook event
//     const { event, payload } = JSON.parse(
//       rawBody.toString("utf8")
//     );

//     const payment = payload?.payment?.entity;

//     console.log("Razorpay payments: ",payment)

//     console.log("Razorpay event:", event);

//     // 5. Process only captured and failed events
//     if (!["payment.captured", "payment.failed"].includes(event)) {
//       return res.status(200).json({ success: true });
//     }

//     if (!payment?.id || !payment?.order_id) {
//       return res.status(200).json({ success: true });
//     }


//     // this is for only verify the webhook 
//     if (
//         event === "payment.captured" ||
//         payment?.id === gateway.testPaymentOrderId ||
//         payment?.order_id === testPaymentId
//       ) {
//           // 6. Record successful webhook verification
//       await prisma.tenantPaymentGateway.update({
//         where: { tenantId },
//         data: {
//           isVerified:true,
//           webhookVerifiedAt: new Date(),
//           connectionStatus: "WEBHOOK_VERIFIED", 
//           lastVerifiedAt: new Date(),
//         },
//       });

//       return res.status(201).json({
//         success: true,
//         webhookReceived: true,
//         signatureVerified: true,
//         event,
//         message: "webhook verification successful",
//       });
//       }// this is only for verify the webhook 



// // Handle ₹1 test payment
// if (payment.order_id === gateway.testPaymentOrderId) {
//   if (
//     event === "payment.captured" &&
//     payment.status === "captured" &&
//     payment.amount === 100 &&
//     payment.currency === "INR"
//   ) {
//     await prisma.tenantPaymentGateway.update({
//       where: { tenantId },
//       data: {
//         isVerified: true,
//         connectionStatus: "CONNECTED",
//         testPaymentId: payment.id,
//         testPaymentAt: new Date(),
//         webhookVerifiedAt: new Date(),
//         lastVerifiedAt: new Date(),
//       },
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Test payment successful. Gateway connected.",
//     });
//   }

//   if (event === "payment.failed") {
//     return res.status(200).json({
//       success: true,
//       message: "Test payment failed. Gateway is not connected.",
//     });
//   }

//   return res.status(200).json({
//     success: true,
//     message: "Test payment event received",
//   });
// }



//     // 7. Find the customer's payment record
//     const customerPayment = await prisma.tenantPayment.findUnique({
//       where: {
//         razorpayOrderId: payment.order_id,
//       },
//     });

//     if (!customerPayment || customerPayment.tenantId !== tenantId) {

//       return res.status(200).json({
//         success: true,
//         message: "Customer payment record not found",
//       });
//     }

//     // 8. Update successful payment
//     if (event === "payment.captured") {
//       if (
//         payment.status !== "captured" ||
//         payment.amount !== customerPayment.amount ||
//         payment.currency !== customerPayment.currency
//       ) {
//         return res.status(400).json({
//           success: false,
//           message: "Payment details do not match",
//         });
//       }

//       if (customerPayment.status !== "CAPTURED") {
//         await prisma.tenantPayment.update({
//           where: {
//             paymentId: customerPayment.paymentId,
//           },
//           data: {
//             razorpayPaymentId: payment.id,
//             status: "CAPTURED",
//           },
//         });
//       }

//       console.log("Customer payment captured:", payment.id);
//     }

//     // 9. Update failed payment
//     if (event === "payment.failed" && customerPayment.status !== "CAPTURED") {
//       await prisma.tenantPayment.update({
//         where: {
//           paymentId: customerPayment.paymentId,
//         },
//         data: {
//           razorpayPaymentId: payment.id,
//           status: "FAILED",
//         },
//       });

//       console.log("Customer payment failed:", payment.id);
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Payment record updated",
//     });
//   } catch (error) {
//     console.error("Razorpay webhook error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Webhook processing failed",
//     });
//   }
// };

const tenantRazorpayWebhook = async (req, res) => {
    try {
      const { tenantId } = req.params;
      const rawBody = req.body;
      const signature = req.headers["x-razorpay-signature"];
  
      // 1. Validate request
      if (!Buffer.isBuffer(rawBody) || !signature) {
        return res.status(400).json({
          success: false,
          message: "Invalid webhook request",
        });
      }
  
      // 2. Find gateway
      const gateway = await prisma.tenantPaymentGateway.findUnique({
        where: { tenantId },
      });
  
      if (!gateway || !gateway.webhookSecret) {
        return res.status(404).json({
          success: false,
          message: "Tenant gateway not found",
        });
      }
  
      // 3. Verify signature
      const expectedSignature = crypto
        .createHmac("sha256", gateway.webhookSecret)
        .update(rawBody)
        .digest("hex");
  
      const received = Buffer.from(signature, "hex");
      const expected = Buffer.from(expectedSignature, "hex");
  
      if (
        received.length !== expected.length ||
        !crypto.timingSafeEqual(received, expected)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid webhook signature",
        });
      }
  
      // 4. Read event
      const { event, payload } = JSON.parse(rawBody.toString("utf8"));
      const payment = payload?.payment?.entity;
  
      console.log("Razorpay event:", event);
  
      if (!["payment.captured", "payment.failed"].includes(event)) {
        return res.status(200).json({
          success: true,
          message: "Event ignored",
        });
      }
  
      if (!payment?.id || !payment?.order_id) {
        return res.status(200).json({
          success: true,
          message: "Payment details missing",
        });
      }
  
      // 5. Webhook verification order
      // Use a separate order ID for webhook verification.
      if (payment.order_id === gateway.webhookVerificationOrderId) {
        await prisma.tenantPaymentGateway.update({
          where: { tenantId },
          data: {
            webhookVerifiedAt: new Date(),
            connectionStatus: "WEBHOOK_VERIFIED",
            lastVerifiedAt: new Date(),
          },
        });
  
        return res.status(200).json({
          success: true,
          signatureVerified: true,
          message: "Webhook verification successful",
        });
      }
  
      // 6. ₹1 test payment
      if (payment.order_id === gateway.testPaymentOrderId) {
        if (
          event === "payment.captured" &&
          payment.status === "captured" &&
          payment.amount === 100 &&
          payment.currency === "INR"
        ) {
          await prisma.tenantPaymentGateway.update({
            where: { tenantId },
            data: {
              isVerified: true,
              connectionStatus: "CONNECTED",
              testPaymentId: payment.id,
              testPaymentAt: new Date(),
              lastVerifiedAt: new Date(),
            },
          });
  
          return res.status(200).json({
            success: true,
            message: "Test payment successful. Gateway connected.",
          });
        }
  
        return res.status(200).json({
          success: true,
          message:
            event === "payment.failed"
              ? "Test payment failed"
              : "Test payment event received",
        });
      }
  
      // 7. Find customer payment
      const customerPayment = await prisma.tenantPayment.findUnique({
        where: { razorpayOrderId: payment.order_id },
      });
  
      if (!customerPayment || customerPayment.tenantId !== tenantId) {
        return res.status(200).json({
          success: true,
          message: "Customer payment record not found",
        });
      }
  
      // 8. Customer payment captured
      if (event === "payment.captured") {
        if (
          payment.status !== "captured" ||
          payment.amount !== customerPayment.amount ||
          payment.currency !== customerPayment.currency
        ) {
          return res.status(400).json({
            success: false,
            message: "Payment details do not match",
          });
        }
  
        if (customerPayment.status !== "CAPTURED") {
          await prisma.tenantPayment.update({
            where: { paymentId: customerPayment.paymentId },
            data: {
              razorpayPaymentId: payment.id,
              status: "CAPTURED",
            },
          });
        }
  
        return res.status(200).json({
          success: true,
          message: "Customer payment captured",
        });
      }
  
      // 9. Customer payment failed
      if (event === "payment.failed") {
        if (customerPayment.status === "CAPTURED") {
          return res.status(200).json({
            success: true,
            message: "Payment already captured",
          });
        }
  
        await prisma.tenantPayment.update({
          where: { paymentId: customerPayment.paymentId },
          data: {
            razorpayPaymentId: payment.id,
            status: "FAILED",
          },
        });
  
        return res.status(200).json({
          success: true,
          message: "Customer payment failed",
        });
      }
    } catch (error) {
      console.error("Razorpay webhook error:", error);
  
      return res.status(500).json({
        success: false,
        message: "Webhook processing failed",
      });
    }
  };
  


module.exports = {
  connectGateway,
  createTestOrder,
  getGatewayStatus,
  tenantRazorpayWebhook,
  testWebhookConnection  
};