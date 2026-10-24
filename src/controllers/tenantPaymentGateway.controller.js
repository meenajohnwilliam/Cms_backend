
const crypto = require("crypto");
const Razorpay = require("razorpay");
const prisma = require("../config/prisma");
const axios = require("axios");
const config = require("../config/config")



const connectGateway = async (req, res) => {
  try {
    // const tenantId = "cmu10wts9000am51gie4iprm6";
    const tenantId = req.user.tenantId;
    const { projectId } = req.params;
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

    if (!projectId) {
        return res.status(400).json({
          success: false,
          message: "Project ID is required",
        });
      }
    
    if (!provider || !keyId || !keySecret || !websiteUrl) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (provider.toUpperCase() !== "RAZORPAY") {
        return res.status(400).json({
          success: false,
          message: "Unsupported payment provider",
        });
      }

        // Verify project ownership directly.
        const project = await prisma.project.findFirst({
            where: {
              projectId,
              tenantId,
            },
            select: {
              projectId: true,
              tenantId: true,
            },
          });
      
          if (!project) {
            return res.status(404).json({
              success: false,
              message: "Project not found",
            });
          }  

    // Validate credentials before saving.
    const razorpay = new Razorpay({
      key_id: keyId.trim(),
      key_secret: keySecret.trim(),
    });

    await razorpay.orders.all({ count: 1 });

    const sameAccountGateway = await prisma.projectPaymentGateway.findFirst({
        where: {
          keyId: keyId.trim(),
          webhookVerifiedAt: { not: null },
        },
        select: { webhookSecret: true },
      });

    // Generate a unique webhook secret for this tenant.
    const webhookSecret = sameAccountGateway?.webhookSecret || crypto.randomBytes(32).toString("hex");

    const webhookUrl =`${config.buildFreeWebhookUrl}`;

    await prisma.projectPaymentGateway.upsert({
      where: { projectId  },

      create: {
        projectId:projectId,
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
        lastTestPaymentVerifiedAt: null,
        isVerified: false,
        connectionStatus: "WEBHOOK_PENDING",
      },
    });


    if (sameAccountGateway) {
        return res.status(200).json({
          success: true,
          data: {
            webhookAlreadyConfigured: true,
          },
          message:
            "Credentials verified. Webhook already configured. Click ‘Test Connection’ to proceed directly.",
        });
      }

    

    return res.status(200).json({
      success: true,
      data:{
        webhookSecret,
        webhookUrl,
      },
      message: "Credentials validated. Configure your Razorpay webhook.",
    });
  } catch (error) {
    console.error("Connect gateway error:", error.message);

    return res.status(400).json({
      success: false,
      message: "Credential validation failed",
    });
  }
};

const getGatewayStatus = async (req, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { projectId } = req.params;  

      if (!tenantId) {
        return res.status(401).json({
          success: false,
          message: "Tenant not found",
        });
      }

      const project = await prisma.project.findFirst({
        where: {
          projectId,
          tenantId,
        },
        select: { projectId: true },
      });
  
      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }
      const gateway = await prisma.projectPaymentGateway.findUnique({
        where: { projectId: projectId },
        select: {
          provider: true,
          isVerified: true,
          connectionStatus: true,
          testPaymentAt: true,
          webhookVerifiedAt: true,
          webhookUrl: true,
          lastTestPaymentVerifiedAt: true,
          keyId:true,
          websiteUrl:true

        },
      });

      if (!gateway) {
        return res.status(200).json({
          success: true,
          configured: false,
          data: null,
          message: "No gateway configured for this project",
        });
      }
  
      return res.status(200).json({
        success: true,
        data: {
          ...gateway,
  
          webhookInstructions: [
            "Login to your Razorpay Dashboard",
            "Go to Settings > Webhooks",
            'Click "Add New Webhook"',
            "Enter the webhook URL provided by BuildFree",
            "Select the required payment events",
            "Enter the webhook secret generated by BuildFree",
            "Save the webhook configuration",
          ],
  
          keyInstructions: [
            "Login to your Razorpay Dashboard",
            "Go to Account & Settings > API Keys",
            "Generate a Test Key or Live Key",
            "Copy the Key ID and Key Secret",
            "Enter the credentials in BuildFree",
          ],
        },
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
      const tenantId = req.user.tenantId;
      const { projectId } = req.params;
    //   const tenantId = "cmu10wts9000am51gie4iprm6";

    if (!tenantId) {
        return res.status(401).json({
          success: false,
          message: "Tenant not found",
        });
      }

      const project = await prisma.project.findFirst({
        where: {
          projectId,
          tenantId,
        },
        select: { projectId: true },
      });
  
      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }
  
      const gateway = await prisma.projectPaymentGateway.findUnique({
        where: { projectId  },
      });
  
      if (!gateway?.keyId || !gateway?.keySecret) {
        return res.status(400).json({
          success: false,
          message: "Razorpay credentials not configured",
        });
      }
  
      const expectedUrl = config.buildFreeWebhookUrl
  
      const { data } = await axios.get("https://api.razorpay.com/v1/webhooks",
        {
          auth: {
            username: gateway.keyId,
            password: gateway.keySecret,
          },
          params: { count: 100 },
          timeout: 10000,
        }
      );
  
      const normalize = (url = "") => url.trim().replace(/\/+$/, "").toLowerCase();
  
      const webhook = (data.items || []).find(
        (item) => normalize(item.url) === normalize(expectedUrl)
      );
  
      if (!webhook) {
        return res.status(200).json({
          success: false,
          status: "WEBHOOK_PENDING",
          message: "Webhook URL not found in Razorpay",
        });
      }
  
      await prisma.projectPaymentGateway.update({
        where: { projectId },
        data: {
          connectionStatus: "WEBHOOK_VERIFIED",
          webhookVerifiedAt: new Date(),
          isVerified:true 
        },
      });
  
      return res.status(200).json({
        success: true,
        status: "WEBHOOK_VERIFIED",
        webhookVerified:true,
        message: "Webhook Verified Successfully",
      });
    } catch (error) {
      console.error(
        "Webhook check failed:",
        error.response?.data || error.message
      );
  
      return res.status(500).json({
        success: false,
        message: "Failed to check Razorpay webhook",
      });
    }
};

const createTestOrder = async (req, res) => {
    try {
      // 1. Get tenant ID
    //   const tenantId = req.user?.tenantId || "cmu10wts9000am51gie4iprm6";
    const tenantId = req.user.tenantId;
    const { projectId } = req.params;

    if (!tenantId) {
        return res.status(401).json({
          success: false,
          message: "Tenant not found",
        });
      }

      const project = await prisma.project.findFirst({
        where: {
          projectId,
          tenantId,
        },
        select: { projectId: true },
      });
  
      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }
  
      // 2. Find tenant Razorpay configuration
      const gateway = await prisma.projectPaymentGateway.findUnique({
        where: { projectId  },
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
          projectId,
          purpose: "gateway_connection_test",
        },
      });
  
      // 5. Update gateway status
      await prisma.projectPaymentGateway.update({
        where: { projectId  },
        data: {
          testPaymentOrderId: order.id,
          testPaymentId: null,
          testPaymentAt: null,
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
  
const tenantRazorpayWebhook = async (req, res) => {
    try {
      const rawBody = req.body;
      const signature = req.headers["x-razorpay-signature"];
  
      // 1. Validate request
      if (!Buffer.isBuffer(rawBody) || !signature) {
        return res.status(400).json({
          success: false,
          message: "Invalid webhook request",
        });
      }

  
      let body;

      try {
        body = JSON.parse(rawBody.toString("utf8"));
      } catch {
        return res.status(400).json({
          success: false,
          message: "Invalid JSON",
        });
      }
  
      // 4. Read event
      const { event, payload } = body;
      const payment = payload?.payment?.entity;

  // Get tenantId from Razorpay notes
  const tenantId =payment?.notes?.tenantId || payload?.order?.entity?.notes?.tenantId;
  const projectId =payment?.notes?.projectId || payload?.order?.entity?.notes?.projectId;

  console.log("tenantIdFromPayment:",payment?.notes?.tenantId)
  console.log("tenantIdFromPayload:",payload?.order?.entity?.notes?.tenantId)

  if (!tenantId || !projectId) {
    return res.status(200).json({
      success: true,
      message: "Not a BuildFree payment, ignored",
    });
  }

           // 2. Find gateway
           const gateway = await prisma.projectPaymentGateway.findUnique({
            where: { projectId },
          });
      
          if (!gateway) {
            return res.status(404).json({
              success: false,
              message: "Tenant gateway not found",
            });
          }
    
          if (!gateway?.webhookSecret) {
            return res.status(404).json({
              success: false,
              message: "Webhook configuration not found",
            });
          }
      
          // 3. Verify signature
          const expectedSignature = crypto
            .createHmac("sha256", gateway.webhookSecret)
            .update(rawBody)
            .digest("hex");
      
          const received = Buffer.from(signature, "hex");
          const expected = Buffer.from(expectedSignature, "hex");
      
          if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
            return res.status(400).json({
              success: false,
              message: "Invalid webhook signature",
            });
          }
  
      console.log("Razorpay event:", event);
      console.log("jery",payment)
  
      if (!["payment.captured", "payment.failed"].includes(event)) {
        return res.status(200).json({
          success: true,
          message: "Event ignored",
        });
      }
  
      if (!payment?.id || !payment?.order_id) {
        return res.status(400).json({
          success: false,
          message: "Payment ID or order ID is missing",
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
          await prisma.projectPaymentGateway.update({
            where: { projectId  },
            data: {
              connectionStatus: "CONNECTED",
              testPaymentId: payment.id,
              testPaymentAt: new Date(),
              lastTestPaymentVerifiedAt: new Date(),
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
      const customerPayment = await prisma.customerPayment.findFirst({
        where: {
          razorpayOrderId: payment.order_id,
          tenantId,
        },
      });
      
      if (!customerPayment) {
        return res.status(200).json({
          success: true,
          message: "Customer payment record not found",
        });
      }
  
     // 8. Customer payment captured
     if (event === "payment.captured" && payment.status === "captured") {
    if (customerPayment.status !== "CAPTURED") {
      await prisma.customerPayment.update({
        where: { paymentId: customerPayment.paymentId },
        data: {
          razorpayPaymentId: payment.id,
          status: "CAPTURED",
          paidAt: new Date(),
        },
      });
    }
  
    if (customerPayment.orderId) {
      await prisma.customerOrder.update({
        where: { orderId: customerPayment.orderId },
        data: { status: "CONFIRMED" },
      });
    }
  
    return res.status(200).json({
      success: true,
      message: "Payment captured successfully",
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
  
        await prisma.customerPayment.update({
            where: { paymentId: customerPayment.paymentId },
            data: {
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
    testWebhookConnection,
  };



  // const testWebhookConnection = async (req, res) => {
//   try {
//     const tenantId = req.user.tenantId;

//     const gateway = await prisma.tenantPaymentGateway.findUnique({
//       where: { tenantId },
//     });

//     if (!gateway?.webhookSecret) {
//       return res.status(400).json({
//         success: false,
//         message: "Webhook secret not configured",
//       });
//     }

//     const dummyPayment = {
//         id: "pay_dummy_123",
//         order_id: "order_dummy_123",
//         amount: 100,
//         currency: "INR",
//         status: "captured",
//       };
      
//       const payload = JSON.stringify({
//         event: "payment.captured",
//         payload: {
//           payment: {
//             entity: dummyPayment,
//           },
//         },
//       });
      
//       await prisma.tenantPaymentGateway.update({
//         where: { tenantId },
//         data: {
//             webhookVerificationOrderId: dummyPayment.order_id,
//             testPaymentId: dummyPayment.id,
//         },
//       });



//     const signature = crypto
//       .createHmac("sha256", gateway.webhookSecret)
//       .update(payload)
//       .digest("hex");

//     const response = await axios.post(
//       `${config.buildFreeWebhookUrl}/${tenantId}`,
//       payload,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "x-razorpay-signature": signature,
//         },
//         transformRequest: [(data) => data],
//       }
//     );

//     return res.status(200).json({
//       success: true,
//       message: "Test sent to webhook",
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Failed to trigger webhook",
//       error: error.response?.data || error.message,
//     });
//   }
// };



// const testWebhookConnection = async (req, res) => {
//     try {
//       const tenantId = "cmu10wts9000am51gie4iprm6";
  
//       const gateway = await prisma.tenantPaymentGateway.findUnique({
//         where: { tenantId },
//       });
  
//       if (!gateway?.keyId || !gateway?.keySecret) {
//         return res.status(400).json({ success: false, message: "Razorpay keys not configured" });
//       }
  
//       const expectedUrl = `${config.buildFreeWebhookUrl}/${tenantId}`;
  
//       const rzpRes = await axios.get("https://api.razorpay.com/v1/webhooks", {
//         auth: { username: gateway.keyId, password: gateway.keySecret },
//         // validateStatus: () => true,
//         // timeout: 10000,
//       });
//       console.log("jry:",rzpRes.data)

  
//       if (rzpRes.status !== 200) {
//         return res.status(400).json({
//           success: false,
//           message: rzpRes.data?.error?.description || "Unable to fetch webhooks",
//         });
//       }
  
//       const normalize = (u) => (u || "").trim().replace(/\/+$/, "").toLowerCase();
//       const found = (rzpRes.data.items || []).some(
//         (w) => normalize(w.url) === normalize(expectedUrl)
//       );
  
//       return res.status(200).json({
//         success: found,
//         message: found
//           ? "Webhook configured in Razorpay"
//           : "Webhook URL not found in Razorpay dashboard",
//       });
//     } catch (error) {
//       console.error("[Webhook check]", error.message);
//       return res.status(500).json({ success: false, message: "Failed to check webhook" });
//     }
//   };


  

// const testWebhookConnection = async (req, res) => {
//     try {
        
  
//       const gateway = await prisma.tenantPaymentGateway.findUnique({
//         where: { tenantId },
//       });
  
//       if (!gateway?.keyId || !gateway?.keySecret) {
//         return res.status(400).json({
//           success: false,
//           message: "Razorpay credentials not configured",
//         });
//       }
  
//       const expectedUrl =
//         `${config.buildFreeWebhookUrl.replace(/\/+$/, "")}/${tenantId}`;
  
//       const { data } = await axios.get(
//         "https://api.razorpay.com/v1/webhooks",
//         {
//           auth: {
//             username: gateway.keyId,
//             password: gateway.keySecret,
//           },
//           timeout: 10000,
//         }
//       );

//       console.log(data)
  
//       // 1. Match the expected webhook URL
//       const normalize = (url = "") =>
//         url.trim().replace(/\/+$/, "").toLowerCase();
  
//       const webhook = (data.items || []).find(
//         (item) => normalize(item.url) === normalize(expectedUrl)
//       );
//   console.log(webhook)
//       if (!webhook) {
//         return res.status(200).json({
//           success: false,
//           message: "webhook URL not found",
//         //   expectedUrl,
//         });
//       }
  
//       // 2. Get all events from the matched webhook
//       const events = webhook.events || [];
  
//       console.log("Matched webhook:", webhook.id);
//       console.log("Webhook URL:", webhook.url);
//       console.log("Webhook active:", webhook.active);
//       console.log("All webhook events:", events);
  
//       // 3. Return webhook details and all its events
//       return res.status(200).json({
//         success: true,
//         message: "Webhook URL matched successfully",
//         webhookId: webhook.id,
//         webhookUrl: webhook.url,
//         active: webhook.active,
//         events,
//         eventCount: Array.isArray(events)
//           ? events.length
//           : Object.keys(events).length,
//       });
//     } catch (error) {
//       console.error(
//         "Webhook check failed:",
//         error.response?.data || error.message
//       );
  
//       return res.status(500).json({
//         success: false,
//         message: "Failed to check Razorpay webhook",
//       });
//     }
//   };



  
  

// const testWebhookConnection = async (req, res) => {
//     try {
        
  
//       const gateway = await prisma.tenantPaymentGateway.findUnique({
//         where: { tenantId },
//       });
  
//       if (!gateway?.keyId || !gateway?.keySecret) {
//         return res.status(400).json({
//           success: false,
//           message: "Razorpay credentials not configured",
//         });
//       }
  
//       const expectedUrl =
//         `${config.buildFreeWebhookUrl.replace(/\/+$/, "")}/${tenantId}`;
  
//       const allWebhooks = [];
//       let skip = 0;
//       const count = 100;
  
//       // Fetch all webhook pages
//       while (true) {
//         const { data } = await axios.get(
//           "https://api.razorpay.com/v1/webhooks",
//           {
//             auth: {
//               username: gateway.keyId,
//               password: gateway.keySecret,
//             },
//             params: { count, skip },
//             timeout: 10000,
//           }
//         );
  
//         const items = data.items || [];
//         allWebhooks.push(...items);
  
//         if (items.length < count) break;
  
//         skip += items.length;
//       }
  
//       console.log("Total webhooks:", allWebhooks.length);
  
//       const normalize = (url = "") =>
//         url.trim().replace(/\/+$/, "").toLowerCase();
  
//       // Match expected URL
//       const matchingWebhooks = allWebhooks.filter(
//         (item) => normalize(item.url) === normalize(expectedUrl)
//       );
  
//       if (!matchingWebhooks.length) {
//         return res.status(200).json({
//           success: false,
//           message: "Expected webhook URL not found",
//           expectedUrl,
//           totalWebhooks: allWebhooks.length,
//         });
//       }
  
//       // Show every event for each matching webhook
//       const webhooks = matchingWebhooks.map((webhook) => ({
//         webhookId: webhook.id,
//         url: webhook.url,
//         active: webhook.active,
//         secretExists: webhook.secret_exists,
//         events: webhook.events,
//       }));
  
//       console.log(JSON.stringify(webhooks, null, 2));
  
//       return res.status(200).json({
//         success: true,
//         message: "Matching webhooks found",
//         totalWebhooks: allWebhooks.length,
//         matchingCount: webhooks.length,
//         webhooks,
//       });
//     } catch (error) {
//       console.error(
//         "Webhook check failed:",
//         error.response?.data || error.message
//       );
  
//       return res.status(500).json({
//         success: false,
//         message: "Failed to fetch Razorpay webhooks",
//       });
//     }
//   };
  
  
// const testWebhookConnection = async (req, res) => {
//     try {
//     //   const tenantId = req.user.tenantId;
    
  
//       const gateway = await prisma.tenantPaymentGateway.findUnique({
//         where: { tenantId },
//       });
  
//       if (!gateway?.keyId || !gateway?.keySecret) {
//         return res.status(400).json({
//           success: false,
//           message: "Razorpay credentials not configured",
//         });
//       }
  
//       const expectedUrl =
//         `${config.buildFreeWebhookUrl.replace(/\/+$/, "")}/${tenantId}`;
  
//       const requiredEvents = [
//         "order.notification.failed",
//         "order.notification.delivered",
//         "order.paid",
//         "engage.inventory.low_stock",
//         "engage.rewards.disabled",
//         "engage.rewards.denomination_disabled",
//         "engage.rewards.termsandconditions_updated",
//         "engage.rewards.enabled",
//         "engage.rewards.denomination_enabled",
//         "engage.rewards.denomination_updated",
//         "engage.balance.low_balance",
//         "engage.rewards.discount_updated",
//         "engage.rewards.instructions_updated",
//         "qr_code.credited",
//         "qr_code.closed",
//         "qr_code.created",
//         "payment.dispute.lost",
//         "payment.failed",
//         "payment.dispute.created",
//         "payment.captured",
//         "payment.dispute.closed",
//         "payment.dispute.under_review",
//         "payment.downtime.resolved",
//         "payment.dispute.won",
//         "payment.dispute.action_required",
//         "payment.authorized",
//         "payment.downtime.updated",
//         "payment.downtime.started",
//         "invoice.expired",
//         "invoice.paid",
//         "invoice.partially_paid",
//         "payment_link.partially_paid",
//         "payment_link.paid",
//         "payment_link.expired",
//         "payment_link.cancelled",
//         "agent_studio.execution.skipped",
//         "agent_studio.execution.failed",
//         "agent_studio.execution.updated",
//         "agent_studio.execution.completed",
//         "subscription.authenticated",
//         "subscription.activated",
//         "subscription.cancelled",
//         "subscription.paused",
//         "subscription.halted",
//         "subscription.resumed",
//         "subscription.completed",
//         "subscription.updated",
//         "subscription.pending",
//         "subscription.charged",
//         "fund_account.validation.completed",
//         "fund_account.validation.failed",
//         "settlement.processed",
//         "refund.created",
//         "refund.failed",
//         "refund.processed",
//         "refund.speed_changed",
//         "account.activated_kyc_pending",
//         "account.instantly_activated",
//       ];
  
//       // Fetch all webhook pages
//       const allWebhooks = [];
//       let skip = 0;
//       const count = 100;
  
//       while (true) {
//         const { data } = await axios.get(
//           "https://api.razorpay.com/v1/webhooks",
//           {
//             auth: {
//               username: gateway.keyId,
//               password: gateway.keySecret,
//             },
//             params: { count, skip },
//             timeout: 10000,
//           }
//         );
  
//         const items = data.items || [];
//         allWebhooks.push(...items);
  
//         if (items.length < count) break;
//         skip += items.length;
//       }
  
//       // Match expected webhook URL
//       const normalize = (url = "") =>
//         url.trim().replace(/\/+$/, "").toLowerCase();
  
//       const matchingWebhooks = allWebhooks.filter(
//         (item) => normalize(item.url) === normalize(expectedUrl)
//       );
  
//       if (!matchingWebhooks.length) {
//         return res.status(200).json({
//           success: false,
//           status: "WEBHOOK_NOT_FOUND",
//           message: "Expected webhook URL not found",
//           expectedUrl,
//           totalWebhooks: allWebhooks.length,
//         });
//       }
  
//       // Check each matching webhook
//       const results = matchingWebhooks.map((webhook) => {
//         const configuredEvents = Array.isArray(webhook.events)
//           ? webhook.events
//           : Object.keys(webhook.events || {}).filter(
//               (event) => webhook.events[event] === true
//             );
  
//         const missingEvents = requiredEvents.filter(
//           (event) => !configuredEvents.includes(event)
//         );
  
//         const allEventsEnabled = missingEvents.length === 0;
//         const active = webhook.active === true;
  
//         return {
//           webhookId: webhook.id,
//           url: webhook.url,
//           active,
//           secretExists: webhook.secret_exists === true,
//           totalRequired: requiredEvents.length,
//           totalConfigured: configuredEvents.length,
//           missingCount: missingEvents.length,
//           missingEvents,
//           allEventsEnabled,
//           connected:
//             active &&
//             webhook.secret_exists === true &&
//             allEventsEnabled,
//         };
//       });
  
//       console.log(JSON.stringify(results, null, 2));
  
//       const connectedWebhook = results.find((item) => item.connected);
  
//       if (!connectedWebhook) {
//         return res.status(200).json({
//           success: false,
//           status: "WEBHOOK_CONFIGURATION_INCOMPLETE",
//           message: "Enable the webhook and all required events in Razorpay",
//           expectedUrl,
//           matchingCount: results.length,
//           webhooks: results,
//         });
//       }
  
//       return res.status(200).json({
//         success: true,
//         status: "WEBHOOK_CONFIGURED",
//         message: "Webhook is active and all required events are configured",
//         expectedUrl,
//         webhookId: connectedWebhook.webhookId,
//         totalRequired: connectedWebhook.totalRequired,
//         totalConfigured: connectedWebhook.totalConfigured,
//         allEventsEnabled: true,
//         active: true,
//       });
//     } catch (error) {
//       console.error(
//         "Webhook check failed:",
//         error.response?.data || error.message
//       );
  
//       return res.status(500).json({
//         success: false,
//         message: "Failed to fetch Razorpay webhooks",
//       });
//     }
//   };
  

  



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


