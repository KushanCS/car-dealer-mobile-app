const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead" },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: [true, "Vehicle is required"] },

  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
  staffMember: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 

  appointmentType: {
    type: String,
    enum: ["viewing", "test_drive", "follow_up"],
    default: "viewing",
  },

  date: { type: Date, required: [true, "Date is required"] },
  time: { type: String, required: [true, "Time is required"] },

  notes: { type: String, default: "" },

  status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },

  isArchived: { type: Boolean, default: false },

  emailSent: { type: Boolean, default: false },
  emailSentAt: { type: Date, default: null },
  customerReminderSentAt: { type: Date, default: null },
  staffReminderSentAt: { type: Date, default: null },

}, { timestamps: true });

AppointmentSchema.index({ date: 1, time: 1, status: 1, isArchived: 1 });
AppointmentSchema.index({ customer: 1, date: -1 });
AppointmentSchema.index({ staffMember: 1, date: -1 });
AppointmentSchema.index({ vehicle: 1, date: -1 });

module.exports = mongoose.model("Appointment", AppointmentSchema);
