// controllers/project.controller.js

const prisma = require("../config/prisma");

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// ==========================================
// CREATE PROJECT
// ==========================================

const createProject = async (req, res) => {
  try {
    const { name, description } = req.body;
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(403).json({
        success: false,
        message: "Tenant not found",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    const subscription =
      await prisma.subscription.findFirst({
        where: {
          tenantId,
          status: "ACTIVE",
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: "Active subscription required",
      });
    }

    const projectCount =
      await prisma.project.count({
        where: {
          tenantId,
          isActive: true,
        },
      });

    if (
      subscription.plan.projectLimit !== -1 &&
      projectCount >= subscription.plan.projectLimit
    ) {
      return res.status(403).json({
        success: false,
        message: "Project limit reached",
      });
    }

    const slug = generateSlug(name);

    const existingProject =
      await prisma.project.findUnique({
        where: {
          tenantId_slug: {
            tenantId,
            slug,
          },
        },
      });

    if (existingProject) {
      return res.status(409).json({
        success: false,
        message: "Project name already exists",
      });
    }

    const project =
      await prisma.project.create({
        data: {
          tenantId,
          name: name.trim(),
          slug,
          description:
            description?.trim() || null,
        },
      });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    console.error(
      "Create Project Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// GET ALL PROJECTS
// ==========================================

const getProjects = async (req, res) => {
  try {
    const { tenantId } = req.body;

    const projects =
      await prisma.project.findMany({
        where: {
          tenantId,
          isActive: true,
        },
        include: {
          _count: {
            select: {
              collections: true,
              apiKeys: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error(
      "Get Projects Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// GET SINGLE PROJECT
// ==========================================

const getProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tenantId } = req.body;

    const project =
      await prisma.project.findFirst({
        where: {
          projectId,
          tenantId,
          isActive: true,
        },
        include: {
          collections: {
            orderBy: {
              createdAt: "desc",
            },
          },
          _count: {
            select: {
              collections: true,
              apiKeys: true,
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
      project,
    });
  } catch (error) {
    console.error(
      "Get Project Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// UPDATE PROJECT
// ==========================================

const updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description } = req.body;
    const { tenantId } = req.body;

    const project =
      await prisma.project.findFirst({
        where: {
          projectId,
          tenantId,
          isActive: true,
        },
      });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (
      name !== undefined &&
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Project name cannot be empty",
      });
    }

    let slug;

    if (
      name !== undefined &&
      name.trim() !== project.name
    ) {
      slug = generateSlug(name);

      const existingProject =
        await prisma.project.findFirst({
          where: {
            tenantId,
            slug,
            NOT: {
              projectId,
            },
          },
        });

      if (existingProject) {
        return res.status(409).json({
          success: false,
          message:
            "Project name already exists",
        });
      }
    }

    const updatedProject =
      await prisma.project.update({
        where: {
          projectId,
        },
        data: {
          ...(name !== undefined && {
            name: name.trim(),
          }),

          ...(slug !== undefined && {
            slug,
          }),

          ...(description !== undefined && {
            description:
              description.trim() || null,
          }),
        },
      });

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      project: updatedProject,
    });
  } catch (error) {
    console.error(
      "Update Project Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ==========================================
// DELETE PROJECT
// ==========================================

const deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tenantId } = req.body;

    const project =
      await prisma.project.findFirst({
        where: {
          projectId,
          tenantId,
          isActive: true,
        },
      });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    await prisma.project.update({
      where: {
        projectId,
      },
      data: {
        isActive: false,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Project Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
};