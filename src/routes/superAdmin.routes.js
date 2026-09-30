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



//latest
// ============================================================
// PROJECT
// ============================================================

// GET /api/v1/super-admin/projects/:projectId
router.get(
    "/projects/:projectId",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getProjectDetails
  );
  
  
  // ============================================================
  // PROJECT COLLECTIONS
  // ============================================================
  
  // GET /api/v1/super-admin/projects/:projectId/collections
  router.get(
    "/projects/:projectId/collections",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getProjectCollections
  );
  
  
  // ============================================================
  // COLLECTION
  // ============================================================
  
  // GET /api/v1/super-admin/collections/:collectionId
  router.get(
    "/collections/:collectionId",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getCollectionDetails
  );
  
  
  // ============================================================
  // COLLECTION FIELDS
  // ============================================================
  
  // GET /api/v1/super-admin/collections/:collectionId/fields
  router.get(
    "/collections/:collectionId/fields",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getCollectionFields
  );
  
  
  // ============================================================
  // COLLECTION RECORDS
  // ============================================================
  
  // GET /api/v1/super-admin/collections/:collectionId/records
  router.get(
    "/collections/:collectionId/records",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getCollectionRecords
  );
  
  
  // ============================================================
  // RECORD
  // ============================================================
  
  // GET /api/v1/super-admin/records/:recordId
  router.get(
    "/records/:recordId",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getRecordDetails
  );
  
  
  // ============================================================
  // RECORD MEDIA
  // ============================================================
  
  // GET /api/v1/super-admin/records/:recordId/media
  router.get(
    "/records/:recordId/media",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getRecordMedia
  );
  
  
  // ============================================================
  // PROJECT API KEYS
  // ============================================================
  
  // GET /api/v1/super-admin/projects/:projectId/api-keys
  router.get(
    "/projects/:projectId/api-keys",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getProjectApiKeys
  );
  
  
  // ============================================================
  // PROJECT FORMS
  // ============================================================
  
  // GET /api/v1/super-admin/projects/:projectId/forms
  router.get(
    "/projects/:projectId/forms",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getProjectForms
  );
  
  
  // ============================================================
  // FORM DETAILS
  // ============================================================
  
  // GET /api/v1/super-admin/forms/:formId
  router.get(
    "/forms/:formId",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getFormDetails
  );
  
  
  // ============================================================
  // FORM FIELDS
  // ============================================================
  
  // GET /api/v1/super-admin/forms/:formId/fields
  router.get(
    "/forms/:formId/fields",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getFormFields
  );
  
  
  // ============================================================
  // FORM SUBMISSIONS
  // ============================================================
  
  // GET /api/v1/super-admin/forms/:formId/submissions
  router.get(
    "/forms/:formId/submissions",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getFormSubmissions
  );
  
  
  // ============================================================
  // SUBMISSION DETAILS
  // ============================================================
  
  // GET /api/v1/super-admin/submissions/:submissionId
  router.get(
    "/submissions/:submissionId",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getSubmissionDetails
  );
  
  
  // ============================================================
  // SUBMISSION MEDIA
  // ============================================================
  
  // GET /api/v1/super-admin/submissions/:submissionId/media
  router.get(
    "/submissions/:submissionId/media",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getSubmissionMedia
  );
  
  
  // ============================================================
  // PROJECT USERS
  // ============================================================
  
  // GET /api/v1/super-admin/projects/:projectId/users
  router.get(
    "/projects/:projectId/users",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    getProjectUsers
  );



module.exports = router;