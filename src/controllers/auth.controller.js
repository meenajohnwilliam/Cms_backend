// controllers/auth.controller.js

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const prisma = require("../config/prisma");
const {
  sendVerificationEmail,
} = require("../utils/services/email.service");
const config = require("../config/config");

// ==========================================
// GENERATE SLUG
// ==========================================

const generateSlug = (companyName) => {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
};

// ==========================================
// GENERATE UNIQUE SLUG
// ==========================================

const generateUniqueSlug = async (companyName) => {
  const baseSlug = generateSlug(companyName);

  let slug = baseSlug;
  let count = 1;

  while (
    await prisma.tenant.findUnique({
      where: {
        slug,
      },
    })
  ) {
    slug = `${baseSlug}-${count}`;
    count++;
  }

  return slug;
};

// ==========================================
// GENERATE JWT
// ==========================================

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.userId,
      role: user.role,
      tenantId: user.tenantId,
    },
    config.jwtSecret,
    {
      expiresIn: "7d",
    }
  );
};

// ==========================================
// SET AUTH COOKIE
// ==========================================

const setAuthCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,

    secure:
      config.nodeEnv === "production",

    sameSite:
      config.nodeEnv === "production"
        ? "none"
        : "lax",

    maxAge:
      7 * 24 * 60 * 60 * 1000,
  });
};

// ==========================================
// GENERATE OTP
// ==========================================

const generateOTP = () => {
  return crypto
    .randomInt(100000, 1000000)
    .toString();
};

// ==========================================
// ADMIN REGISTER
// ==========================================

const adminRegister = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      companyName,
    } = req.body;

    if (
      !name ||
      !email ||
      !password ||
      !companyName
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, password and companyName are required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "Email already registered",
      });
    }

    let slug =
      generateSlug(companyName);

    const existingTenant =
      await prisma.tenant.findUnique({
        where: {
          slug,
        },
      });

    if (existingTenant) {
      slug =
        await generateUniqueSlug(
          companyName
        );
    }

    const hashedPassword =
      await bcrypt.hash(
        password,
        12
      );

    const emailVerificationOtp =
      generateOTP();

    const emailVerificationExpires =
      new Date(
        Date.now() +
          10 * 60 * 1000
      );

    const result =
      await prisma.$transaction(
        async (tx) => {
          const tenant =
            await tx.tenant.create({
              data: {
                name: companyName.trim(),
                slug,
              },
            });

          const admin =
            await tx.user.create({
              data: {
                name: name.trim(),
                email: normalizedEmail,
                password: hashedPassword,
                role: "ADMIN",
                tenantId:
                  tenant.tenantId,
                isEmailVerified: false,
                emailVerificationOtp,
                emailVerificationExpires,
              },
            });

          return {
            tenant,
            admin,
          };
        }
      );

    await sendVerificationEmail(
      normalizedEmail,
      name,
      emailVerificationOtp
    );

    return res.status(201).json({
      success: true,
      message:
        "Registration successful. OTP sent to your email.",

      userId:
        result.admin.userId,

      email:
        result.admin.email,

      tenantId:
        result.tenant.tenantId,
    });
  } catch (error) {
    console.error(
      "Admin Register Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
};

// ==========================================
// VERIFY EMAIL OTP
// ==========================================

const verifyEmail = async (req, res) => {
  try {
    const {
      email,
      otp,
    } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message:
          "Email and OTP are required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const normalizedOtp =
      String(otp).trim();

    const user =
      await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
        include: {
          tenant: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message:
          "Email already verified",
      });
    }

    if (
      !user.emailVerificationOtp
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Verification OTP not found",
      });
    }

    if (
      !user.emailVerificationExpires ||
      user.emailVerificationExpires <
        new Date()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "OTP has expired",
      });
    }

    if (
      user.emailVerificationOtp !==
      normalizedOtp
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid OTP",
      });
    }

    const updatedUser =
      await prisma.user.update({
        where: {
          userId: user.userId,
        },
        data: {
          isEmailVerified: true,
          emailVerificationOtp: null,
          emailVerificationExpires: null,
          lastLoginAt: new Date(),
        },
      });

    const authToken =
      generateToken(
        updatedUser
      );

    setAuthCookie(
      res,
      authToken
    );

    let redirectUrl;

    if (
      updatedUser.role ===
      "SUPER_ADMIN"
    ) {
      redirectUrl =
        "/super-admin/dashboard";
    } else if (
      updatedUser.role ===
      "ADMIN"
    ) {
      redirectUrl =
        "/admin/dashboard";
    } else {
      redirectUrl =
        "/user/dashboard";
    }

    return res.status(200).json({
      success: true,
      message:
        "Email verified successfully",

      redirectUrl,

      user: {
        userId:
          updatedUser.userId,

        name:
          updatedUser.name,

        email:
          updatedUser.email,

        role:
          updatedUser.role,

        tenantId:
          updatedUser.tenantId,
      },
    });
  } catch (error) {
    console.error(
      "Verify Email Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
};

// ==========================================
// LOGIN
// ==========================================

const login = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
        include: {
          tenant: true,
        },
      });

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    const passwordValid =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email first",
      });
    }

    if (
      user.role !== "SUPER_ADMIN"
    ) {
      if (
        !user.tenantId ||
        !user.tenant
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Tenant not found",
        });
      }

      if (
        !user.tenant.isActive
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Tenant is inactive",
        });
      }
    }

    const token =
      generateToken(user);

    setAuthCookie(
      res,
      token
    );

    await prisma.user.update({
      where: {
        userId: user.userId,
      },
      data: {
        lastLoginAt:
          new Date(),
      },
    });

    let redirectUrl;

    if (
      user.role ===
      "SUPER_ADMIN"
    ) {
      redirectUrl =
        "/super-admin/dashboard";
    } else if (
      user.role === "ADMIN"
    ) {
      redirectUrl =
        "/admin/dashboard";
    } else if (
      user.role === "USER"
    ) {
      redirectUrl =
        "/user/dashboard";
    }

    return res.status(200).json({
      success: true,
      message:
        "Login successful",

      redirectUrl,

      user: {
        userId:
          user.userId,

        name:
          user.name,

        email:
          user.email,

        role:
          user.role,

        tenantId:
          user.tenantId,
      },
    });
  } catch (error) {
    console.error(
      "Login Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Internal server error",
    });
  }
};

module.exports = {
  adminRegister,
  verifyEmail,
  login,
};