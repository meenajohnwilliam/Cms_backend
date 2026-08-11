const express = require("express")
const app = express()
const superAdminRoutes = require("./src/routes/superAdmin.routes");
const authRoutes = require("./src/routes/auth.routes")
const planRoutes = require("./src/routes/plan.routes");

app.use(express.json())
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      // "https://your-frontend.netlify.app",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use("/api/v1/super-admin", superAdminRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/plans", planRoutes);


app.get("/api/v1/health", (req, res) => {
    res.json({
        status: "OK",
        uptime: `${process.uptime()} seconds`,
        timestamp: new Date()
    });
});

app.listen(8003,()=>{
    console.log("Server Started at port:8003")
})