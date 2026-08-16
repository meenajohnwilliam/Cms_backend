

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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

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

    const normalizedName =
      name.trim();

    const normalizedEmail =
      email.trim().toLowerCase();

    const normalizedCompanyName =
      companyName.trim();

    if (
      !normalizedName ||
      !normalizedEmail ||
      !normalizedCompanyName
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and companyName cannot be empty",
      });
    }

    // ------------------------------------------
    // CHECK EXISTING USER
    // ------------------------------------------

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

    // ------------------------------------------
    // GENERATE UNIQUE SLUG
    // ------------------------------------------

    const slug =
      await generateUniqueSlug(
        normalizedCompanyName
      );

    // ------------------------------------------
    // HASH PASSWORD
    // ------------------------------------------

    const hashedPassword =
      await bcrypt.hash(
        password,
        12
      );

    // ------------------------------------------
    // GENERATE OTP
    // ------------------------------------------

    const emailVerificationOtp =
      generateOTP();

    const emailVerificationExpires =
      new Date(
        Date.now() +
          10 * 60 * 1000
      );

    const emailVerificationOtpCreatedAt =
      new Date();

    // ------------------------------------------
    // CREATE TENANT
    // CREATE ADMIN
    // CREATE FREE SUBSCRIPTION
    // ------------------------------------------

    const tenant = await prisma.tenant.create({
        data: {
          name: normalizedCompanyName,
          slug,
        },
      });
      
      const admin = await prisma.user.create({
        data: {
          name: normalizedName,
          email: normalizedEmail,
          password: hashedPassword,
          role: "ADMIN",
      
          tenant: {
            connect: {
              tenantId: tenant.tenantId,
            },
          },
      
          isEmailVerified: false,
          emailVerificationOtp,
          emailVerificationExpires,
          emailVerificationOtpCreatedAt,
        },
      });
      
      const freePlan = await prisma.plan.findFirst({
        where: {
          name: "Free",
          isActive: true,
        },
      });
      
      if (!freePlan) {
        return res.status(500).json({
          success: false,
          message:
            "Free plan not found. Please create the Free plan first.",
        });
      }

      const startDate = new Date();
      
      const endDate = new Date(startDate);
      endDate.setMonth(
        endDate.getMonth() + 1
      );
      
      const subscription =
        await prisma.subscription.create({
          data: {
            tenantId: tenant.tenantId,
            planId: freePlan.planId,
            billingCycle: "MONTHLY",
            status: "ACTIVE",
            startDate,
            endDate,
          },
        });
      
      const result = {
        tenant,
        admin,
        subscription,
      };

    // ------------------------------------------
    // SEND OTP EMAIL
    // ------------------------------------------

    await sendVerificationEmail(
      normalizedEmail,
      normalizedName,
      emailVerificationOtp
    );

    // ------------------------------------------
    // RESPONSE
    // ------------------------------------------

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

      subscriptionId:
        result.subscription.subscriptionId,
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

    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

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

    // ------------------------------------------
    // FIND USER
    // ------------------------------------------

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

    // ------------------------------------------
    // CHECK EMAIL VERIFIED
    // ------------------------------------------

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message:
          "Email already verified",
      });
    }

    // ------------------------------------------
    // CHECK OTP EXISTS
    // ------------------------------------------

    if (
      !user.emailVerificationOtp
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Verification OTP not found",
      });
    }

    // ------------------------------------------
    // CHECK OTP EXPIRATION
    // ------------------------------------------

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

    // ------------------------------------------
    // CHECK OTP
    // ------------------------------------------

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

    // ------------------------------------------
    // VERIFY USER
    // ------------------------------------------

    const updatedUser =
      await prisma.user.update({
        where: {
          userId:
            user.userId,
        },

        data: {
          isEmailVerified:
            true,

          emailVerificationOtp:
            null,

          emailVerificationExpires:
            null,

          emailVerificationOtpCreatedAt:
            null,

          lastLoginAt:
            new Date(),
        },
      });

    // ------------------------------------------
    // GENERATE JWT
    // ------------------------------------------

    const authToken =
      generateToken(
        updatedUser
      );

    // ------------------------------------------
    // SET COOKIE
    // ------------------------------------------

    setAuthCookie(
      res,
      authToken
    );

    // ------------------------------------------
    // REDIRECT
    // ------------------------------------------

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

    // ------------------------------------------
    // RESPONSE
    // ------------------------------------------

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
// RESEND OTP
// ==========================================

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!email) {
      return res.status(400).json({
        success: false,
        message:
          "Email is required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // ------------------------------------------
    // FIND USER
    // ------------------------------------------

    const user =
      await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    // ------------------------------------------
    // CHECK ALREADY VERIFIED
    // ------------------------------------------

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message:
          "Email already verified",
      });
    }

    // ------------------------------------------
    // CHECK 60 SECOND RATE LIMIT
    // ------------------------------------------

    if (
      user.emailVerificationOtpCreatedAt
    ) {
      const secondsPassed =
        Math.floor(
          (
            Date.now() -
            user.emailVerificationOtpCreatedAt.getTime()
          ) / 1000
        );

      if (secondsPassed < 60) {
        const retryAfter =
          60 - secondsPassed;

        return res.status(429).json({
          success: false,

          message:
            `Please wait ${retryAfter} seconds before requesting a new OTP`,

          retryAfter,
        });
      }
    }

    // ------------------------------------------
    // GENERATE NEW OTP
    // ------------------------------------------

    const emailVerificationOtp =
      generateOTP();

    const emailVerificationExpires =
      new Date(
        Date.now() +
          10 * 60 * 1000
      );

    const emailVerificationOtpCreatedAt =
      new Date();

    // ------------------------------------------
    // UPDATE OTP
    // ------------------------------------------

    await prisma.user.update({
      where: {
        userId:
          user.userId,
      },

      data: {
        emailVerificationOtp,

        emailVerificationExpires,

        emailVerificationOtpCreatedAt,
      },
    });

    // ------------------------------------------
    // SEND EMAIL
    // ------------------------------------------

    await sendVerificationEmail(
      normalizedEmail,
      user.name,
      emailVerificationOtp
    );

    // ------------------------------------------
    // RESPONSE
    // ------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "OTP resent successfully",
    });
  } catch (error) {
    console.error(
      "Resend OTP Error:",
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

    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // ------------------------------------------
    // FIND USER
    // ------------------------------------------

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
          "Account does not exist",
      });
    }

    // ------------------------------------------
    // CHECK PASSWORD
    // ------------------------------------------

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

    // ------------------------------------------
    // CHECK EMAIL
    // ------------------------------------------

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email first",
      });
    }

    // ------------------------------------------
    // CHECK TENANT
    // ------------------------------------------

    if (
      user.role !==
      "SUPER_ADMIN"
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

    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
    });



    // ------------------------------------------
    // GENERATE TOKEN
    // ------------------------------------------

    const token =
      generateToken(user);

    // ------------------------------------------
    // SET COOKIE
    // ------------------------------------------

    setAuthCookie(
      res,
      token
    );

    // ------------------------------------------
    // UPDATE LAST LOGIN
    // ------------------------------------------

    await prisma.user.update({
      where: {
        userId:
          user.userId,
      },

      data: {
        lastLoginAt:
          new Date(),
      },
    });

    // ------------------------------------------
    // REDIRECT
    // ------------------------------------------

    let redirectUrl;

    if (
      user.role ===
      "SUPER_ADMIN"
    ) {
      redirectUrl =
        "/super-admin/dashboard";
    } else if (
      user.role ===
      "ADMIN"
    ) {
      redirectUrl =
        "/admin/dashboard";
    } else if (
      user.role ===
      "USER"
    ) {
      redirectUrl =
        "/user/dashboard";
    }

    // ------------------------------------------
    // RESPONSE
    // ------------------------------------------

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

// ==========================================
// LOGOUT
// ==========================================

const logout = async (req, res) => {
  try {
    res.clearCookie(
      "token",
      {
        httpOnly: true,

        secure:
          config.nodeEnv ===
          "production",

        sameSite:
          config.nodeEnv ===
          "production"
            ? "none"
            : "lax",
      }
    );

    return res.status(200).json({
      success: true,
      message:
        "Logout successful",
    });
  } catch (error) {
    console.error(
      "Logout Error:",
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
// EXPORT
// ==========================================

module.exports = {
  adminRegister,
  verifyEmail,
  resendOtp,
  login,
  logout,
};