const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const authMiddleware = require("./middleware/auth.middleware");
const { startAppointmentReminder } = require("./utils/appointmentReminder");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8070;
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

const vehicle_routes = require("./routes/vehicles")

// db
if (!mongoUri) {
  console.error("MongoDB Connection Failed: missing MONGO_URI or MONGODB_URI in BACKEND/.env");
} else {
  mongoose
    .connect(mongoUri)
    .then(() => console.log("MongoDB Connection success!"))
    .catch((err) => console.error("MongoDB Connection Failed:", err));
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start appointment reminder scheduler
  startAppointmentReminder();
});

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// routes
app.use("/api/leads", require("./routes/leads"));
app.use("/api/vehicles", vehicle_routes); // ✅ only ONCE
app.use("/api/sales", require("./routes/sales"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/users", require("./routes/users"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/customer/appointments", require("./routes/customerAppointments"));
app.use("/api/admin/users", require("./routes/adminUsers"));
app.use("/api/documents", require("./routes/physicalDocuments"));
app.use("/api/holidays", require("./routes/holidays"));
app.use("/api/events", require("./routes/events"));
app.use("/api/activities", require("./routes/activities"));

// static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.get("/", (req, res) => res.send("API is running"));


// ✅ error handler must be LAST
app.use(require("./middleware/errorHandler"));
