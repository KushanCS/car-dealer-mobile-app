const router = require("express").Router();
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const auth = require("../middleware/auth.middleware");
const authorize = require("../middleware/authorize");
const { validateObjectId } = require("../utils/validateObjectId");
const { logActivity } = require("../utils/activityLogger");
const {
  validateAppointmentDetails,
  getAvailableStaff,
  getAvailableTimeSlots,
  getDateClosureInfo,
} = require("../utils/appointmentValidation");

function formatVehicleLabel(vehicle) {
  if (!vehicle) return "";
  return [vehicle.brand, vehicle.type, vehicle.year ? `(${vehicle.year})` : ""].filter(Boolean).join(" ");
}

router.post("/book", auth, authorize("user"), async (req, res) => {
  try {
    const { vehicle, date, time, staffMember } = req.body;
    if (!vehicle || !date || !time) return res.status(400).json({ message: "Vehicle, date, time required" });

    // Validate appointment details
    const errors = await validateAppointmentDetails(date, time, staffMember);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    // If no staff member specified, auto-assign first available
    let assignedStaff = staffMember;
    if (!staffMember) {
      const availableStaff = await getAvailableStaff(date, time);
      if (availableStaff.length === 0) {
        return res.status(400).json({ 
          message: "No staff available at this time. Please select another time.",
          timeSlots: await getAvailableTimeSlots(date)
        });
      }
      assignedStaff = availableStaff[0]._id;
    }

    const saved = await new Appointment({
      vehicle,
      date: new Date(date),
      time,
      customer: req.user.id,
      staffMember: assignedStaff,
      status: "scheduled",
    }).save();

    const customer = await User.findById(req.user.id).select("name email role");
    const hydratedAppointment = await Appointment.findById(saved._id)
      .populate("vehicle")
      .populate("staffMember", "name email role");

    await logActivity({
      actionType: "CREATE",
      entityType: "APPOINTMENT",
      userId: req.user.id,
      userName: customer?.name || customer?.email || "Customer",
      userRole: customer?.role || req.user.role,
      title: "Customer Test Drive Booked",
      description: `${customer?.name || customer?.email || "A customer"} booked a test drive appointment`,
      entityId: saved._id,
      metadata: {
        customer: req.user.id,
        vehicle: hydratedAppointment?.vehicle?._id || vehicle,
        vehicleName: formatVehicleLabel(hydratedAppointment?.vehicle),
        staffMember: hydratedAppointment?.staffMember?._id || assignedStaff,
        staffName: hydratedAppointment?.staffMember?.name || "",
        customerName: customer?.name || customer?.email || "",
        appointmentDate: saved.date,
        appointmentType: saved.appointmentType,
        time: saved.time,
        status: saved.status,
      },
    });

    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get available time slots for a specific date
router.get("/available-slots/:date", auth, authorize("user"), async (req, res) => {
  try {
    const { date } = req.params;
    const closure = await getDateClosureInfo(date);
    const slots = closure
      ? []
      : await getAvailableTimeSlots(date, req.query.excludeAppointmentId || null);
    res.json({ slots, closure });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/my", auth, authorize("user"), async (req, res) => {
  const list = await Appointment.find({ 
    customer: req.user.id, 
    isArchived: { $ne: true }
  })
    .populate("vehicle")
    .populate("staffMember", "name email")
    .sort({ createdAt: -1 });
  res.json(list);
});

router.put("/:id", auth, authorize("user"), async (req, res) => {
  const { id } = req.params;
  if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid appointment ID" });

  const { date, time } = req.body;
  if (!date || !time) return res.status(400).json({ message: "Date and time required" });

  const appt = await Appointment.findOne({ _id: id, customer: req.user.id, isArchived: { $ne: true } });
  if (!appt) return res.status(404).json({ message: "Appointment not found" });

  if (appt.status !== "scheduled") return res.status(400).json({ message: "Only scheduled appointments can be edited" });

  // Validate new date and time
  const {
    validateAppointmentDetails,
    getAvailableStaff
  } = require("../utils/appointmentValidation");

  const errors = await validateAppointmentDetails(date, time, appt.staffMember, appt._id);
  if (errors.length > 0) {
    return res.status(400).json({ message: errors[0], errors });
  }

  const previousValues = {
    date: appt.date,
    time: appt.time,
  };

  appt.date = new Date(date);
  appt.time = time;
  await appt.save();

  const customer = await User.findById(req.user.id).select("name email role");
  const hydratedAppointment = await Appointment.findById(appt._id)
    .populate("vehicle")
    .populate("staffMember", "name email role");
  await logActivity({
    actionType: "UPDATE",
    entityType: "APPOINTMENT",
    userId: req.user.id,
    userName: customer?.name || customer?.email || "Customer",
    userRole: customer?.role || req.user.role,
    title: "Customer Test Drive Updated",
    description: `${customer?.name || customer?.email || "A customer"} updated a test drive appointment`,
    entityId: appt._id,
    changes: {
      date: { from: previousValues.date, to: appt.date },
      time: { from: previousValues.time, to: appt.time },
    },
    metadata: {
      customer: req.user.id,
      vehicle: appt.vehicle,
      staffMember: appt.staffMember,
      vehicleName: formatVehicleLabel(hydratedAppointment?.vehicle),
      staffName: hydratedAppointment?.staffMember?.name || "",
      customerName: customer?.name || customer?.email || "",
      appointmentDate: appt.date,
      appointmentType: appt.appointmentType,
      time: appt.time,
      status: appt.status,
    },
  });

  res.json({ message: "Updated", appointment: appt });
});

router.delete("/:id", auth, authorize("user"), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log(`[DELETE] Attempting to delete appointment: ${id} for user: ${userId}`);
    
    if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid appointment ID" });

    // First check if appointment exists at all
    const appointmentExists = await Appointment.findById(id);
    if (!appointmentExists) {
      console.log(`[DELETE] Appointment not found with ID: ${id}`);
      return res.status(404).json({ message: "Appointment not found" });
    }

    console.log(`[DELETE] Found appointment. Customer: ${appointmentExists.customer}, User: ${userId}, Match: ${appointmentExists.customer?.toString() === userId}`);

    // Check if it belongs to this customer
    if (appointmentExists.customer?.toString() !== userId) {
      console.log(`[DELETE] Customer mismatch - Access denied`);
      return res.status(403).json({ message: "You do not have permission to delete this appointment" });
    }

    // Check if already archived
    if (appointmentExists.isArchived) {
      console.log(`[DELETE] Appointment already archived`);
      return res.status(404).json({ message: "Appointment already cancelled" });
    }

    if (appointmentExists.status !== "scheduled") {
      return res.status(400).json({ 
        message: `Cannot cancel appointment with status: ${appointmentExists.status}. Only scheduled appointments can be cancelled.` 
      });
    }

    // Soft delete - mark as archived and status as cancelled
    appointmentExists.isArchived = true;
    appointmentExists.status = "cancelled";
    await appointmentExists.save();

    const customer = await User.findById(req.user.id).select("name email role");
    const hydratedAppointment = await Appointment.findById(appointmentExists._id)
      .populate("vehicle")
      .populate("staffMember", "name email role");
    await logActivity({
      actionType: "DELETE",
      entityType: "APPOINTMENT",
      userId: req.user.id,
      userName: customer?.name || customer?.email || "Customer",
      userRole: customer?.role || req.user.role,
      title: "Customer Test Drive Cancelled",
      description: `${customer?.name || customer?.email || "A customer"} cancelled a test drive appointment`,
      entityId: appointmentExists._id,
      metadata: {
        customer: req.user.id,
        vehicle: appointmentExists.vehicle,
        staffMember: appointmentExists.staffMember,
        vehicleName: formatVehicleLabel(hydratedAppointment?.vehicle),
        staffName: hydratedAppointment?.staffMember?.name || "",
        customerName: customer?.name || customer?.email || "",
        appointmentDate: appointmentExists.date,
        appointmentType: appointmentExists.appointmentType,
        time: appointmentExists.time,
        status: appointmentExists.status,
      },
    });

    console.log(`[DELETE] Successfully cancelled appointment: ${id}`);
    res.json({ message: "Appointment cancelled successfully" });
  } catch (err) {
    console.error("Delete appointment error:", err);
    res.status(500).json({ message: err.message || "Error cancelling appointment" });
  }
});

module.exports = router;
