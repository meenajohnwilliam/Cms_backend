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


  /////////////

  // Project
  getProjectDetails,
  getProjectCollections,

  // Collection
  getCollectionDetails,
  getCollectionFields,
  getCollectionRecords,
  getCollectionMedia,

  // Record
  getRecordDetails,

  // Form
  getProjectForms,
  getFormDetails,
  getFormFields,
  getFormSubmissions,
  getFormMedia,

  // Submission
  getSubmissionDetails
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
);//////


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



//latest
// ============================================================
// PROJECT
// ============================================================

router.get(
    "/projects/:projectId",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getProjectDetails
  );
  
  router.get(
    "/projects/:projectId/collections",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getProjectCollections
  );
  

  
  
  // ============================================================
  // COLLECTION
  // ============================================================
  
  router.get(
    "/collections/:collectionId",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getCollectionDetails
  );
  
  router.get(
    "/collections/:collectionId/fields",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getCollectionFields
  );
  
  router.get(
    "/collections/:collectionId/records",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getCollectionRecords
  );
  
  router.get(
    "/collections/:collectionId/media",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getCollectionMedia
  );
  
  
  // ============================================================
  // RECORD
  // ============================================================
  
  router.get(
    "/records/:recordId",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getRecordDetails
  );/////not usee
  


  router.get(
    "/projects/:projectId/forms",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getProjectForms
  );
  
  // ============================================================
  // FORM
  // ============================================================
  
  router.get(
    "/forms/:formId",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getFormDetails
  );
  
  router.get(
    "/forms/:formId/fields",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getFormFields
  );
  
  router.get(
    "/forms/:formId/submissions",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getFormSubmissions
  );
  
  router.get(
    "/forms/:formId/media",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getFormMedia
  );
  
  
  // ============================================================
  // SUBMISSION
  // ============================================================
  
  router.get(
    "/submissions/:submissionId",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getSubmissionDetails
  );


module.exports = router;