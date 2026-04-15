const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const auth = require("../middleware/auth.middleware");
const authorize = require("../middleware/authorize");
const { validateObjectId } = require("../utils/validateObjectId");
const { logActivity } = require("../utils/activityLogger");
const { validateStrongPassword } = require("../utils/passwordValidation");
const { normalizeEmail, normalizePersonName, validateEmailAddress, validatePersonName } = require("../utils/inputValidation");

router.post("/create", auth, authorize("admin"), async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "name, email, password, and confirmPassword are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const normalizedName = normalizePersonName(name);
    const nameError = validatePersonName(normalizedName);
    if (nameError) return res.status(400).json({ message: nameError });

    const normalizedEmail = normalizeEmail(email);
    const emailError = validateEmailAddress(normalizedEmail);
    if (emailError) return res.status(400).json({ message: emailError });

    const passwordError = validateStrongPassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const allowedRoles = ["staff", "user"];
    const safeRole = allowedRoles.includes(role) ? role : "staff";

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ message: "Email already in use" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password: hashed,
      role: safeRole,
      isDeleted: false,
    });

    await logActivity({
      actionType: "CREATE",
      entityType: "STAFF",
      userId: req.user.id,
      userName: req.user.name || req.user.email || "Admin",
      userRole: req.user.role,
      title: "Staff Account Created",
      description: `${normalizedName} was added as ${safeRole}`,
      entityId: user._id,
      metadata: {
        email: user.email,
        role: user.role,
      },
    });

    res.status(201).json({
      message: "User created",
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", auth, authorize("admin"), async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", auth, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid user id" });

    const { role, isDeleted, name, email } = req.body;

    const allowedRoles = ["staff", "user"];
    const update = {};
    if (typeof name === "string" && name.trim()) {
      const normalizedName = normalizePersonName(name);
      const nameError = validatePersonName(normalizedName);
      if (nameError) return res.status(400).json({ message: nameError });
      update.name = normalizedName;
    }
    if (typeof email === "string" && email.trim()) {
      const normalizedEmail = normalizeEmail(email);
      const emailError = validateEmailAddress(normalizedEmail);
      if (emailError) return res.status(400).json({ message: emailError });
      update.email = normalizedEmail;
    }
    if (role && allowedRoles.includes(role)) update.role = role;
    if (typeof isDeleted === "boolean") update.isDeleted = isDeleted;

    const existing = await User.findById(id).select("-password");
    if (!existing) return res.status(404).json({ message: "User not found" });

    if (update.email && update.email !== existing.email) {
      const duplicate = await User.findOne({ email: update.email, _id: { $ne: id } });
      if (duplicate) return res.status(400).json({ message: "Email already in use" });
    }

    const updated = await User.findByIdAndUpdate(id, update, { new: true }).select("-password");
    if (!updated) return res.status(404).json({ message: "User not found" });

    const changes = {};
    if (existing.name !== updated.name) changes.name = { from: existing.name, to: updated.name };
    if (existing.email !== updated.email) changes.email = { from: existing.email, to: updated.email };
    if (existing.role !== updated.role) changes.role = { from: existing.role, to: updated.role };
    if (existing.isDeleted !== updated.isDeleted) changes.isDeleted = { from: existing.isDeleted, to: updated.isDeleted };

    if (Object.keys(changes).length > 0) {
      await logActivity({
        actionType: "UPDATE",
        entityType: updated.role === "user" ? "USER" : "STAFF",
        userId: req.user.id,
        userName: req.user.name || req.user.email || "Admin",
        userRole: req.user.role,
        title: "User Account Updated",
        description: `${updated.name} account details were updated`,
        entityId: updated._id,
        changes,
        metadata: {
          email: updated.email,
          role: updated.role,
        },
      });
    }

    res.json({ message: "User updated", user: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", auth, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id))
      return res.status(400).json({ message: "Invalid user id" });

    const deleted = await User.findByIdAndDelete(id);

    if (!deleted)
      return res.status(404).json({ message: "User not found" });

    res.json({ message: "User permanently deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
