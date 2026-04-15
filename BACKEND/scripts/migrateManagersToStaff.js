require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Activity = require("../models/Activity");

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function migrateManagersToStaff() {
  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI or MONGO_URI");
  }

  await mongoose.connect(mongoUri);

  const userResult = await User.updateMany(
    { role: "manager" },
    { $set: { role: "staff" } }
  );

  const activityResult = await Activity.updateMany(
    { userRole: "manager" },
    { $set: { userRole: "staff" } }
  );

  console.log(`Updated ${userResult.modifiedCount} user account(s) from manager to staff.`);
  console.log(`Updated ${activityResult.modifiedCount} activity record(s) from manager to staff.`);
}

migrateManagersToStaff()
  .then(() => {
    console.log("Manager role migration completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Manager role migration failed:", error);
    process.exit(1);
  });
