const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth.middleware");
const authorize = require("../middleware/authorize");
const { validateStrongPassword } = require("../utils/passwordValidation");
const { normalizeEmail, validateEmailAddress } = require("../utils/inputValidation");

router.post("/create", auth, authorize("admin"), async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    if (role !== "staff") {
      return res.status(400).json({ message: "Role must be staff" });
    }
    if (!name || !email || !password || !confirmPassword) return res.status(400).json({ message: "All fields required" });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });

    const normalizedEmail = normalizeEmail(email);
    const emailError = validateEmailAddress(normalizedEmail);
    if (emailError) return res.status(400).json({ message: emailError });

    const passwordError = validateStrongPassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: normalizedEmail, password: hashed, role });

    res.status(201).json({ message: "User created", user: { id: user._id, name, email: user.email, role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
