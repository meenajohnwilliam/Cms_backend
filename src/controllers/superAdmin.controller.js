const prisma = require("../config/prisma")
const bcrypt = require("bcryptjs");


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
          password: hashedPassword ,
          role: "SUPER_ADMIN",
          tenantId: null,
          isEmailVerified: true,
        },
      });
  
      res.status(201).json({
        message: "Super Admin created successfully",
        data: {
            userId: superAdmin.userId,
            name: superAdmin.name,
            email: superAdmin.email,
            role: superAdmin.role,
          },
      });
  
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  };



// ============================================================
// SUPER ADMIN DASHBOARD
// ============================================================

const getDashboard = async (req, res) => {
  try {
    // ========================================================
    // RUN DASHBOARD QUERIES IN PARALLEL
    // ========================================================

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
        // ====================================================
        // TENANTS
        // ====================================================

        tenants: {
          total: totalTenants,
          active: activeTenants,
          inactive: inactiveTenants,
        },

        // ====================================================
        // USERS
        // ====================================================

        users: {
          total: totalUsers,
          admins: totalAdmins,
          users: totalNormalUsers,
        },

        // ====================================================
        // RESOURCES
        // ====================================================

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

        // ====================================================
        // SUBSCRIPTIONS
        // ====================================================

        subscriptions: {
          active: activeSubscriptions,
          pastDue: pastDueSubscriptions,
          gracePeriod: gracePeriodSubscriptions,
          suspended: suspendedSubscriptions,
          cancelled: cancelledSubscriptions,
          expired: expiredSubscriptions,
          pending: pendingSubscriptions,
        },

        // ====================================================
        // PLATFORM USAGE
        // ====================================================
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
        // ====================================================
        // RECENT TENANTS
        // ====================================================

        recentTenants,

        // ====================================================
        // RECENT PAYMENTS
        // ====================================================

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

module.exports = {
  getDashboard,
  createSuperAdmin
};