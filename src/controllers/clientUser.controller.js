// src/controllers/clientUser.controller.js

const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

// ============================================================
// CREATE CLIENT USER
// ============================================================

const createClientUser = async (req, res) => {
  try {
    const { name, email, password, projectId } = req.body;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can create client users",
      });
    }

    if (!name || !email || !password || !projectId) {
      return res.status(400).json({
        success: false,
        message:
          "name, email, password and projectId are required",
      });
    }

    // ========================================================
    // CHECK PROJECT BELONGS TO ADMIN TENANT
    // ========================================================

    const project = await prisma.project.findFirst({
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

    // ========================================================
    // CHECK EMAIL
    // ========================================================

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email: email.toLowerCase().trim(),
        },
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    // ========================================================
    // HASH PASSWORD
    // ========================================================

    const hashedPassword =
      await bcrypt.hash(password, 12);

    // ========================================================
    // CREATE USER + PROJECT ACCESS
    // ========================================================

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: "USER",
        tenantId,

        projectAccess: {
          create: {
            projectId,
            isActive: true,
          },
        },
      },

      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        isEmailVerified: true,
        createdAt: true,

        projectAccess: {
          select: {
            accessId: true,
            projectId: true,
            isActive: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Client user created successfully",
      user,
    });
  } catch (error) {
    console.error(
      "Create Client User Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// GET CLIENT USERS
// ============================================================

const getClientUsers = async (req, res) => {
  try {
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view client users",
      });
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId,
        role: "USER",
      },

      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,

        projectAccess: {
          where: {
            isActive: true,
          },

          select: {
            accessId: true,
            isActive: true,

            project: {
              select: {
                projectId: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error(
      "Get Client Users Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// GET SINGLE CLIENT USER
// ============================================================

const getClientUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view client users",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        userId,
        tenantId,
        role: "USER",
      },

      select: {
        userId: true,
        name: true,
        email: true,
        role: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,

        projectAccess: {
          where: {
            isActive: true,
          },

          select: {
            accessId: true,
            isActive: true,

            project: {
              select: {
                projectId: true,
                name: true,
                slug: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Client user not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(
      "Get Client User Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// UPDATE CLIENT USER
// ============================================================

const updateClientUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, password } = req.body;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can update client users",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        userId,
        tenantId,
        role: "USER",
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Client user not found",
      });
    }

    if (
      email !== undefined &&
      email.toLowerCase().trim() !==
        user.email
    ) {
      const existingUser =
        await prisma.user.findUnique({
          where: {
            email: email.toLowerCase().trim(),
          },
        });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    let hashedPassword;

    if (password) {
      hashedPassword =
        await bcrypt.hash(password, 12);
    }

    const updatedUser =
      await prisma.user.update({
        where: {
          userId,
        },

        data: {
          ...(name !== undefined && {
            name: name.trim(),
          }),

          ...(email !== undefined && {
            email: email.toLowerCase().trim(),
          }),

          ...(hashedPassword && {
            password: hashedPassword,
          }),
        },

        select: {
          userId: true,
          name: true,
          email: true,
          role: true,
          tenantId: true,
          isEmailVerified: true,
          updatedAt: true,
        },
      });

    return res.status(200).json({
      success: true,
      message: "Client user updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error(
      "Update Client User Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// DELETE CLIENT USER
// ============================================================

const deleteClientUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete client users",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        userId,
        tenantId,
        role: "USER",
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Client user not found",
      });
    }

    await prisma.user.delete({
      where: {
        userId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Client user deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Client User Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// ASSIGN PROJECT TO USER
// ============================================================

const assignProjectToUser = async (req, res) => {
  try {
    const { userId, projectId } = req.params;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can assign projects",
      });
    }

    // ========================================================
    // CHECK USER
    // ========================================================

    const user = await prisma.user.findFirst({
      where: {
        userId,
        tenantId,
        role: "USER",
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Client user not found",
      });
    }

    // ========================================================
    // CHECK PROJECT
    // ========================================================

    const project = await prisma.project.findFirst({
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

    // ========================================================
    // CHECK EXISTING ACCESS
    // ========================================================

    const existingAccess =
      await prisma.userProjectAccess.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
      });

    if (existingAccess) {
      if (existingAccess.isActive) {
        return res.status(409).json({
          success: false,
          message:
            "User already has access to this project",
        });
      }

      const access =
        await prisma.userProjectAccess.update({
          where: {
            accessId:
              existingAccess.accessId,
          },

          data: {
            isActive: true,
          },
        });

      return res.status(200).json({
        success: true,
        message:
          "Project access restored successfully",
        access,
      });
    }

    // ========================================================
    // CREATE ACCESS
    // ========================================================

    const access =
      await prisma.userProjectAccess.create({
        data: {
          userId,
          projectId,
          isActive: true,
        },

        include: {
          project: {
            select: {
              projectId: true,
              name: true,
              slug: true,
            },
          },
        },
      });

    return res.status(201).json({
      success: true,
      message:
        "Project assigned successfully",
      access,
    });
  } catch (error) {
    console.error(
      "Assign Project Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// REMOVE PROJECT ACCESS
// ============================================================

const removeProjectAccess = async (req, res) => {
  try {
    const { userId, projectId } = req.params;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message:
          "Only admin can remove project access",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        userId,
        tenantId,
        role: "USER",
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Client user not found",
      });
    }

    const project = await prisma.project.findFirst({
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

    const access =
      await prisma.userProjectAccess.findUnique({
        where: {
          userId_projectId: {
            userId,
            projectId,
          },
        },
      });

    if (!access) {
      return res.status(404).json({
        success: false,
        message:
          "Project access not found",
      });
    }

    await prisma.userProjectAccess.update({
      where: {
        accessId: access.accessId,
      },

      data: {
        isActive: false,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Project access removed successfully",
    });
  } catch (error) {
    console.error(
      "Remove Project Access Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ============================================================
// GET USER PROJECTS
// ============================================================

const getUserProjects = async (req, res) => {
  try {
    const { userId } = req.params;
    const { tenantId, role } = req.user;

    if (role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only admin can view user projects",
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        userId,
        tenantId,
        role: "USER",
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Client user not found",
      });
    }

    const projects =
      await prisma.userProjectAccess.findMany({
        where: {
          userId,
          isActive: true,
          project: {
            isActive: true,
          },
        },

        select: {
          accessId: true,
          isActive: true,

          project: {
            select: {
              projectId: true,
              name: true,
              slug: true,
              description: true,
              createdAt: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.status(200).json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error) {
    console.error(
      "Get User Projects Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



// only for user alone
// ============================================================
// GET MY ASSIGNED PROJECTS
// ============================================================

const getMyProjects = async (req, res) => {
  try {
    const { userId, tenantId, role } = req.user;

    if (role !== "USER") {
      return res.status(403).json({
        success: false,
        message: "Only client users can access this API",
      });
    }

    const projects = await prisma.userProjectAccess.findMany({
      where: {
        userId,
        isActive: true,

        project: {
          tenantId,
          isActive: true,
        },
      },

      select: {
        accessId: true,

        project: {
          select: {
            projectId: true,
            name: true,
            slug: true,
            description: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: projects.length,

      projects: projects.map((item) => ({
        accessId: item.accessId,
        ...item.project,
      })),
    });
  } catch (error) {
    console.error("Get My Projects Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



module.exports = {
  createClientUser,
  getClientUsers,
  getClientUser,
  updateClientUser,
  deleteClientUser,
  assignProjectToUser,
  removeProjectAccess,
  getUserProjects,
  getMyProjects,
};