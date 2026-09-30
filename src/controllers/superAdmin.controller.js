const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");


// ============================================================
// CREATE SUPER ADMIN
// ============================================================

const createSuperAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    const superAdmin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "SUPER_ADMIN",
        tenantId: null,
        isEmailVerified: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Super Admin created successfully",
      data: {
        userId: superAdmin.userId,
        name: superAdmin.name,
        email: superAdmin.email,
        role: superAdmin.role,
      },
    });

  } catch (error) {

    console.error(
      "Create Super Admin Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



// ============================================================
// SUPER ADMIN DASHBOARD
// ============================================================

const getDashboard = async (req, res) => {
  try {

    const [
      totalTenants,
      activeTenants,
      inactiveTenants,

      totalUsers,
      totalAdmins,
      totalNormalUsers,

      totalProjects,
      totalCollections,

      totalApiKeys,
      activeApiKeys,
      inactiveApiKeys,

      totalForms,
      publishedForms,
      draftForms,

      activeSubscriptions,
      pastDueSubscriptions,
      gracePeriodSubscriptions,
      suspendedSubscriptions,
      cancelledSubscriptions,
      expiredSubscriptions,
      pendingSubscriptions,

      totalUsage,

      recentTenants,
      recentPayments,
    ] = await Promise.all([

      // ======================================================
      // TENANTS
      // ======================================================

      prisma.tenant.count(),

      prisma.tenant.count({
        where: {
          isActive: true,
        },
      }),

      prisma.tenant.count({
        where: {
          isActive: false,
        },
      }),


      // ======================================================
      // USERS
      // ======================================================

      prisma.user.count(),

      prisma.user.count({
        where: {
          role: "ADMIN",
        },
      }),

      prisma.user.count({
        where: {
          role: "USER",
        },
      }),


      // ======================================================
      // PROJECTS
      // ======================================================

      prisma.project.count(),


      // ======================================================
      // COLLECTIONS
      // ======================================================

      prisma.collection.count(),


      // ======================================================
      // API KEYS
      // ======================================================

      prisma.apiKey.count(),

      prisma.apiKey.count({
        where: {
          isActive: true,
        },
      }),

      prisma.apiKey.count({
        where: {
          isActive: false,
        },
      }),


      // ======================================================
      // FORMS
      // ======================================================

      prisma.form.count(),

      prisma.form.count({
        where: {
          status: "PUBLISHED",
        },
      }),

      prisma.form.count({
        where: {
          status: "DRAFT",
        },
      }),


      // ======================================================
      // SUBSCRIPTIONS
      // ======================================================

      prisma.subscription.count({
        where: {
          status: "ACTIVE",
        },
      }),

      prisma.subscription.count({
        where: {
          status: "PAST_DUE",
        },
      }),

      prisma.subscription.count({
        where: {
          status: "GRACE_PERIOD",
        },
      }),

      prisma.subscription.count({
        where: {
          status: "SUSPENDED",
        },
      }),

      prisma.subscription.count({
        where: {
          status: "CANCELLED",
        },
      }),

      prisma.subscription.count({
        where: {
          status: "EXPIRED",
        },
      }),

      prisma.subscription.count({
        where: {
          status: "PENDING",
        },
      }),


      // ======================================================
      // USAGE
      // ======================================================

      prisma.usage.aggregate({
        _sum: {
          storageUsedBytes: true,
          getRequestsUsed: true,
          writeRequestsUsed: true,
          apiKeysUsed: true,
          projectsUsed: true,
          collectionsUsed: true,
          teamMembersUsed: true,
        },
      }),


      // ======================================================
      // RECENT TENANTS
      // ======================================================

      prisma.tenant.findMany({
        select: {
          tenantId: true,
          name: true,
          slug: true,
          isActive: true,
          createdAt: true,

          users: {
            where: {
              role: "ADMIN",
            },

            select: {
              userId: true,
              name: true,
              email: true,
            },

            take: 1,
          },

          subscription: {
            where: {
              status: "ACTIVE",
            },

            orderBy: {
              createdAt: "desc",
            },

            take: 1,

            select: {
              subscriptionId: true,
              status: true,
              billingCycle: true,
              planPrice: true,

              plan: {
                select: {
                  planId: true,
                  name: true,
                  version: true,
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 5,
      }),


      // ======================================================
      // RECENT PAYMENTS
      // ======================================================

      prisma.payment.findMany({
        select: {
          paymentId: true,
          amount: true,
          currency: true,
          status: true,
          razorpayPaymentId: true,
          paidAt: true,
          createdAt: true,

          tenant: {
            select: {
              tenantId: true,
              name: true,
            },
          },

          subscription: {
            select: {
              subscriptionId: true,

              plan: {
                select: {
                  name: true,
                  version: true,
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 5,
      }),
    ]);


    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,

      dashboard: {

        tenants: {
          total: totalTenants,
          active: activeTenants,
          inactive: inactiveTenants,
        },

        users: {
          total: totalUsers,
          admins: totalAdmins,
          users: totalNormalUsers,
        },

        resources: {
          projects: totalProjects,
          collections: totalCollections,

          apiKeys: {
            total: totalApiKeys,
            active: activeApiKeys,
            inactive: inactiveApiKeys,
          },

          forms: {
            total: totalForms,
            published: publishedForms,
            draft: draftForms,
          },
        },

        subscriptions: {
          active: activeSubscriptions,
          pastDue: pastDueSubscriptions,
          gracePeriod: gracePeriodSubscriptions,
          suspended: suspendedSubscriptions,
          cancelled: cancelledSubscriptions,
          expired: expiredSubscriptions,
          pending: pendingSubscriptions,
        },

        usage: {
          storageUsedBytes:
            totalUsage._sum.storageUsedBytes?.toString() || "0",

          getRequestsUsed:
            totalUsage._sum.getRequestsUsed || 0,

          writeRequestsUsed:
            totalUsage._sum.writeRequestsUsed || 0,

          apiKeysUsed:
            totalUsage._sum.apiKeysUsed || 0,

          projectsUsed:
            totalUsage._sum.projectsUsed || 0,

          collectionsUsed:
            totalUsage._sum.collectionsUsed || 0,

          teamMembersUsed:
            totalUsage._sum.teamMembersUsed || 0,
        },

        recentTenants,

        recentPayments,
      },
    });

  } catch (error) {

    console.error(
      "Super Admin Dashboard Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



// ============================================================
// GET ALL TENANTS
// ============================================================

const getTenantList = async (req, res) => {
  try {

    const tenants = await prisma.tenant.findMany({
      select: {
        tenantId: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,

        users: {
          where: {
            role: "ADMIN",
          },

          select: {
            userId: true,
            name: true,
            email: true,
          },

          take: 1,
        },

        subscription: {
          where: {
            status: "ACTIVE",
          },

          orderBy: {
            createdAt: "desc",
          },

          take: 1,

          select: {
            subscriptionId: true,
            status: true,
            billingCycle: true,
            planPrice: true,

            plan: {
              select: {
                planId: true,
                name: true,
                version: true,
                type: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });


    return res.status(200).json({
      success: true,
      count: tenants.length,
      tenants,
    });

  } catch (error) {

    console.error(
      "Get Tenant List Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tenants",
    });
  }
};



// ============================================================
// GET TENANT BASIC DETAILS
// ============================================================

const getTenantDetails = async (req, res) => {
  try {

    const { tenantId } = req.params;


    const tenant = await prisma.tenant.findUnique({
      where: {
        tenantId,
      },

      select: {
        tenantId: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });


    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }


    return res.status(200).json({
      success: true,
      tenant,
    });

  } catch (error) {

    console.error(
      "Get Tenant Details Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tenant details",
    });
  }
};



// ============================================================
// GET TENANT ADMIN
// ============================================================

const getTenantAdmin = async (req, res) => {
  try {

    const { tenantId } = req.params;


    const admin = await prisma.user.findFirst({
      where: {
        tenantId,
        role: "ADMIN",
      },

      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });


    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Tenant admin not found",
      });
    }


    return res.status(200).json({
      success: true,
      admin,
    });

  } catch (error) {

    console.error(
      "Get Tenant Admin Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tenant admin",
    });
  }
};



// ============================================================
// GET TENANT USERS
// ============================================================

const getTenantUsers = async (req, res) => {
  try {

    const { tenantId } = req.params;


    const users = await prisma.user.findMany({
      where: {
        tenantId,
        role: "USER",
      },

      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });


    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });

  } catch (error) {

    console.error(
      "Get Tenant Users Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tenant users",
    });
  }
};



// ============================================================
// GET CURRENT TENANT SUBSCRIPTION
// ============================================================

const getTenantSubscription = async (req, res) => {
  try {

    const { tenantId } = req.params;


    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId,

        status: "ACTIVE",

        plan: {
          type: "PAID",
        },
      },

      orderBy: {
        createdAt: "desc",
      },

      select: {
        subscriptionId: true,
        tenantId: true,
        billingCycle: true,
        status: true,
        planPrice: true,
        startDate: true,
        endDate: true,
        gracePeriodEndDate: true,
        razorpaySubscriptionId: true,
        razorpayCustomerId: true,
        createdAt: true,
        updatedAt: true,

        plan: {
          select: {
            planId: true,
            name: true,
            version: true,
            type: true,
            billingCycle: true,
            price: true,

            projectLimit: true,
            collectionLimit: true,
            apiKeyLimit: true,
            teamMemberLimit: true,
            storageLimit: true,
            planLevel: true,
            getRequestsLimit: true,
            writeRequestsLimit: true,

            customDomain: true,
            mediaUpload: true,
            analytics: true,
            emailSupport: true,
          },
        },
      },
    });


    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Active paid subscription not found",
      });
    }


    const response = {
      ...subscription,

      plan: {
        ...subscription.plan,

        storageLimit:
          subscription.plan.storageLimit?.toString() || "0",
      },
    };


    return res.status(200).json({
      success: true,
      subscription: response,
    });

  } catch (error) {

    console.error(
      "Get Tenant Subscription Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tenant subscription",
    });
  }
};



// ============================================================
// GET TENANT SUBSCRIPTION HISTORY
// ============================================================

const getTenantSubscriptionHistory = async (req, res) => {
  try {

    const { tenantId } = req.params;


    const subscriptions = await prisma.subscription.findMany({
      where: {
        tenantId,

        // Do not show FREE plans
        plan: {
          type: "PAID",
        },
      },

      select: {
        subscriptionId: true,
        billingCycle: true,
        status: true,
        planPrice: true,
        startDate: true,
        endDate: true,
        gracePeriodEndDate: true,
        razorpaySubscriptionId: true,
        razorpayCustomerId: true,
        createdAt: true,
        updatedAt: true,

        plan: {
          select: {
            planId: true,
            name: true,
            version: true,
            type: true,
            billingCycle: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });


    return res.status(200).json({
      success: true,
      count: subscriptions.length,
      subscriptions,
    });

  } catch (error) {

    console.error(
      "Get Tenant Subscription History Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription history",
    });
  }
};



// ============================================================
// GET TENANT PAYMENT HISTORY
// ============================================================

const getTenantPaymentHistory = async (req, res) => {
  try {

    const { tenantId } = req.params;


    const payments = await prisma.payment.findMany({
      where: {
        tenantId,
      },

      select: {
        paymentId: true,
        tenantId: true,
        subscriptionId: true,
        amount: true,
        currency: true,
        status: true,
        razorpayPaymentId: true,
        razorpayOrderId: true,
        razorpaySubscriptionId: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,

        subscription: {
          select: {
            subscriptionId: true,
            billingCycle: true,
            planPrice: true,

            plan: {
              select: {
                planId: true,
                name: true,
                version: true,
                type: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });


    return res.status(200).json({
      success: true,
      count: payments.length,
      payments,
    });

  } catch (error) {

    console.error(
      "Get Tenant Payment History Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
    });
  }
};



// ============================================================
// GET TENANT USAGE
// ============================================================

const getTenantUsage = async (req, res) => {
  try {

    const { tenantId } = req.params;


    const usage = await prisma.usage.findUnique({
      where: {
        tenantId,
      },
    });


    if (!usage) {
      return res.status(404).json({
        success: false,
        message: "Usage data not found",
      });
    }


    return res.status(200).json({
      success: true,

      usage: {
        usageId: usage.usageId,
        tenantId: usage.tenantId,

        storageUsedBytes:
          usage.storageUsedBytes?.toString() || "0",

        getRequestsUsed:
          usage.getRequestsUsed || 0,

        writeRequestsUsed:
          usage.writeRequestsUsed || 0,

        apiKeysUsed:
          usage.apiKeysUsed || 0,

        projectsUsed:
          usage.projectsUsed || 0,

        collectionsUsed:
          usage.collectionsUsed || 0,

        teamMembersUsed:
          usage.teamMembersUsed || 0,

        usageResetAt:
          usage.usageResetAt,

        createdAt:
          usage.createdAt,

        updatedAt:
          usage.updatedAt,
      },
    });

  } catch (error) {

    console.error(
      "Get Tenant Usage Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tenant usage",
    });
  }
};



// ============================================================
// GET TENANT PROJECTS
// ============================================================

const getTenantProjects = async (req, res) => {
  try {

    const { tenantId } = req.params;


    const projects = await prisma.project.findMany({
      where: {
        tenantId,
      },

      select: {
        projectId: true,
        tenantId: true,
        name: true,
        slug: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,

        _count: {
          select: {
            collections: true,
            apiKeys: true,
            form: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });


    return res.status(200).json({
      success: true,
      count: projects.length,
      projects,
    });

  } catch (error) {

    console.error(
      "Get Tenant Projects Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tenant projects",
    });
  }
};



// ============================================================
// GET TENANT FORMS
// ============================================================

const getTenantForms = async (req, res) => {
  try {

    const { tenantId } = req.params;


    const forms = await prisma.form.findMany({
      where: {
        project: {
          tenantId,
        },
      },

      select: {
        formId: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,

        project: {
          select: {
            projectId: true,
            name: true,
            slug: true,
          },
        },

        _count: {
          select: {
            fields: true,
            submissions: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });


    return res.status(200).json({
      success: true,
      count: forms.length,
      forms,
    });

  } catch (error) {

    console.error(
      "Get Tenant Forms Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tenant forms",
    });
  }
};





/* ============================================================
   PROJECT DETAILS
   GET /api/v1/super-admin/projects/:projectId
============================================================ */

const getProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: {
        projectId,
      },

      include: {
        tenant: {
          select: {
            tenantId: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },

        _count: {
          select: {
            collections: true,
            apiKeys: true,
            form: true,
            userAccess: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("getProjectDetails:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch project details",
    });
  }
};


/* ============================================================
   PROJECT COLLECTIONS
   GET /api/v1/super-admin/projects/:projectId/collections
============================================================ */

const getProjectCollections = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: {
        projectId,
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

    const collections = await prisma.collection.findMany({
      where: {
        projectId,
      },

      orderBy: {
        createdAt: "desc",
      },

      include: {
        _count: {
          select: {
            fields: true,
            records: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: collections,
    });
  } catch (error) {
    console.error("getProjectCollections:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch collections",
    });
  }
};


/* ============================================================
   COLLECTION DETAILS
   GET /api/v1/super-admin/collections/:collectionId
============================================================ */

const getCollectionDetails = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const collection = await prisma.collection.findUnique({
      where: {
        collectionId,
      },

      include: {
        project: {
          select: {
            projectId: true,
            name: true,
            slug: true,
            tenantId: true,
          },
        },

        _count: {
          select: {
            fields: true,
            records: true,
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

    return res.status(200).json({
      success: true,
      data: collection,
    });
  } catch (error) {
    console.error("getCollectionDetails:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch collection details",
    });
  }
};


/* ============================================================
   COLLECTION FIELDS
   GET /api/v1/super-admin/collections/:collectionId/fields
============================================================ */

const getCollectionFields = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const fields = await prisma.collectionField.findMany({
      where: {
        collectionId,
      },

      orderBy: {
        displayOrder: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      data: fields,
    });
  } catch (error) {
    console.error("getCollectionFields:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch collection fields",
    });
  }
};


/* ============================================================
   COLLECTION RECORDS
   GET /api/v1/super-admin/collections/:collectionId/records
============================================================ */

const getCollectionRecords = async (req, res) => {
  try {
    const { collectionId } = req.params;

    let { page = 1, limit = 25 } = req.query;

    page = Math.max(parseInt(page) || 1, 1);
    limit = Math.min(Math.max(parseInt(limit) || 25, 1), 100);

    const skip = (page - 1) * limit;

    const collection = await prisma.collection.findUnique({
      where: {
        collectionId,
      },

      select: {
        collectionId: true,
        name: true,
        slug: true,
      },
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: "Collection not found",
      });
    }

    const [records, total] = await Promise.all([
      prisma.record.findMany({
        where: {
          collectionId,
        },

        orderBy: {
          createdAt: "desc",
        },

        skip,
        take: limit,

        select: {
          recordId: true,
          collectionId: true,
          data: true,
          createdAt: true,
          updatedAt: true,

          _count: {
            select: {
              media: true,
            },
          },
        },
      }),

      prisma.record.count({
        where: {
          collectionId,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,

      collection,

      data: records,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getCollectionRecords:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch collection records",
    });
  }
};


/* ============================================================
   RECORD DETAILS
   GET /api/v1/super-admin/records/:recordId
============================================================ */

const getRecordDetails = async (req, res) => {
  try {
    const { recordId } = req.params;

    const record = await prisma.record.findUnique({
      where: {
        recordId,
      },

      include: {
        collection: {
          select: {
            collectionId: true,
            name: true,
            slug: true,

            project: {
              select: {
                projectId: true,
                name: true,
                tenantId: true,
              },
            },
          },
        },

        media: true,
      },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("getRecordDetails:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch record",
    });
  }
};


/* ============================================================
   RECORD MEDIA
   GET /api/v1/super-admin/records/:recordId/media
============================================================ */

const getRecordMedia = async (req, res) => {
  try {
    const { recordId } = req.params;

    const media = await prisma.media.findMany({
      where: {
        recordId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: media,
    });
  } catch (error) {
    console.error("getRecordMedia:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch record media",
    });
  }
};


/* ============================================================
   PROJECT API KEYS
   GET /api/v1/super-admin/projects/:projectId/api-keys
============================================================ */

const getProjectApiKeys = async (req, res) => {
  try {
    const { projectId } = req.params;

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        projectId,
      },

      orderBy: {
        createdAt: "desc",
      },

      select: {
        apiKeyId: true,
        projectId: true,
        name: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: apiKeys,
    });
  } catch (error) {
    console.error("getProjectApiKeys:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch API keys",
    });
  }
};


/* ============================================================
   PROJECT FORMS
   GET /api/v1/super-admin/projects/:projectId/forms
============================================================ */

const getProjectForms = async (req, res) => {
  try {
    const { projectId } = req.params;

    const forms = await prisma.form.findMany({
      where: {
        projectId,
      },

      orderBy: {
        createdAt: "desc",
      },

      include: {
        _count: {
          select: {
            fields: true,
            submissions: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: forms,
    });
  } catch (error) {
    console.error("getProjectForms:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch project forms",
    });
  }
};


/* ============================================================
   FORM DETAILS
   GET /api/v1/super-admin/forms/:formId
============================================================ */

const getFormDetails = async (req, res) => {
  try {
    const { formId } = req.params;

    const form = await prisma.form.findUnique({
      where: {
        formId,
      },

      include: {
        project: {
          select: {
            projectId: true,
            name: true,
            slug: true,
            tenantId: true,
          },
        },

        _count: {
          select: {
            fields: true,
            submissions: true,
          },
        },
      },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: form,
    });
  } catch (error) {
    console.error("getFormDetails:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch form details",
    });
  }
};


/* ============================================================
   FORM FIELDS
   GET /api/v1/super-admin/forms/:formId/fields
============================================================ */

const getFormFields = async (req, res) => {
  try {
    const { formId } = req.params;

    const fields = await prisma.formField.findMany({
      where: {
        formId,
      },

      orderBy: {
        displayOrder: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      data: fields,
    });
  } catch (error) {
    console.error("getFormFields:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch form fields",
    });
  }
};


/* ============================================================
   FORM SUBMISSIONS
   GET /api/v1/super-admin/forms/:formId/submissions
============================================================ */

const getFormSubmissions = async (req, res) => {
  try {
    const { formId } = req.params;

    let { page = 1, limit = 25 } = req.query;

    page = Math.max(parseInt(page) || 1, 1);
    limit = Math.min(Math.max(parseInt(limit) || 25, 1), 100);

    const skip = (page - 1) * limit;

    const form = await prisma.form.findUnique({
      where: {
        formId,
      },

      select: {
        formId: true,
        name: true,
        slug: true,
        projectId: true,
      },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const [submissions, total] = await Promise.all([
      prisma.formSubmission.findMany({
        where: {
          formId,
        },

        orderBy: {
          createdAt: "desc",
        },

        skip,
        take: limit,

        select: {
          submissionId: true,
          formId: true,
          data: true,
          createdAt: true,
          updatedAt: true,

          _count: {
            select: {
              media: true,
            },
          },
        },
      }),

      prisma.formSubmission.count({
        where: {
          formId,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,

      form,

      data: submissions,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getFormSubmissions:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch form submissions",
    });
  }
};


/* ============================================================
   SUBMISSION DETAILS
   GET /api/v1/super-admin/submissions/:submissionId
============================================================ */

const getSubmissionDetails = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await prisma.formSubmission.findUnique({
      where: {
        submissionId,
      },

      include: {
        form: {
          select: {
            formId: true,
            name: true,
            slug: true,

            project: {
              select: {
                projectId: true,
                name: true,
                tenantId: true,
              },
            },
          },
        },

        media: true,
      },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    console.error("getSubmissionDetails:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch submission",
    });
  }
};


/* ============================================================
   SUBMISSION MEDIA
   GET /api/v1/super-admin/submissions/:submissionId/media
============================================================ */

const getSubmissionMedia = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const media = await prisma.media.findMany({
      where: {
        submissionId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: media,
    });
  } catch (error) {
    console.error("getSubmissionMedia:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch submission media",
    });
  }
};


/* ============================================================
   PROJECT USERS
   GET /api/v1/super-admin/projects/:projectId/users
============================================================ */

const getProjectUsers = async (req, res) => {
  try {
    const { projectId } = req.params;

    const users = await prisma.userProjectAccess.findMany({
      where: {
        projectId,
      },

      orderBy: {
        createdAt: "desc",
      },

      include: {
        user: {
          select: {
            userId: true,
            name: true,
            email: true,
            role: true,
            isEmailVerified: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("getProjectUsers:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch project users",
    });
  }
};


// ============================================================
// EXPORT
// ============================================================

module.exports = {

  // Super Admin
  createSuperAdmin,
  getDashboard,

  // Tenant
  getTenantList,
  getTenantDetails,
  getTenantAdmin,
  getTenantUsers,
  getTenantSubscription,
  getTenantSubscriptionHistory,
  getTenantPaymentHistory,
  getTenantUsage,
  getTenantProjects,
  getTenantForms,



  ///
  getProjectDetails,
  getProjectCollections,
  getCollectionDetails,
  getCollectionFields,
  getCollectionRecords,
  getRecordDetails,
  getRecordMedia,
  getProjectApiKeys,
  getProjectForms,
  getFormDetails,
  getFormFields,
  getFormSubmissions,
  getSubmissionDetails,
  getSubmissionMedia,
  getProjectUsers,
};

