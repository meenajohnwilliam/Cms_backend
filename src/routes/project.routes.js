// routes/project.routes.js

const express = require("express");

const {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
} = require("../controllers//project.controller");

const authMiddleware =
  require("../middleware/auth.middleware");

const roleMiddleware =
  require("../middleware/role.middleware");

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware("ADMIN"),
  createProject
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getProjects
);

router.get(
  "/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getProject
);

router.put(
  "/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  updateProject
);

router.delete(
  "/:projectId",
  authMiddleware,
  roleMiddleware("ADMIN"),
  deleteProject
);

module.exports = router;