const express = require("express");

const {
  createSuperAdmin,
  getDashboard,

  // Tenant APIs
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
} = require("../controllers/superAdmin.controller");

const authMiddleware = require("../middleware/auth.middleware");
const roleMiddleware = require("../middleware/role.middleware");

const router = express.Router();


// ============================================================
// CREATE SUPER ADMIN
// ============================================================

router.post(
  "/create",
  createSuperAdmin
);


// ============================================================
// SUPER ADMIN DASHBOARD
// ============================================================

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getDashboard
);


// ============================================================
// TENANT LIST
// ============================================================
// GET /api/v1/super-admin/tenants

router.get(
  "/tenants",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getTenantList
);


// ============================================================
// TENANT BASIC DETAILS
// ============================================================
// GET /api/v1/super-admin/tenants/:tenantId

router.get(
  "/tenants/:tenantId",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getTenantDetails
);


// ============================================================
// TENANT ADMIN
// ============================================================
// GET /api/v1/super-admin/tenants/:tenantId/admin

router.get(
  "/tenants/:tenantId/admin",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getTenantAdmin
);


// ============================================================
// TENANT USERS
// ============================================================
// GET /api/v1/super-admin/tenants/:tenantId/users

router.get(
  "/tenants/:tenantId/users",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getTenantUsers
);


// ============================================================
// CURRENT SUBSCRIPTION
// ============================================================
// GET /api/v1/super-admin/tenants/:tenantId/subscription

router.get(
  "/tenants/:tenantId/subscription",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getTenantSubscription
);


// ============================================================
// SUBSCRIPTION HISTORY
// ============================================================
// GET /api/v1/super-admin/tenants/:tenantId/subscription-history

router.get(
  "/tenants/:tenantId/subscription-history",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getTenantSubscriptionHistory
);


// ============================================================
// PAYMENT HISTORY
// ============================================================
// GET /api/v1/super-admin/tenants/:tenantId/payment-history

router.get(
  "/tenants/:tenantId/payment-history",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getTenantPaymentHistory
);


// ============================================================
// TENANT USAGE
// ============================================================
// GET /api/v1/super-admin/tenants/:tenantId/usage

router.get(
  "/tenants/:tenantId/usage",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getTenantUsage
);


// ============================================================
// TENANT PROJECTS
// ============================================================
// GET /api/v1/super-admin/tenants/:tenantId/projects

router.get(
  "/tenants/:tenantId/projects",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getTenantProjects
);


// ============================================================
// TENANT FORMS
// ============================================================
// GET /api/v1/super-admin/tenants/:tenantId/forms

router.get(
  "/tenants/:tenantId/forms",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  getTenantForms
);


module.exports = router;