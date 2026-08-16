const express = require("express")
const app = express()
const cors = require("cors");
const cookieParser = require("cookie-parser");
const superAdminRoutes = require("./src/routes/superAdmin.routes");
const authRoutes = require("./src/routes/auth.routes");
const planRoutes = require("./src/routes/plan.routes");
const subscriptionRoutes = require("./src/routes/subscription.routes");
const {razorpayWebhook} = require("./src/controllers/subscription.controller") 
const projectRoutes = require("./src/routes/project.routes");
const collectionRoutes = require("./src/routes/collection.routes");
const fieldRoutes = require("./src/routes/field.routes");
const recordRoutes = require("./src/routes/record.routes");
const apiKeyRoutes = require("./src/routes/apiKey.routes");
const publicApiRoutes = require("./src/routes/publicApi.routes");
const clientUserRoutes = require("./src/routes/clientUser.routes");
const formRoutes = require("./src/routes/form.routes");
const formFieldRoutes = require("./src/routes/formField.routes");
const formSubmissionRoutes = require("./src/routes/formSubmission.routes");


app.use(
  cors({
    origin: [
      "http://localhost:5173",
      // "https://your-frontend.netlify.app",
    ],
    credentials: true,
  })
);

app.post("/api/v1/subscriptions/razorpay/webhook",
    express.raw({
      type: "application/json",
    }),
    razorpayWebhook
  );


app.use(express.json());


app.use(cookieParser());
app.use("/api/v1/super-admin", superAdminRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/plans", planRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/collections",collectionRoutes);
app.use("/api/v1/fields",fieldRoutes);
app.use("/api/v1/records",recordRoutes);
app.use("/api/v1/api-keys",apiKeyRoutes);
app.use("/api/v1/public",publicApiRoutes);
app.use("/api/v1/admin",clientUserRoutes);
app.use("/api/v1/forms",formRoutes);
app.use("/api/v1/fields",formFieldRoutes);
app.use("/api/v1/forms/submissions",formSubmissionRoutes);











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