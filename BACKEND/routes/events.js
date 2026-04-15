const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const auth = require("../middleware/auth.middleware");
const authorize = require("../middleware/authorize");

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Get all events (public - for appointment validation)
router.get("/", async (req, res) => {
  try {
    const events = await Event.find()
      .populate("createdBy", "name email")
      .sort({ startDate: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch events", error: err.message });
  }
});

// Get single event
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("createdBy", "name email");
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch event", error: err.message });
  }
});

// Create event (admin/staff only)
router.post("/", auth, authorize("admin", "staff"), async (req, res) => {
  try {
    const { name, type, description, startDate, endDate, isShopClosed, color } = req.body;

    // Validation
    if (!name || !type || !startDate || !endDate) {
      return res.status(400).json({ 
        message: "Name, type, start date, and end date are required" 
      });
    }

    // Parse and validate dates
    const start = startOfDay(startDate);
    const end = startOfDay(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ 
        message: "Invalid date format. Please use YYYY-MM-DD format" 
      });
    }

    if (end < start) {
      return res.status(400).json({ 
        message: "End date must be on or after start date" 
      });
    }

    // Check for overlapping events
    const overlapping = await Event.findOne({
      $or: [
        {
          startDate: { $lt: end },
          endDate: { $gt: start }
        }
      ]
    });

    if (overlapping) {
      return res.status(400).json({ 
        message: "This event overlaps with an existing event" 
      });
    }

    const event = new Event({
      name,
      type,
      description,
      startDate: start,
      endDate: end,
      isShopClosed: isShopClosed !== undefined ? isShopClosed : true,
      color: color || "#4CAF50",
      createdBy: req.user.id
    });

    await event.save();
    const populatedEvent = await event.populate("createdBy", "name email");
    
    res.status(201).json({
      message: "Event created successfully",
      event: populatedEvent
    });
  } catch (err) {
    console.error("Event creation error:", {
      message: err.message,
      name: err.name,
      stack: err.stack,
      requestBody: req.body
    });
    res.status(500).json({ 
      message: "Failed to create event", 
      error: err.message,
      details: err.name === "ValidationError" ? Object.values(err.errors).map(e => e.message) : undefined
    });
  }
});

// Update event (admin/staff only)
router.put("/:id", auth, authorize("admin", "staff"), async (req, res) => {
  try {
    const { name, type, description, startDate, endDate, isShopClosed, color } = req.body;
    const eventId = req.params.id;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Authorization - only creator or admin can update
    if (event.createdBy.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to update this event" });
    }

    // Update fields
    if (name) event.name = name;
    if (type) event.type = type;
    if (description !== undefined) event.description = description;
    if (startDate) {
      const start = startOfDay(startDate);
      if (isNaN(start.getTime())) {
        return res.status(400).json({ message: "Invalid start date format" });
      }
      event.startDate = start;
    }
    if (endDate) {
      const end = startOfDay(endDate);
      if (isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid end date format" });
      }
      event.endDate = end;
    }

    if (isShopClosed !== undefined) event.isShopClosed = isShopClosed;
    if (color) event.color = color;

    // Validate dates
    if (event.endDate < event.startDate) {
      return res.status(400).json({ 
        message: "End date must be on or after start date" 
      });
    }

    // Check for overlapping events (excluding self)
    const overlapping = await Event.findOne({
      _id: { $ne: eventId },
      $or: [
        {
          startDate: { $lt: event.endDate },
          endDate: { $gt: event.startDate }
        }
      ]
    });

    if (overlapping) {
      return res.status(400).json({ 
        message: "This event overlaps with an existing event" 
      });
    }

    await event.save();
    const populatedEvent = await event.populate("createdBy", "name email");

    res.json({
      message: "Event updated successfully",
      event: populatedEvent
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to update event", error: err.message });
  }
});

// Delete event (admin/staff only)
router.delete("/:id", auth, authorize("admin", "staff"), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Authorization - only creator or admin can delete
    if (event.createdBy.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this event" });
    }

    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete event", error: err.message });
  }
});

module.exports = router;
