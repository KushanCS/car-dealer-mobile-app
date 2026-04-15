require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

const createAdmin = async () => {
  await mongoose.connect(mongoUri);

  const existing = await User.findOne({ email: "admin@autopulse.com" });
  if (existing) {
    console.log("Admin already exists");
    process.exit();
  }

  const hashedPassword = await bcrypt.hash("admin123", 10);

  const admin = new User({
    name: "System Admin",
    email: "admin@autopulse.com",
    password: hashedPassword,
    role: "admin",
  });

  await admin.save();
  console.log("Admin created successfully!");
  process.exit();
};

createAdmin();
