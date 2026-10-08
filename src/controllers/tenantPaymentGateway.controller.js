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
//     const tenantId = "cmu10wts9000am51gie4iprm6";

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
//      const jarom = await razorpay.orders.all({
//         count: 1,
//       });
// console.log(jarom)
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
//     // CHECK EXISTING GATEWAY
//     // ========================================================

//     const existingGateway =
//       await prisma.TenantPaymentGateway.findUnique({
//         where: {
//           tenantId,
//         },
//       });


//     // ========================================================
//     // GENERATE WEBHOOK SECRET
//     // ========================================================

//     let webhookSecret;

//     if (existingGateway?.webhookSecret) {

//       // Keep existing secret if credentials
//       // are being updated.

//       webhookSecret =
//         existingGateway.webhookSecret;

//     } else {

//       webhookSecret =
//         crypto.randomBytes(32).toString("hex");
//     }


//     // ========================================================
//     // CREATE / UPDATE GATEWAY
//     // ========================================================

//     const gateway =
//       await prisma.TenantPaymentGateway.upsert({

//         where: {
//           tenantId,
//         },


//         // ====================================================
//         // CREATE
//         // ====================================================

//         create: {

//           tenantId,

//           provider,

//           keyId,

//           keySecret,

//         //   webhookSecret,

//           websiteUrl:
//             websiteUrl || null,

//           isConnected: false,

//           lastVerifiedAt:
//             new Date(),

//         //   webhookVerifiedAt: null,

//         //   webhookLastEvent: null,

//           testPaymentId: null,

//           testPaymentAt: null,
//         },


//         // ====================================================
//         // UPDATE
//         // ====================================================

//         update: {

//           provider,

//           keyId,

//           keySecret,

//         //   webhookSecret,

//           websiteUrl:
//             websiteUrl || null,

//           // Credentials are valid,
//           // but full connection is not complete.

//           isConnected: false,

//           lastVerifiedAt:
//             new Date(),

//           // Old webhook verification
//           // should not be trusted after credentials change.

//         //   webhookVerifiedAt: null,

//         //   webhookLastEvent: null,

//           // Old test payment should not be reused.

//           testPaymentId: null,

//           testPaymentAt: null,
//         },

//       });


//     // ========================================================
//     // RESPONSE
//     // ========================================================

//     return res.status(200).json({

//       success: true,

//       message:
//         "Razorpay credentials updated successfully",

//       data: {

//         gatewayId:
//           gateway.gatewayId,

//         provider:
//           gateway.provider,

//         websiteUrl:
//           gateway.websiteUrl,

//         isConnected:
//           gateway.isConnected,

//         lastVerifiedAt:
//           gateway.lastVerifiedAt,
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

//       const tenantId =
//         req.user.tenantId;


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

//       const webhookUrl =
//         `${process.env.BUILD_FREE_WEBHOOK_URL}/${tenantId}`;


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
//   getTenantPaymentGatewayWebhook,
//   checkRazorpayWebhook,
//   handleRazorpayWebhook,
// };



const Razorpay = require("razorpay");
const crypto = require("crypto");

const prisma = require("../config/prisma");

// ============================================================
// UPDATE RAZORPAY CONFIG
// ============================================================

const updateRazorpayConfig = async (req, res) => {
  try {
    console.log("\n========================================");
    console.log("UPDATE RAZORPAY CONFIG");
    console.log("========================================");

    const tenantId = "cmu10wts9000am51gie4iprm6";

    console.log("Tenant ID:", tenantId);

    const {
      provider,
      keyId,
      keySecret,
      websiteUrl,
    } = req.body;


    // ========================================================
    // VALIDATION
    // ========================================================

    if (!keyId) {
      return res.status(400).json({
        success: false,
        message: "Razorpay Key ID is required",
      });
    }

    if (!keySecret) {
      return res.status(400).json({
        success: false,
        message: "Razorpay Key Secret is required",
      });
    }

    if (provider && provider !== "RAZORPAY") {
      return res.status(400).json({
        success: false,
        message: "Only Razorpay is supported",
      });
    }


    // ========================================================
    // CREATE RAZORPAY CLIENT
    // ========================================================

    console.log("Creating Razorpay client...");

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });


    // ========================================================
    // VERIFY RAZORPAY API
    // ========================================================

    console.log("Checking Razorpay credentials...");

    try {
      const orders = await razorpay.orders.all({
        count: 1,
      });

      console.log("Razorpay credentials are valid");

      console.log(
        "Orders count:",
        orders.count
      );

    } catch (error) {

      console.error(
        "Razorpay credential verification failed:",
        error.message
      );

      return res.status(400).json({
        success: false,
        message:
          "Invalid Razorpay Key ID or Key Secret",
      });
    }


    // ========================================================
    // SAVE CONFIGURATION
    // ========================================================

    console.log("Saving Razorpay configuration...");

    const gateway =
      await prisma.tenantPaymentGateway.upsert({

        where: {
          tenantId,
        },

        create: {

          tenantId,

          provider:
            provider || "RAZORPAY",

          keyId,

          keySecret,

          websiteUrl,

          isConnected: false,

          lastVerifiedAt: null,

          testPaymentId: null,

          testPaymentAt: null,
        },

        update: {

          provider:
            provider || "RAZORPAY",

          keyId,

          keySecret,

          websiteUrl,

          /*
            Credentials changed,
            so require another connection test.
          */

          isConnected: false,

          lastVerifiedAt: null,

          testPaymentId: null,

          testPaymentAt: null,
        },
      });


    console.log(
      "Gateway saved:",
      gateway.gatewayId
    );


    return res.status(200).json({

      success: true,

      data: {

        gatewayId:
          gateway.gatewayId,

        provider:
          gateway.provider,

        websiteUrl:
          gateway.websiteUrl,

        isConnected:
          gateway.isConnected,

        lastVerifiedAt:
          gateway.lastVerifiedAt,
      },

      message:
        "Razorpay configuration saved successfully",
    });


  } catch (error) {

    console.error(
      "updateRazorpayConfig error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Failed to update Razorpay configuration",
    });
  }
};



// ============================================================
// GET RAZORPAY CONFIG
// ============================================================

const getRazorpayConfig = async (req, res) => {

  try {

    console.log("\n========================================");
    console.log("GET RAZORPAY CONFIG");
    console.log("========================================");

    const tenantId = "cmu10wts9000am51gie4iprm6";

    console.log("Tenant ID:", tenantId);


    const gateway =
      await prisma.tenantPaymentGateway.findUnique({

        where: {
          tenantId,
        },

        select: {

          gatewayId: true,

          provider: true,

          keyId: true,

          websiteUrl: true,

          isConnected: true,

          lastVerifiedAt: true,

          testPaymentId: true,

          testPaymentAt: true,

          createdAt: true,

          updatedAt: true,
        },
      });


    if (!gateway) {

      return res.status(404).json({

        success: false,

        message:
          "Razorpay is not configured",
      });
    }


    return res.status(200).json({

      success: true,

      data: gateway,

      message:
        "Razorpay configuration fetched successfully",
    });


  } catch (error) {

    console.error(
      "getRazorpayConfig error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Failed to fetch Razorpay configuration",
    });
  }
};



// ============================================================
// TEST RAZORPAY CONNECTION
// ============================================================

const testRazorpayConnection = async (
  req,
  res
) => {

  try {

    console.log("\n========================================");
    console.log("TEST RAZORPAY CONNECTION");
    console.log("========================================");


    const tenantId =
      "cmu10wts9000am51gie4iprm6";


    console.log(
      "Tenant ID:",
      tenantId
    );


    // ========================================================
    // GET GATEWAY
    // ========================================================

    const gateway =
      await prisma.tenantPaymentGateway.findUnique({

        where: {
          tenantId,
        },
      });


    if (!gateway) {

      return res.status(404).json({

        success: false,

        message:
          "Razorpay is not configured",
      });
    }


    console.log(
      "Gateway found:",
      gateway.gatewayId
    );


    // ========================================================
    // CREATE RAZORPAY CLIENT
    // ========================================================

    const razorpay =
      new Razorpay({

        key_id:
          gateway.keyId,

        key_secret:
          gateway.keySecret,
      });


    // ========================================================
    // STEP 1
    // TEST API
    // ========================================================

    console.log(
      "\nStep 1: Testing Razorpay API..."
    );


    try {

      const orders =
        await razorpay.orders.all({

          count: 1,
        });


      console.log(
        "Razorpay API connected"
      );

      console.log(
        "Orders count:",
        orders.count
      );

    } catch (error) {

      console.error(
        "Razorpay API failed:",
        error.message
      );


      await prisma.tenantPaymentGateway.update({

        where: {
          tenantId,
        },

        data: {

          isConnected: false,

          lastVerifiedAt: null,
        },
      });


      return res.status(400).json({

        success: false,

        data: {

          apiConnected: false,

          webhookConnected: false,

          isConnected: false,
        },

        message:
          "Razorpay credentials are invalid",
      });
    }


    // ========================================================
    // STEP 2
    // CREATE TEST ORDER
    // ========================================================

    console.log(
      "\nStep 2: Creating Razorpay test order..."
    );


    let testOrder;


    try {

      testOrder =
        await razorpay.orders.create({

          amount: 1,

          currency: "INR",

          receipt:
            `buildfree_test_${Date.now()}`,

          notes: {

            tenantId:

              tenantId,

            purpose:
              "BuildFree Razorpay connection test",
          },
        });


      console.log(
        "Test order created successfully"
      );

      console.log(
        "Test Order ID:",
        testOrder.id
      );

      console.log(
        "Test Order Status:",
        testOrder.status
      );


    } catch (error) {

      console.error(
        "Test order creation failed:",
        error
      );


      return res.status(400).json({

        success: false,

        data: {

          apiConnected: true,

          webhookConnected: false,

          isConnected: false,
        },

        message:
          "Razorpay API works, but test order creation failed",
      });
    }


    // ========================================================
    // STEP 3
    // SAVE TEST ORDER ID
    // ========================================================

    console.log(
      "\nStep 3: Saving test order ID..."
    );


    await prisma.tenantPaymentGateway.update({

      where: {
        tenantId,
      },

      data: {

        /*
          Your current schema calls this
          testPaymentId.

          For V1 we store the Razorpay
          test ORDER ID here.
        */

        testPaymentId:
          testOrder.id,

        testPaymentAt:
          new Date(),

        /*
          IMPORTANT:

          We don't mark the webhook as verified here.
        */

        isConnected: true,

        lastVerifiedAt:
          new Date(),
      },
    });


    console.log(
      "Test order ID saved"
    );


    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({

      success: true,

      data: {

        apiConnected: true,

        webhookConnected: false,

        isConnected: true,

        testPaymentId:
          testOrder.id,

        testPaymentAt:
          new Date(),

        webhookUrl:
          `${process.env.BUILD_FREE_WEBHOOK_URL}/razorpay`,
      },

      message:
        "Razorpay API connected. Waiting for webhook verification.",
    });


  } catch (error) {

    console.error(
      "testRazorpayConnection error:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Failed to test Razorpay connection",
    });
  }
};



// ============================================================
// RAZORPAY WEBHOOK
// ============================================================

const razorpayWebhook = async (req, res) => {

  try {

    console.log("\n========================================");
    console.log("RAZORPAY WEBHOOK RECEIVED");
    console.log("========================================");


    // ========================================================
    // SIGNATURE
    // ========================================================

    const signature =
      req.headers["x-razorpay-signature"];


    console.log(
      "Razorpay signature exists:",
      !!signature
    );


    if (!signature) {

      console.error(
        "Razorpay signature missing"
      );

      return res.status(400).json({

        success: false,

        message:
          "Razorpay signature missing",
      });
    }


    // ========================================================
    // RAW BODY
    // ========================================================

    const rawBody = req.body;


    console.log(
      "Body is Buffer:",
      Buffer.isBuffer(rawBody)
    );


    if (!Buffer.isBuffer(rawBody)) {

      console.error(
        "Webhook body is not raw Buffer"
      );

      return res.status(400).json({

        success: false,

        message:
          "Invalid webhook body",
      });
    }


    // ========================================================
    // PARSE WEBHOOK
    // ========================================================

    const event =
      JSON.parse(
        rawBody.toString("utf8")
      );


    console.log(
      "Webhook event:",
      event.event
    );


    // ========================================================
    // GET ORDER ID
    // ========================================================

    let orderId = null;


    /*
      Different Razorpay events can have
      different payload structures.

      Payment events:
      payload.payment.entity.order_id

      Order events:
      payload.order.entity.id
    */

    if (
      event.payload?.payment?.entity?.order_id
    ) {

      orderId =
        event.payload.payment.entity.order_id;

    } else if (
      event.payload?.order?.entity?.id
    ) {

      orderId =
        event.payload.order.entity.id;
    }


    console.log(
      "Order ID:",
      orderId
    );


    // ========================================================
    // NO ORDER ID
    // ========================================================

    if (!orderId) {

      console.log(
        "Order ID not found in webhook"
      );


      /*
        We received a valid-looking webhook,
        but cannot identify a tenant using
        the current schema.
      */

      return res.status(200).json({

        success: true,

        message:
          "Webhook received",
      });
    }


    // ========================================================
    // FIND TENANT USING TEST ORDER ID
    // ========================================================

    console.log(
      "Searching tenant using testPaymentId..."
    );


    const gateway =
      await prisma.tenantPaymentGateway.findFirst({

        where: {

          testPaymentId:
            orderId,
        },
      });


    if (!gateway) {

      console.log(
        "No tenant found for order:",
        orderId
      );


      /*
        This webhook is not the connection-test
        webhook for any tenant.
      */

      return res.status(200).json({

        success: true,

        message:
          "Webhook received",
      });
    }


    console.log(
      "Tenant found:",
      gateway.tenantId
    );


    // ========================================================
    // IMPORTANT
    // ========================================================

    /*
      With your CURRENT schema we don't have a
      webhookSecret field.

      Therefore we cannot perform Razorpay's
      HMAC signature verification here.

      For this V1 implementation, we only identify
      the tenant using testPaymentId.

      Later we should add webhookSecret and
      properly verify the signature.
    */


    console.log(
      "Webhook belongs to tenant:",
      gateway.tenantId
    );


    // ========================================================
    // MARK WEBHOOK AS CONNECTED
    // ========================================================

    await prisma.tenantPaymentGateway.update({

      where: {

        tenantId:
          gateway.tenantId,
      },

      data: {

        isConnected: true,

        lastVerifiedAt:
          new Date(),

        testPaymentAt:
          new Date(),
      },
    });


    console.log(
      "Webhook connection marked as connected"
    );


    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({

      success: true,

      message:
        "Razorpay webhook received successfully",
    });


  } catch (error) {

    console.error(
      "razorpayWebhook error:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Webhook processing failed",
    });
  }
};



module.exports = {

  updateRazorpayConfig,

  getRazorpayConfig,

  testRazorpayConnection,

  razorpayWebhook,
};