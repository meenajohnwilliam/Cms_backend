const prisma = require("../config/prisma")


exports.createSuperAdmin = async (req, res) => {
    try {
      const { name, email, password } = req.body;
  
      const existingUser = await prisma.user.findUnique({
        where: {
          email,
        },
      });
  
      if (existingUser) {
        return res.status(400).json({
          message: "User already exists",
        });
      }

      const hashedPassword = await bcrypt.hash(
        password,
        12
      );
  
      const superAdmin = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword ,
          role: "SUPER_ADMIN",
          tenantId: null,
          isEmailVerified: true,
        },
      });
  
      res.status(201).json({
        message: "Super Admin created successfully",
        data: {
            userId: superAdmin.userId,
            name: superAdmin.name,
            email: superAdmin.email,
            role: superAdmin.role,
          },
      });
  
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  };