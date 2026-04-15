const router = require("express").Router();
const Appointment = require("../models/Appointment");
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

function formatAppointmentVehicle(vehicle) {
  if (!vehicle) return "";
  return [vehicle.brand, vehicle.type, vehicle.year ? `(${vehicle.year})` : ""].filter(Boolean).join(" ");
}

function buildAppointmentDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue || !/^\d{2}:\d{2}$/.test(String(timeValue))) return null;
  const appointmentDateTime = new Date(dateValue);
  const [hours, minutes] = String(timeValue).split(":").map(Number);
  appointmentDateTime.setHours(hours, minutes, 0, 0);
  return appointmentDateTime;
}

function buildAppointmentAccessFilter(req) {
  if (req.user.role === "admin") {
    return { isArchived: { $ne: true } };
  }

  return {
    isArchived: { $ne: true },
    $or: [
      { staffMember: req.user.id },
      { createdBy: req.user.id },
    ],
  };
}

router.post("/add", auth, authorize("staff", "admin"), async (req, res) => {
  try {
    const { date, time } = req.body;
    const errors = await validateAppointmentDetails(date, time);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const availableStaff = await getAvailableStaff(date, time);
    if (availableStaff.length === 0) {
      return res.status(400).json({
        message: "This session is fully booked. Please select another hour.",
        timeSlots: await getAvailableTimeSlots(date),
      });
    }

    const appointment = new Appointment({
      ...req.body,
      date: new Date(date),
      time,
      staffMember: req.body.staffMember || availableStaff[0]._id,
      createdBy: req.user.id,
    });
    const saved = await appointment.save();
    const detailed = await Appointment.findById(saved._id)
      .populate("lead")
      .populate("vehicle")
      .populate("customer", "name email")
      .populate("staffMember", "name email role");

    await logActivity({
      actionType: "CREATE",
      entityType: "APPOINTMENT",
      userId: req.user?._id || req.user?.id,
      userName: req.user?.name || req.user?.email || "Unknown",
      userRole: req.user?.role,
      title: "Appointment Created",
      description: `${detailed?.appointmentType || "viewing"} appointment booked for ${detailed?.staffMember?.name || "assigned staff"}`,
      entityId: saved._id,
      metadata: {
        status: saved.status,
        lead: saved.lead,
        vehicle: saved.vehicle,
        staffMember: saved.staffMember,
        appointmentDate: saved.date || saved.appointmentDate,
        appointmentType: detailed?.appointmentType || saved.appointmentType,
        time: detailed?.time || saved.time,
        staffName: detailed?.staffMember?.name || "",
        customerName: detailed?.customer?.name || detailed?.lead?.name || "",
        vehicleName: formatAppointmentVehicle(detailed?.vehicle),
      },
    });

    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/available-slots/:date", auth, authorize("staff", "admin"), async (req, res) => {
  try {
    const closure = await getDateClosureInfo(req.params.date);
    const slots = closure
      ? []
      : await getAvailableTimeSlots(req.params.date, req.query.excludeAppointmentId || null);
    res.json({ slots, closure });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/", auth, authorize("staff", "admin"), async (req, res) => {
  try {
    const list = await Appointment.find(buildAppointmentAccessFilter(req))
      .populate("lead")
      .populate("vehicle")
      .populate("customer", "name email")
      .populate("staffMember", "name email role")
      .populate("createdBy", "name email")
      .sort({ date: 1, time: 1, createdAt: -1 });

    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", auth, authorize("staff", "admin"), async (req, res) => {
  if (!validateObjectId(req.params.id)) return res.status(400).json({ message: "Invalid appointment ID" });

  const a = await Appointment.findOne({ _id: req.params.id, ...buildAppointmentAccessFilter(req) })
    .populate("lead")
    .populate("vehicle")
    .populate("customer", "name email")
    .populate("staffMember", "name email role")
    .populate("createdBy", "name email");

  if (!a) return res.status(404).json({ message: "Appointment not found" });
  res.json(a);
});

router.put("/:id", auth, authorize("staff", "admin"), async (req, res) => {
  if (!validateObjectId(req.params.id)) return res.status(400).json({ message: "Invalid appointment ID" });

  try {
    const existing = await Appointment.findOne({ _id: req.params.id, ...buildAppointmentAccessFilter(req) });
    if (!existing) return res.status(404).json({ message: "Appointment not found" });

    const nextDate = req.body.date ?? existing.date;
    const nextTime = req.body.time ?? existing.time;
    const nextStaffMember = req.body.staffMember || existing.staffMember || null;
    const errors = await validateAppointmentDetails(nextDate, nextTime, nextStaffMember, existing._id);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    let assignedStaffMember = nextStaffMember;
    if (!assignedStaffMember) {
      const availableStaff = await getAvailableStaff(nextDate, nextTime, existing._id);
      if (availableStaff.length === 0) {
        return res.status(400).json({
          message: "This session is fully booked. Please select another hour.",
          timeSlots: await getAvailableTimeSlots(nextDate, existing._id),
        });
      }
      assignedStaffMember = availableStaff[0]._id;
    }

    const updated = await Appointment.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        date: new Date(nextDate),
        time: nextTime,
        staffMember: assignedStaffMember,
      },
      { new: true, runValidators: true }
    );
    const detailed = await Appointment.findById(updated._id)
      .populate("lead")
      .populate("vehicle")
      .populate("customer", "name email")
      .populate("staffMember", "name email role");

    const changes = {};
    if (existing.status !== updated.status) changes.status = { from: existing.status, to: updated.status };
    if (String(existing.staffMember || "") !== String(updated.staffMember || "")) changes.staffMember = "updated";
    if (String(existing.vehicle || "") !== String(updated.vehicle || "")) changes.vehicle = "updated";
    if (String(existing.lead || "") !== String(updated.lead || "")) changes.lead = "updated";
    if (String(existing.customer || "") !== String(updated.customer || "")) changes.customer = "updated";
    if (String(existing.date || existing.appointmentDate || "") !== String(updated.date || updated.appointmentDate || "")) {
      changes.date = { from: existing.date || existing.appointmentDate || null, to: updated.date || updated.appointmentDate || null };
    }

    if (Object.keys(changes).length > 0) {
      await logActivity({
        actionType: "UPDATE",
        entityType: "APPOINTMENT",
        userId: req.user?._id || req.user?.id,
        userName: req.user?.name || req.user?.email || "Unknown",
        userRole: req.user?.role,
        title: "Appointment Updated",
        description: `Appointment updated for ${detailed?.customer?.name || detailed?.lead?.name || "customer"}`,
        entityId: updated._id,
        changes,
        metadata: {
          status: updated.status,
          lead: updated.lead,
          vehicle: updated.vehicle,
          staffMember: updated.staffMember,
          appointmentDate: updated.date || updated.appointmentDate,
          appointmentType: detailed?.appointmentType || updated.appointmentType,
          time: detailed?.time || updated.time,
          staffName: detailed?.staffMember?.name || "",
          customerName: detailed?.customer?.name || detailed?.lead?.name || "",
          vehicleName: formatAppointmentVehicle(detailed?.vehicle),
        },
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id/complete", auth, authorize("staff", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid appointment ID" });

    const appointment = await Appointment.findOne({ _id: id, ...buildAppointmentAccessFilter(req) });
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    if (appointment.status === "completed") {
      return res.status(400).json({ message: "Appointment is already completed" });
    }

    if (appointment.status === "cancelled") {
      return res.status(400).json({ message: "Cancelled appointments cannot be marked as completed" });
    }

    const appointmentDateTime = buildAppointmentDateTime(appointment.date, appointment.time);
    if (!appointmentDateTime) {
      return res.status(400).json({ message: "Appointment date or time is invalid" });
    }

    appointment.status = "completed";
    await appointment.save();

    await logActivity({
      actionType: "UPDATE",
      entityType: "APPOINTMENT",
      userId: req.user?._id || req.user?.id,
      userName: req.user?.name || req.user?.email || "Unknown",
      userRole: req.user?.role,
      title: "Appointment Completed",
      description: "An appointment was marked as completed",
      entityId: appointment._id,
      changes: {
        status: { from: "scheduled", to: "completed" },
      },
      metadata: {
        status: appointment.status,
        lead: appointment.lead,
        vehicle: appointment.vehicle,
        staffMember: appointment.staffMember,
        appointmentDate: appointment.date,
        time: appointment.time,
        appointmentType: appointment.appointmentType,
      },
    });

    res.json({ message: "Appointment marked as completed", appointment });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to complete appointment" });
  }
});

router.delete("/:id", auth, authorize("admin", "staff"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid appointment id" });

    const deleted = await Appointment.findOneAndDelete({ _id: id, ...buildAppointmentAccessFilter(req) });
    if (!deleted) return res.status(404).json({ message: "Appointment not found" });

    await logActivity({
      actionType: "DELETE",
      entityType: "APPOINTMENT",
      userId: req.user?._id || req.user?.id,
      userName: req.user?.name || req.user?.email || "Unknown",
      userRole: req.user?.role,
      title: "Appointment Deleted",
      description: "An appointment was deleted",
      entityId: deleted._id,
      metadata: {
        status: deleted.status,
        lead: deleted.lead,
        vehicle: deleted.vehicle,
        staffMember: deleted.staffMember,
        appointmentDate: deleted.date || deleted.appointmentDate,
        appointmentType: deleted.appointmentType,
        time: deleted.time,
      },
    });

    res.json({ message: "Appointment deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;
