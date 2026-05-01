const router = require("express").Router();
const Notification = require("../models/Notification");
const auth = require("../middleware/auth.middleware");
const authorize = require("../middleware/authorize");

router.post("/add", auth, authorize("admin", "staff"), async (req, res, next) => {
  try {
    const notificationData = {
      title: req.body.title?.trim(),
      message: req.body.message?.trim(),
      recipient: req.body.recipient,
      type: req.body.type || "info",
      priority: req.body.priority || "normal",
      isRead: req.body.isRead ?? false,
    };

    const notif = new Notification(notificationData);
    const saved = await notif.save();
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

router.get("/", auth, authorize("admin", "staff"), async (req, res, next) => {
  try {
    const notifications = await Notification.find().populate("recipient");
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", auth, authorize("admin", "staff"), async (req, res, next) => {
  try {
    const updateData = {
      title: req.body.title?.trim(),
      message: req.body.message?.trim(),
      type: req.body.type,
      priority: req.body.priority,
      isRead: req.body.isRead,
    };

    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "Notification not found" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", auth, authorize("admin", "staff"), async (req, res, next) => {
  try {
    const deleted = await Notification.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Notification deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
