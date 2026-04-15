const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendResetOtpEmail } = require("../utils/emailService");
const { logActivity } = require("../utils/activityLogger");
const auth = require("../middleware/auth.middleware");
const { signAuthToken, serverSessionId } = require("../utils/authSession");
const { validateStrongPassword } = require("../utils/passwordValidation");
const { normalizeEmail, validateEmailAddress } = require("../utils/inputValidation");

const buildOtpHash = (email, otp) =>
  crypto.createHash("sha256").update(`${String(email).toLowerCase()}:${otp}`).digest("hex");

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body; 
    if (!name || !email || !password || !confirmPassword) return res.status(400).json({ message: "All fields required" });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });

    const normalizedEmail = normalizeEmail(email);
    const emailError = validateEmailAddress(normalizedEmail);
    if (emailError) return res.status(400).json({ message: emailError });

    const passwordError = validateStrongPassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ message: "Email already in use" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: normalizedEmail, password: hashed, role: "user" });

    await logActivity({
      actionType: "CREATE",
      entityType: "USER",
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      title: "Customer Account Created",
      description: `${user.name} created a new customer account`,
      entityId: user._id,
      metadata: {
        email: user.email,
      },
    });

    res.status(201).json({ message: "User registered successfully", user: { id: user._id, name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const emailError = validateEmailAddress(normalizedEmail);
    if (emailError) return res.status(400).json({ message: emailError });

    const user = await User.findOne({ email: normalizedEmail, isDeleted: false });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    const token = signAuthToken({ id: user._id, role: user.role });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const normalizedEmail = normalizeEmail(email);
    const emailError = validateEmailAddress(normalizedEmail);
    if (emailError) return res.status(400).json({ message: emailError });

    console.log(`[AUTH] Forgot password requested for ${normalizedEmail}`);
    const user = await User.findOne({ email: normalizedEmail, isDeleted: false });
    if (!user) {
      console.warn(`[AUTH] No active user found for ${normalizedEmail}. OTP email not sent.`);
      return res.status(404).json({ message: "Please enter a registered email address." });
    }

    const resetOtp = String(Math.floor(100000 + Math.random() * 900000));
    const resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.resetToken = null;
    user.resetTokenExpiry = null;
    user.resetOtp = buildOtpHash(normalizedEmail, resetOtp);
    user.resetOtpExpiry = resetOtpExpiry;
    await user.save();

    const emailResult = await sendResetOtpEmail(normalizedEmail, user.name, resetOtp);
    if (!emailResult?.success) {
      user.resetOtp = null;
      user.resetOtpExpiry = null;
      await user.save();

      console.error("Forgot password email delivery failed:", emailResult?.error);
      return res.status(502).json({ message: "Failed to send OTP email. Please try again later." });
    }

    console.log(
      `[AUTH] Password reset OTP email accepted for ${normalizedEmail}. Message ID: ${emailResult.messageId}`
    );

    res.json({ message: "A temporary OTP has been sent to your email address." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Failed to process request" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;
    if (!email || !otp || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const passwordError = validateStrongPassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const normalizedEmail = normalizeEmail(email);
    const emailError = validateEmailAddress(normalizedEmail);
    if (emailError) return res.status(400).json({ message: emailError });

    const user = await User.findOne({
      email: normalizedEmail,
      resetOtp: buildOtpHash(normalizedEmail, String(otp).trim()),
      resetOtpExpiry: { $gt: new Date() },
      isDeleted: false
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    user.resetOtp = null;
    user.resetOtpExpiry = null;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

router.get("/validate", auth, async (req, res) => {
  res.json({
    valid: true,
    sessionId: serverSessionId,
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
});

module.exports = router;
