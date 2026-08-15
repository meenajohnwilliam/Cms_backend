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
  roleMiddleware("ADMIN", "USER"),
  clientRecordAccess,
  createClientUser
);

router.get(
  "/users",
  authMiddleware,
  roleMiddleware("ADMIN", "USER"),
  clientRecordAccess,
  getClientUsers
);

router.get(
  "/users/:userId",
  authMiddleware,
  roleMiddleware("ADMIN", "USER"),
  clientRecordAccess,
  getClientUser
);

router.put(
  "/users/:userId",
  authMiddleware,
  roleMiddleware("ADMIN", "USER"),
  clientRecordAccess,
  updateClientUser
);

router.delete(
  "/users/:userId",
  authMiddleware,
  roleMiddleware("ADMIN", "USER"),
  clientRecordAccess,
  deleteClientUser
);

// ============================================================
// PROJECT ACCESS
// ============================================================

router.post(
  "/users/:userId/projects/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN", "USER"),
  clientRecordAccess,
  assignProjectToUser
);

router.delete(
  "/users/:userId/projects/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN", "USER"),
  clientRecordAccess,
  removeProjectAccess
);

router.get(
  "/users/:userId/projects",
  authMiddleware,
  roleMiddleware("ADMIN", "USER"),
  clientRecordAccess,
  getUserProjects
);

module.exports = router;