// const Razorpay = require("razorpay");
// const crypto = require("crypto");

// const prisma = require("../config/prisma");


// // ============================================================
// // 1. UPDATE TENANT PAYMENT GATEWAY
// // ============================================================
// // PUT /api/v1/tenant/payment-gateway
// // ============================================================

// const updateTenantPaymentGateway = async (req, res) => {
//   try {
//     const tenantId = req.user?.tenantId;

//     if (!tenantId) {
//         return res.status(401).json({
//           success: false,
//           message: "Authenticated tenant not found",
//         });
//       }

//     const {
//       provider,
//       keyId,
//       keySecret,
//       websiteUrl,
//     } = req.body;


//     // ========================================================
//     // VALIDATION
//     // ========================================================

//     if (!provider) {
//       return res.status(400).json({
//         success: false,
//         message: "Provider is required",
//       });
//     }


//     if (provider !== "RAZORPAY") {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Only Razorpay provider is supported",
//       });
//     }


//     if (!keyId || !keySecret) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Razorpay Key ID and Key Secret are required",
//       });
//     }


//     // ========================================================
//     // VERIFY RAZORPAY CREDENTIALS
//     // ========================================================

//     const razorpay = new Razorpay({
//       key_id: keyId,
//       key_secret: keySecret,
//     });


//     try {
//      await razorpay.orders.all({
//         count: 1,
//       });
//     } catch (error) {
//       console.error(
//         "Razorpay credential verification error:",
//         error?.error || error
//       );
//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid Razorpay Key ID or Key Secret",
//       });
//     }

//     // ========================================================
//     // CREATE / UPDATE GATEWAY
//     // ========================================================

//     const gateway = await prisma.TenantPaymentGateway.upsert({
//         where: {
//           tenantId,
//         },
//         create: {
//           tenantId,
//           provider,
//           keyId,
//           keySecret,
//           websiteUrl: websiteUrl,
//           isVerified: false,
//           connectionStatus: "TEST_PAYMENT_PENDING",
//           lastVerifiedAt: null,
//           testPaymentId: null,
//           testPaymentAt: null,
//         },
//         // ====================================================
//         // UPDATE
//         // ====================================================
//         update: {
//             provider,
//             keyId,
//             keySecret,
//             websiteUrl: websiteUrl,
//             isVerified: false,
//             connectionStatus: "TEST_PAYMENT_PENDING",
//             lastVerifiedAt: null,
//             testPaymentId: null,
//             testPaymentAt: null,
//         },
//       });
//     // ========================================================
//     // RESPONSE
//     // ========================================================

//     return res.status(200).json({
//       success: true,
//       message: "Razorpay credentials updated successfully",
//       data: {
//         gatewayId: gateway.gatewayId,
//         provider: gateway.provider,
//         websiteUrl: gateway.websiteUrl,
//         isVerified: gateway.isVerified,
//         connectionStatus: gateway.connectionStatus,
//         lastVerifiedAt: gateway.lastVerifiedAt,
//       },
//     });

//   } catch (error) {

//     console.error(
//       "updateTenantPaymentGateway:",
//       error
//     );

//     return res.status(500).json({

//       success: false,

//       message:
//         "Failed to update payment gateway",

//     });
//   }
// };


// // ============================================================
// // 2. GET WEBHOOK CONFIGURATION
// // ============================================================
// // GET /api/v1/tenant/payment-gateway/webhook
// // ============================================================

// const getTenantPaymentGatewayWebhook = async (req, res) => {

//     try {

//       const tenantId =req.user.tenantId;


//       // ======================================================
//       // GET TENANT
//       // ======================================================

//       const tenant =
//         await prisma.tenant.findUnique({

//           where: {
//             tenantId,
//           },

//           select: {

//             tenantId: true,

//             name: true,

//           },

//         });


//       if (!tenant) {

//         return res.status(404).json({

//           success: false,

//           message:
//             "Tenant not found",

//         });

//       }


//       // ======================================================
//       // GET PAYMENT GATEWAY
//       // ======================================================

//       const gateway =
//         await prisma.tenantPaymentGateway.findUnique({

//           where: {
//             tenantId,
//           },

//         });


//       // ======================================================
//       // NOT CONFIGURED
//       // ======================================================

//       if (!gateway) {

//         return res.status(400).json({

//           success: false,

//           data: {

//             tenantId:
//               tenant.tenantId,

//             tenantName:
//               tenant.name,

//             gatewayName:
//               "RAZORPAY",

//             status:
//               "not_configured",

//             statusDetails: {

//               configured: false,

//               verified: false,

//               message:
//                 "Payment gateway is not configured. Please add Razorpay credentials first.",

//             },

//             webhookUrl: null,

//             webhookSecret: null,

//             events: [
//               "For All events",
//             ],

//           },

//         });

//       }


//       // ======================================================
//       // WEBHOOK URL
//       // ======================================================

//       const webhookUrl = `${process.env.BUILD_FREE_WEBHOOK_URL}/${tenantId}`;


//       // ======================================================
//       // WEBHOOK STATUS
//       // ======================================================

//       const webhookVerified =
//         !!gateway.webhookVerifiedAt;


//       // ======================================================
//       // RESPONSE
//       // ======================================================

//       return res.status(200).json({

//         success: true,

//         data: {

//           tenantId:
//             tenant.tenantId,

//           tenantName:
//             tenant.name,

//           gatewayName:
//             gateway.provider,

//           status:
//             webhookVerified
//               ? "webhook_verified"
//               : "webhook_pending",

//           statusDetails: {

//             configured: true,

//             verified:
//               webhookVerified,

//             message:
//               webhookVerified
//                 ? "Razorpay webhook is verified successfully."
//                 : "Razorpay credentials are configured. Please configure the webhook in Razorpay Dashboard.",

//           },

//           webhookUrl,

//           webhookSecret:
//             gateway.webhookSecret,

//           webhookVerifiedAt:
//             gateway.webhookVerifiedAt,

//           lastEvent:
//             gateway.webhookLastEvent,

//           events: [
//             "For All events",
//           ],

//           instructions: [

//             "1. Login to your Razorpay Dashboard",

//             "2. Go to Settings > Webhooks",

//             "3. Click on Add New Webhook",

//             `4. Enter this webhook URL: ${webhookUrl}`,

//             "5. Select the required events or all events",

//             `6. Set the webhook secret: ${gateway.webhookSecret}`,

//             "7. Save the webhook configuration",

//             "8. Trigger a Razorpay test event",

//             "9. Come back to BuildFree and click Check Connection",

//           ],

//         },

//       });

//     } catch (error) {

//       console.error(
//         "getTenantPaymentGatewayWebhook:",
//         error
//       );

//       return res.status(500).json({

//         success: false,

//         message:
//           "Failed to get payment gateway webhook configuration",

//       });

//     }

//   };




// const tenantPaymentGatewayWebhook = async (req,res) =>{
// try{
//     // 1. Verify webhook
//     const signature = req.headers["x-razorpay-signature"];

//     const expectedSignature = crypto
//       .createHmac("sha256", config.razorpay.keySecret)
//       .update(req.body)
//       .digest("hex");

//     if (signature !== expectedSignature) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid signature",
//       });
//     }

//     // 2. Convert Buffer to JSON
//     const webhookData = JSON.parse(
//       req.body.toString("utf8")
//     );

//     const { event, payload } = webhookData;
// }catch(error){

// }
// }


 

// // ============================================================
// // 3. CHECK WEBHOOK CONNECTION
// // ============================================================
// // POST /api/v1/tenant/payment-gateway/webhook/check
// // ============================================================

// const checkRazorpayWebhook = async (req, res) => {

//     try {

//       const tenantId = req.user.tenantId;


//       // ======================================================
//       // GET GATEWAY
//       // ======================================================

//       const gateway = await prisma.tenantPaymentGateway.findUnique({
//           where: {
//             tenantId,
//           },

//         });


//       // ======================================================
//       // NOT CONFIGURED
//       // ======================================================

//       if (!gateway) {

//         return res.status(400).json({

//           success: false,

//           data: {

//             configured: false,

//             webhookVerified: false,

//             connected: false,

//           },

//           message:
//             "Razorpay payment gateway is not configured",

//         });

//       }


//       // ======================================================
//       // WEBHOOK NOT VERIFIED
//       // ======================================================

//       if (!gateway.webhookVerifiedAt) {

//         return res.status(400).json({

//           success: false,

//           data: {

//             configured: true,

//             webhookVerified: false,

//             connected: false,

//             webhookUrl:
//               `${process.env.BUILD_FREE_WEBHOOK_URL}/${tenantId}`,

//           },

//           message:
//             "Webhook connection has not been verified. Please configure the webhook in Razorpay and trigger a test webhook.",

//         });

//       }


//       // ======================================================
//       // WEBHOOK VERIFIED
//       // ======================================================

//       return res.status(200).json({

//         success: true,

//         message:
//           "Razorpay webhook connection verified successfully",

//         data: {

//           configured: true,

//           webhookVerified: true,

//           connected: true,

//           webhookUrl:
//             `${process.env.BUILD_FREE_WEBHOOK_URL}/${tenantId}`,

//           webhookVerifiedAt:
//             gateway.webhookVerifiedAt,

//           lastEvent:
//             gateway.webhookLastEvent,

//         },

//       });

//     } catch (error) {

//       console.error(
//         "checkRazorpayWebhook:",
//         error
//       );

//       return res.status(500).json({

//         success: false,

//         message:
//           "Failed to check Razorpay webhook connection",

//       });

//     }

//   };



// // ============================================================
// // 4. RAZORPAY PUBLIC WEBHOOK
// // ============================================================
// // POST /api/v1/public/payments/razorpay/webhook/:tenantId
// // ============================================================

// const handleRazorpayWebhook = async (req, res) => {

//     try {

//       const tenantId =
//         req.params.tenantId;


//       // ======================================================
//       // GET GATEWAY
//       // ======================================================

//       const gateway =
//         await prisma.tenantPaymentGateway.findUnique({

//           where: {
//             tenantId,
//           },

//         });


//       if (!gateway) {

//         return res.status(404).json({

//           success: false,

//           message:
//             "Payment gateway not found",

//         });

//       }


//       // ======================================================
//       // WEBHOOK SECRET CHECK
//       // ======================================================

//       if (!gateway.webhookSecret) {

//         return res.status(400).json({

//           success: false,

//           message:
//             "Webhook secret is not configured",

//         });

//       }


//       // ======================================================
//       // GET RAZORPAY SIGNATURE
//       // ======================================================

//       const razorpaySignature =
//         req.headers[
//           "x-razorpay-signature"
//         ];


//       if (!razorpaySignature) {

//         return res.status(400).json({

//           success: false,

//           message:
//             "Razorpay webhook signature is missing",

//         });

//       }


//       // ======================================================
//       // RAW BODY
//       // ======================================================

//       const rawBody =
//         Buffer.isBuffer(req.body)

//           ? req.body

//           : Buffer.from(
//               JSON.stringify(req.body)
//             );


//       // ======================================================
//       // GENERATE EXPECTED SIGNATURE
//       // ======================================================

//       const expectedSignature =
//         crypto
//           .createHmac(
//             "sha256",
//             gateway.webhookSecret
//           )
//           .update(rawBody)
//           .digest("hex");


//       // ======================================================
//       // COMPARE SIGNATURE LENGTH
//       // ======================================================

//       const receivedBuffer =
//         Buffer.from(
//           razorpaySignature,
//           "utf8"
//         );

//       const expectedBuffer =
//         Buffer.from(
//           expectedSignature,
//           "utf8"
//         );


//       if (
//         receivedBuffer.length !==
//         expectedBuffer.length
//       ) {

//         return res.status(400).json({

//           success: false,

//           message:
//             "Invalid Razorpay webhook signature",

//         });

//       }


//       // ======================================================
//       // COMPARE SIGNATURE
//       // ======================================================

//       const signatureValid =
//         crypto.timingSafeEqual(
//           receivedBuffer,
//           expectedBuffer
//         );


//       if (!signatureValid) {

//         return res.status(400).json({

//           success: false,

//           message:
//             "Invalid Razorpay webhook signature",

//         });

//       }


//       // ======================================================
//       // PARSE PAYLOAD
//       // ======================================================

//       const payload =
//         JSON.parse(
//           rawBody.toString("utf8")
//         );


//       const event =
//         payload.event || null;


//       // ======================================================
//       // SAVE WEBHOOK VERIFICATION
//       // ======================================================

//       await prisma.tenantPaymentGateway.update({

//         where: {
//           tenantId,
//         },

//         data: {

//           webhookVerifiedAt:
//             new Date(),

//           webhookLastEvent:
//             event,

//           lastVerifiedAt:
//             new Date(),

//         },

//       });


//       // ======================================================
//       // LOG
//       // ======================================================

//       console.log(
//         "Razorpay webhook received"
//       );

//       console.log(
//         "Tenant:",
//         tenantId
//       );

//       console.log(
//         "Event:",
//         event
//       );


//       // ======================================================
//       // RESPONSE
//       // ======================================================

//       return res.status(200).json({

//         success: true,

//         message:
//           "Razorpay webhook received successfully",

//       });

//     } catch (error) {

//       console.error(
//         "handleRazorpayWebhook:",
//         error
//       );

//       return res.status(500).json({

//         success: false,

//         message:
//           "Webhook processing failed",

//       });

//     }

//   };


// // ============================================================
// // EXPORT
// // ============================================================

// module.exports = {
//   updateTenantPaymentGateway,
//   tenantPaymentGatewayWebhook,
//   getTenantPaymentGatewayWebhook,
//   checkRazorpayWebhook,
//   handleRazorpayWebhook,
// };

const crypto = require("crypto");
const Razorpay = require("razorpay");
const prisma = require("../config/prisma");

// =====================================================
// HELPER: CREATE RAZORPAY CLIENT
// =====================================================
const getRazorpay = (gateway) => {
  return new Razorpay({
    key_id: gateway.keyId,
    key_secret: gateway.keySecret,
  });
};

// =====================================================
// HELPER: VERIFY WEBHOOK SIGNATURE
// =====================================================
const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (
    !Buffer.isBuffer(rawBody) ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest();

  const received = Buffer.from(signature, "hex");

  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(received, expected)
  );
};

// =====================================================
// 1. CONNECT RAZORPAY
// POST /api/v1/payment-gateway/connect
// =====================================================
const connectGateway = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;

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

    await prisma.tenantPaymentGateway.upsert({
      where: { tenantId },

      create: {
        tenantId,
        provider: provider ,
        keyId: keyId.trim(),
        keySecret: keySecret.trim(),
        webhookSecret,
        websiteUrl,
        isVerified: false,
        connectionStatus: "WEBHOOK_PENDING",
      },

      update: {
        keyId: keyId.trim(),
        keySecret: keySecret.trim(),
        webhookSecret,
        websiteUrl,
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
      message: "Credentials validated.",
    //   data: {
    //     webhookUrl:
    //       `${process.env.PUBLIC_API_URL}/api/v1/webhooks/razorpay`,
    //     webhookSecret,
    //     connectionStatus: "WEBHOOK_PENDING",
    //   },
    });
  } catch (error) {
    console.error("Connect gateway error:", error.message);

    return res.status(400).json({
      success: false,
      message: "Credential validation failed",
    });
  }
};

// =====================================================
// 2. CREATE ₹1 TEST ORDER
// POST /api/v1/payment-gateway/test-order
// =====================================================
const createTestOrder = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const gateway = await prisma.tenantPaymentGateway.findUnique({
      where: { tenantId },
    });

    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: "Connect Razorpay first",
      });
    }

    if (gateway.connectionStatus !== "WEBHOOK_VERIFIED") {
      return res.status(400).json({
        success: false,
        message: "Verify webhook configuration first",
      });
    }

    const razorpay = getRazorpay(gateway);

    const order = await razorpay.orders.create({
      amount: 100, // ₹1 = 100 paise
      currency: "INR",
      receipt: `test_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
      notes: {
        tenantId,
        purpose: "gateway_connection_test",
      },
    });

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

    return res.status(201).json({
      success: true,
      message: "Complete the ₹1 payment using Razorpay Checkout",
      data: {
        keyId: gateway.keyId,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      },
    });
  } catch (error) {
    console.error("Test order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create test order",
    });
  }
};



const testWebhookConnection = async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
  
      if (!tenantId) {
        return res.status(401).json({
          success: false,
          message: "Tenant not found",
        });
      }
  
      const gateway = await prisma.tenantPaymentGateway.findUnique({
        where: { tenantId },
      });
  
      if (!gateway) {
        return res.status(404).json({
          success: false,
          message: "Connect Razorpay credentials first",
        });
      }
  
      const payload = {
        entity: "event",
        event: "order.paid",
        contains: ["order"],
        payload: {
          order: {
            entity: {
              id: "order_test_buildfree",
              status: "paid",
            },
          },
        },
        created_at: Math.floor(Date.now() / 1000),
      };
  
      const rawBody = JSON.stringify(payload);
  
      const signature = crypto
        .createHmac("sha256", gateway.webhookSecret)
        .update(rawBody)
        .digest("hex");
  
      const webhookUrl =
        `https://cms-backend-9nkz.onrender.com/api/v1/webhooks/razorpay`;
  
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Razorpay-Signature": signature,
        },
        body: rawBody,
      });
  
      const responseText = await response.text();
  
      return res.status(200).json({
        success: response.ok,
        message: response.ok
          ? "Simulated webhook request delivered"
          : "Webhook endpoint returned an error",
        webhookHttpStatus: response.status,
        webhookResponse: responseText,
        note: "This is a simulated request, not a genuine Razorpay webhook.",
      });
    } catch (error) {
      console.error("Test webhook error:", error.message);
  
      return res.status(500).json({
        success: false,
        message: "Unable to send simulated webhook",
      });
    }
  };
  

// =====================================================
// 3. GET CONNECTION STATUS
// GET /api/v1/payment-gateway/status
// =====================================================
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

// =====================================================
// 4. SHARED RAZORPAY WEBHOOK
// POST /api/v1/webhooks/razorpay
// =====================================================
const tenantRazorpayWebhook = async (req, res) => {
  try {
    const rawBody = req.body;
    const signature = req.headers["x-razorpay-signature"];

    if (!Buffer.isBuffer(rawBody) || !signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook request",
      });
    }

    // Shared endpoint: identify the tenant by verifying its secret.
    const gateways = await prisma.tenantPaymentGateway.findMany();

    let gateway = null;

    for (const item of gateways) {
      if (
        verifyWebhookSignature(
          rawBody,
          signature,
          item.webhookSecret
        )
      ) {
        gateway = item;
        break;
      }
    }

    if (!gateway) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    const body = JSON.parse(rawBody.toString("utf8"));
    const { event, payload } = body;
    const payment = payload?.payment?.entity;

    // A valid signed event proves this secret can authenticate
    // a webhook, but it does not prove the ₹1 payment succeeded.
    if (gateway.connectionStatus === "WEBHOOK_PENDING") {
      await prisma.tenantPaymentGateway.updateMany({
        where: {
          tenantId: gateway.tenantId,
          connectionStatus: "WEBHOOK_PENDING",
        },
        data: {
          connectionStatus: "WEBHOOK_VERIFIED",
          webhookVerifiedAt: new Date(),
        },
      });
    }

    if (!payment?.id || !payment?.order_id) {
      return res.status(200).json({
        success: true,
        message: "Webhook acknowledged",
      });
    }

    // ---------------------------------------------
    // A. FIRST-TIME ₹1 TEST PAYMENT
    // ---------------------------------------------
    if (payment.order_id === gateway.testPaymentOrderId) {
      if (
        event === "payment.captured" &&
        payment.amount === 100 &&
        payment.currency === "INR" &&
        payment.status === "captured"
      ) {
        await prisma.tenantPaymentGateway.updateMany({
          where: {
            tenantId: gateway.tenantId,
            testPaymentOrderId: payment.order_id,
            connectionStatus: "TEST_PAYMENT_PENDING",
          },
          data: {
            isVerified: true,
            connectionStatus: "CONNECTED",
            testPaymentId: payment.id,
            testPaymentAt: new Date(),
            lastVerifiedAt: new Date(),
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: "Test payment event processed",
      });
    }

    // ---------------------------------------------
    // B. NORMAL CUSTOMER PAYMENT
    // ---------------------------------------------
    if (
      !["payment.captured", "payment.failed"].includes(event)
    ) {
      return res.status(200).json({
        success: true,
        message: "Event acknowledged",
      });
    }

    const customerPayment = await prisma.tenantPayment.findUnique({
      where: {
        razorpayOrderId: payment.order_id,
      },
    });

    if (!customerPayment || customerPayment.tenantId !== gateway.tenantId) {
      // Unknown orders must not update any payment.
      return res.status(200).json({
        success: true,
        message: "No matching customer payment",
      });
    }

    if (event === "payment.captured") {
      if (
        payment.status !== "captured" ||
        payment.amount !== customerPayment.amount ||
        payment.currency !== customerPayment.currency
      ) {
        return res.status(400).json({
          success: false,
          message: "Payment details do not match the order",
        });
      }

      // Don't overwrite an existing captured payment.
      if (customerPayment.status !== "CAPTURED") {
        await prisma.tenantPayment.update({
          where: { paymentId: customerPayment.paymentId },
          data: {
            razorpayPaymentId: payment.id,
            status: "CAPTURED",
          },
        });
      }
    }

    if (
      event === "payment.failed" &&
      customerPayment.status !== "CAPTURED"
    ) {
      await prisma.tenantPayment.update({
        where: { paymentId: customerPayment.paymentId },
        data: {
          razorpayPaymentId: payment.id,
          status: "FAILED",
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer payment webhook processed",
    });
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