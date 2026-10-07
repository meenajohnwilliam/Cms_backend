const express = require("express");

const {
  createSuperAdmin,
  getDashboard,

  // Tenant APIs
  getTenantList,
  getTenantDetails,
  updateTenant,
  activateTenant,
  deactivateTenant,
  
  getTenantAdmin,
  updateTenantAdmin,
  activateTenantAdmin,
  deactivateTenantAdmin,

  getTenantUsers,
  updateTenantUser,
  activateTenantUser,
  deactivateTenantUser,

  getTenantSubscription,
  getTenantSubscriptionHistory,
  changeTenantSubscriptionPlan,
  suspendTenantSubscription,
  activateTenantSubscription,
  cancelTenantSubscription,
  extendTenantSubscription,
  getTenantPaymentHistory,
  getTenantUsage,
  resetTenantUsage,
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
//   getRecordDetails,

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



// Edit tenant
router.patch(
    "/tenants/:tenantId",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    updateTenant
  );
  
  // Activate tenant
  router.post(
    "/tenants/:tenantId/activate",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    activateTenant
  );
  
  // Deactivate tenant
  router.post(
    "/tenants/:tenantId/deactivate",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    deactivateTenant
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

// Edit tenant admin
router.patch(
    "/tenants/:tenantId/admin",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    updateTenantAdmin
  );
  
  // Activate tenant admin
  router.post(
    "/tenants/:tenantId/admin/activate",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    activateTenantAdmin
  );
  
  // Deactivate tenant admin
  router.post(
    "/tenants/:tenantId/admin/deactivate",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    deactivateTenantAdmin
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

// Edit tenant user
router.patch(
    "/tenants/:tenantId/users/:userId",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    updateTenantUser
  );
  
  // Activate tenant user
  router.post(
    "/tenants/:tenantId/users/:userId/activate",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    activateTenantUser
  );
  
  // Deactivate tenant user
  router.post(
    "/tenants/:tenantId/users/:userId/deactivate",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    deactivateTenantUser
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


// CHANGE PLAN
router.post(
    "/tenants/:tenantId/subscription/change-plan",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    changeTenantSubscriptionPlan
  );
  
  
  // SUSPEND
  router.post(
    "/tenants/:tenantId/subscription/suspend",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    suspendTenantSubscription
  );
  
  
  // ACTIVATE
  router.post(
    "/tenants/:tenantId/subscription/activate",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    activateTenantSubscription
  );
  
  
  // CANCEL
  router.post(
    "/tenants/:tenantId/subscription/cancel",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    cancelTenantSubscription
  );
  
  
  // EXTEND
  router.post(
    "/tenants/:tenantId/subscription/extend",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    extendTenantSubscription
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


// RESET TENANT USAGE
router.post(
    "/tenants/:tenantId/usage/reset",
    authMiddleware,
    roleMiddleware("SUPER_ADMIN"),
    resetTenantUsage
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
  
//   router.get(
//     "/records/:recordId",
//     authMiddleware,
//     roleMiddleware("SUPER_ADMIN"),
//     getRecordDetails
//   );/////not usee
  


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