const Razorpay = require("razorpay");
const crypto = require("crypto");

const prisma = require("../config/prisma");


// ============================================================
// 1. UPDATE TENANT PAYMENT GATEWAY
// ============================================================
// PUT /api/v1/tenant/payment-gateway
// ============================================================

const updateTenantPaymentGateway = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const {
      provider,
      keyId,
      keySecret,
      websiteUrl,
    } = req.body;


    // ========================================================
    // VALIDATION
    // ========================================================

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: "Provider is required",
      });
    }


    if (provider !== "RAZORPAY") {
      return res.status(400).json({
        success: false,
        message:
          "Only Razorpay provider is supported",
      });
    }


    if (!keyId || !keySecret) {
      return res.status(400).json({
        success: false,
        message:
          "Razorpay Key ID and Key Secret are required",
      });
    }


    // ========================================================
    // VERIFY RAZORPAY CREDENTIALS
    // ========================================================

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });


    try {
      await razorpay.orders.all({
        count: 1,
      });

    } catch (error) {

      console.error(
        "Razorpay credential verification error:",
        error?.error || error
      );

      return res.status(400).json({
        success: false,
        message:
          "Invalid Razorpay Key ID or Key Secret",
      });
    }


    // ========================================================
    // CHECK EXISTING GATEWAY
    // ========================================================

    const existingGateway =
      await prisma.TenantPaymentGateway.findUnique({
        where: {
          tenantId,
        },
      });


    // ========================================================
    // GENERATE WEBHOOK SECRET
    // ========================================================

    let webhookSecret;

    if (existingGateway?.webhookSecret) {

      // Keep existing secret if credentials
      // are being updated.

      webhookSecret =
        existingGateway.webhookSecret;

    } else {

      webhookSecret =
        crypto.randomBytes(32).toString("hex");
    }


    // ========================================================
    // CREATE / UPDATE GATEWAY
    // ========================================================

    const gateway =
      await prisma.TenantPaymentGateway.upsert({

        where: {
          tenantId,
        },


        // ====================================================
        // CREATE
        // ====================================================

        create: {

          tenantId,

          provider,

          keyId,

          keySecret,

        //   webhookSecret,

          websiteUrl:
            websiteUrl || null,

          isConnected: false,

          lastVerifiedAt:
            new Date(),

        //   webhookVerifiedAt: null,

        //   webhookLastEvent: null,

          testPaymentId: null,

          testPaymentAt: null,
        },


        // ====================================================
        // UPDATE
        // ====================================================

        update: {

          provider,

          keyId,

          keySecret,

        //   webhookSecret,

          websiteUrl:
            websiteUrl || null,

          // Credentials are valid,
          // but full connection is not complete.

          isConnected: false,

          lastVerifiedAt:
            new Date(),

          // Old webhook verification
          // should not be trusted after credentials change.

        //   webhookVerifiedAt: null,

        //   webhookLastEvent: null,

          // Old test payment should not be reused.

          testPaymentId: null,

          testPaymentAt: null,
        },

      });


    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({

      success: true,

      message:
        "Razorpay credentials updated successfully",

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

    });

  } catch (error) {

    console.error(
      "updateTenantPaymentGateway:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Failed to update payment gateway",

    });
  }
};


// ============================================================
// 2. GET WEBHOOK CONFIGURATION
// ============================================================
// GET /api/v1/tenant/payment-gateway/webhook
// ============================================================

const getTenantPaymentGatewayWebhook = async (req, res) => {

    try {

      const tenantId =
        req.user.tenantId;


      // ======================================================
      // GET TENANT
      // ======================================================

      const tenant =
        await prisma.tenant.findUnique({

          where: {
            tenantId,
          },

          select: {

            tenantId: true,

            name: true,

          },

        });


      if (!tenant) {

        return res.status(404).json({

          success: false,

          message:
            "Tenant not found",

        });

      }


      // ======================================================
      // GET PAYMENT GATEWAY
      // ======================================================

      const gateway =
        await prisma.tenantPaymentGateway.findUnique({

          where: {
            tenantId,
          },

        });


      // ======================================================
      // NOT CONFIGURED
      // ======================================================

      if (!gateway) {

        return res.status(400).json({

          success: false,

          data: {

            tenantId:
              tenant.tenantId,

            tenantName:
              tenant.name,

            gatewayName:
              "RAZORPAY",

            status:
              "not_configured",

            statusDetails: {

              configured: false,

              verified: false,

              message:
                "Payment gateway is not configured. Please add Razorpay credentials first.",

            },

            webhookUrl: null,

            webhookSecret: null,

            events: [
              "For All events",
            ],

          },

        });

      }


      // ======================================================
      // WEBHOOK URL
      // ======================================================

      const webhookUrl =
        `${process.env.BUILD_FREE_WEBHOOK_URL}/${tenantId}`;


      // ======================================================
      // WEBHOOK STATUS
      // ======================================================

      const webhookVerified =
        !!gateway.webhookVerifiedAt;


      // ======================================================
      // RESPONSE
      // ======================================================

      return res.status(200).json({

        success: true,

        data: {

          tenantId:
            tenant.tenantId,

          tenantName:
            tenant.name,

          gatewayName:
            gateway.provider,

          status:
            webhookVerified
              ? "webhook_verified"
              : "webhook_pending",

          statusDetails: {

            configured: true,

            verified:
              webhookVerified,

            message:
              webhookVerified
                ? "Razorpay webhook is verified successfully."
                : "Razorpay credentials are configured. Please configure the webhook in Razorpay Dashboard.",

          },

          webhookUrl,

          webhookSecret:
            gateway.webhookSecret,

          webhookVerifiedAt:
            gateway.webhookVerifiedAt,

          lastEvent:
            gateway.webhookLastEvent,

          events: [
            "For All events",
          ],

          instructions: [

            "1. Login to your Razorpay Dashboard",

            "2. Go to Settings > Webhooks",

            "3. Click on Add New Webhook",

            `4. Enter this webhook URL: ${webhookUrl}`,

            "5. Select the required events or all events",

            `6. Set the webhook secret: ${gateway.webhookSecret}`,

            "7. Save the webhook configuration",

            "8. Trigger a Razorpay test event",

            "9. Come back to BuildFree and click Check Connection",

          ],

        },

      });

    } catch (error) {

      console.error(
        "getTenantPaymentGatewayWebhook:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Failed to get payment gateway webhook configuration",

      });

    }

  };



// ============================================================
// 3. CHECK WEBHOOK CONNECTION
// ============================================================
// POST /api/v1/tenant/payment-gateway/webhook/check
// ============================================================

const checkRazorpayWebhook = async (req, res) => {

    try {

      const tenantId = req.user.tenantId;


      // ======================================================
      // GET GATEWAY
      // ======================================================

      const gateway = await prisma.tenantPaymentGateway.findUnique({
          where: {
            tenantId,
          },

        });


      // ======================================================
      // NOT CONFIGURED
      // ======================================================

      if (!gateway) {

        return res.status(400).json({

          success: false,

          data: {

            configured: false,

            webhookVerified: false,

            connected: false,

          },

          message:
            "Razorpay payment gateway is not configured",

        });

      }


      // ======================================================
      // WEBHOOK NOT VERIFIED
      // ======================================================

      if (!gateway.webhookVerifiedAt) {

        return res.status(400).json({

          success: false,

          data: {

            configured: true,

            webhookVerified: false,

            connected: false,

            webhookUrl:
              `${process.env.BUILD_FREE_WEBHOOK_URL}/${tenantId}`,

          },

          message:
            "Webhook connection has not been verified. Please configure the webhook in Razorpay and trigger a test webhook.",

        });

      }


      // ======================================================
      // WEBHOOK VERIFIED
      // ======================================================

      return res.status(200).json({

        success: true,

        message:
          "Razorpay webhook connection verified successfully",

        data: {

          configured: true,

          webhookVerified: true,

          connected: true,

          webhookUrl:
            `${process.env.BUILD_FREE_WEBHOOK_URL}/${tenantId}`,

          webhookVerifiedAt:
            gateway.webhookVerifiedAt,

          lastEvent:
            gateway.webhookLastEvent,

        },

      });

    } catch (error) {

      console.error(
        "checkRazorpayWebhook:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Failed to check Razorpay webhook connection",

      });

    }

  };



// ============================================================
// 4. RAZORPAY PUBLIC WEBHOOK
// ============================================================
// POST /api/v1/public/payments/razorpay/webhook/:tenantId
// ============================================================

const handleRazorpayWebhook = async (req, res) => {

    try {

      const tenantId =
        req.params.tenantId;


      // ======================================================
      // GET GATEWAY
      // ======================================================

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
            "Payment gateway not found",

        });

      }


      // ======================================================
      // WEBHOOK SECRET CHECK
      // ======================================================

      if (!gateway.webhookSecret) {

        return res.status(400).json({

          success: false,

          message:
            "Webhook secret is not configured",

        });

      }


      // ======================================================
      // GET RAZORPAY SIGNATURE
      // ======================================================

      const razorpaySignature =
        req.headers[
          "x-razorpay-signature"
        ];


      if (!razorpaySignature) {

        return res.status(400).json({

          success: false,

          message:
            "Razorpay webhook signature is missing",

        });

      }


      // ======================================================
      // RAW BODY
      // ======================================================

      const rawBody =
        Buffer.isBuffer(req.body)

          ? req.body

          : Buffer.from(
              JSON.stringify(req.body)
            );


      // ======================================================
      // GENERATE EXPECTED SIGNATURE
      // ======================================================

      const expectedSignature =
        crypto
          .createHmac(
            "sha256",
            gateway.webhookSecret
          )
          .update(rawBody)
          .digest("hex");


      // ======================================================
      // COMPARE SIGNATURE LENGTH
      // ======================================================

      const receivedBuffer =
        Buffer.from(
          razorpaySignature,
          "utf8"
        );

      const expectedBuffer =
        Buffer.from(
          expectedSignature,
          "utf8"
        );


      if (
        receivedBuffer.length !==
        expectedBuffer.length
      ) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid Razorpay webhook signature",

        });

      }


      // ======================================================
      // COMPARE SIGNATURE
      // ======================================================

      const signatureValid =
        crypto.timingSafeEqual(
          receivedBuffer,
          expectedBuffer
        );


      if (!signatureValid) {

        return res.status(400).json({

          success: false,

          message:
            "Invalid Razorpay webhook signature",

        });

      }


      // ======================================================
      // PARSE PAYLOAD
      // ======================================================

      const payload =
        JSON.parse(
          rawBody.toString("utf8")
        );


      const event =
        payload.event || null;


      // ======================================================
      // SAVE WEBHOOK VERIFICATION
      // ======================================================

      await prisma.tenantPaymentGateway.update({

        where: {
          tenantId,
        },

        data: {

          webhookVerifiedAt:
            new Date(),

          webhookLastEvent:
            event,

          lastVerifiedAt:
            new Date(),

        },

      });


      // ======================================================
      // LOG
      // ======================================================

      console.log(
        "Razorpay webhook received"
      );

      console.log(
        "Tenant:",
        tenantId
      );

      console.log(
        "Event:",
        event
      );


      // ======================================================
      // RESPONSE
      // ======================================================

      return res.status(200).json({

        success: true,

        message:
          "Razorpay webhook received successfully",

      });

    } catch (error) {

      console.error(
        "handleRazorpayWebhook:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          "Webhook processing failed",

      });

    }

  };


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  updateTenantPaymentGateway,
  getTenantPaymentGatewayWebhook,
  checkRazorpayWebhook,
  handleRazorpayWebhook,
};