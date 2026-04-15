const mongoose = require("mongoose");
const { normalizeEmail, isValidEmailAddress } = require("../utils/inputValidation");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      set: normalizeEmail,
      validate: {
        validator: isValidEmailAddress,
        message: "Please enter a valid email address with a real domain like gmail.com, yahoo.com, or outlook.com",
      },
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "staff", "user"],
      default: "user",
    },
    isDeleted: { type: Boolean, default: false },
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },
    resetOtp: { type: String, default: null },
    resetOtpExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, isDeleted: 1 });
userSchema.index({ email: 1, isDeleted: 1 });

module.exports = mongoose.model("User", userSchema);
