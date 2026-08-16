// src/routes/clientUser.routes.js

const express = require("express");

const {
  createClientUser,
  getClientUsers,
  getClientUser,
  updateClientUser,
  deleteClientUser,
  assignProjectToUser,
  removeProjectAccess,
  getUserProjects,
  getMyProjects
} = require("../controllers/clientUser.controller");

const authMiddleware =
  require("../middleware/auth.middleware");

const roleMiddleware =
  require("../middleware/role.middleware");

  const  clientRecordAccess = require("../middleware/clientRecordAccess.middleware")

const router = express.Router();

// ============================================================
// CLIENT USER CRUD
// ============================================================

router.post(
  "/users",
  authMiddleware,
  roleMiddleware("ADMIN"),
  clientRecordAccess,
  createClientUser
);

router.get(
  "/users",
  authMiddleware,
  roleMiddleware("ADMIN"),
  clientRecordAccess,
  getClientUsers
);

router.get(
  "/users/:userId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  clientRecordAccess,
  getClientUser
);

router.put(
  "/users/:userId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  clientRecordAccess,
  updateClientUser
);

router.delete(
  "/users/:userId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  clientRecordAccess,
  deleteClientUser
);

// ============================================================
// PROJECT ACCESS
// ============================================================

router.post(
  "/users/:userId/projects/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  clientRecordAccess,
  assignProjectToUser
);

router.delete(
  "/users/:userId/projects/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  clientRecordAccess,
  removeProjectAccess
);

router.get(
  "/users/:userId/projects",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getUserProjects
);


router.get(
  "/assigned/user/projects",
    authMiddleware,
    roleMiddleware("USER"),
    clientRecordAccess,
    getMyProjects
  );

module.exports = router;