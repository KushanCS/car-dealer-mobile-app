const router = require("express").Router();
const Holiday = require("../models/Holiday");
const auth = require("../middleware/auth.middleware");
const authorize = require("../middleware/authorize");

// Get all holidays
router.get("/", async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a new holiday (admin only)
router.post("/add", auth, authorize("admin"), async (req, res) => {
  try {
    const { name, date, description } = req.body;
    
    if (!name || !date) {
      return res.status(400).json({ message: "Name and date are required" });
    }

    // Check if holiday already exists
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await Holiday.findOne({
      date: { $gte: dayStart, $lte: dayEnd }
    });

    if (existing) {
      return res.status(400).json({ message: "Holiday already exists on this date" });
    }

    const holiday = new Holiday({
      name,
      date: new Date(date),
      description: description || ""
    });

    await holiday.save();
    res.status(201).json(holiday);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a holiday (admin only)
router.delete("/:id", auth, authorize("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    
    const holiday = await Holiday.findByIdAndDelete(id);
    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    res.json({ message: "Holiday deleted", holiday });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Add multiple holidays at once (for initial setup)
router.post("/bulk-add", auth, authorize("admin"), async (req, res) => {
  try {
    const { holidays } = req.body;
    
    if (!Array.isArray(holidays) || holidays.length === 0) {
      return res.status(400).json({ message: "Holidays array is required" });
    }

    const created = [];
    const errors = [];

    for (const h of holidays) {
      try {
        if (!h.name || !h.date) {
          errors.push(`Skipped: Missing name or date in entry`);
          continue;
        }

        const dayStart = new Date(h.date);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(h.date);
        dayEnd.setHours(23, 59, 59, 999);

        const existing = await Holiday.findOne({
          date: { $gte: dayStart, $lte: dayEnd }
        });

        if (existing) {
          errors.push(`${h.name} already exists`);
          continue;
        }

        const holiday = new Holiday({
          name: h.name,
          date: new Date(h.date),
          description: h.description || ""
        });

        await holiday.save();
        created.push(holiday);
      } catch (err) {
        errors.push(`Error adding ${h.name}: ${err.message}`);
      }
    }

    res.json({
      created,
      errors,
      message: `Added ${created.length} holiday(s)`
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
