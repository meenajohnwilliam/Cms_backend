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

const router = express.Router();

// ============================================================
// CLIENT USER CRUD
// ============================================================

router.post(
  "/users",
  authMiddleware,
  roleMiddleware("ADMIN"),
  createClientUser
);

router.get(
  "/users",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getClientUsers
);

router.get(
  "/users/:userId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getClientUser
);

router.put(
  "/users/:userId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  updateClientUser
);

router.delete(
  "/users/:userId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  deleteClientUser
);

// ============================================================
// PROJECT ACCESS
// ============================================================

router.post(
  "/users/:userId/projects/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  assignProjectToUser
);

router.delete(
  "/users/:userId/projects/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  removeProjectAccess
);

router.get(
  "/users/:userId/projects",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getUserProjects
);

module.exports = router;