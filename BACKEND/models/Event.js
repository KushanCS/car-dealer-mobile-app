const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ["holiday", "weather", "flood", "special", "other"], 
    default: "holiday",
    required: true
  },
  description: { 
    type: String, 
    default: "" 
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  isShopClosed: { 
    type: Boolean, 
    default: true // Prevents appointments on this day
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  color: {
    type: String,
    default: "#4CAF50" // Default green color
  }
}, { timestamps: true });

// Validate that endDate is after or same as startDate using custom validation
EventSchema.pre("save", function() {
  if (this.endDate < this.startDate) {
    throw new Error("End date must be on or after start date");
  }
});

module.exports = mongoose.model("Event", EventSchema);
