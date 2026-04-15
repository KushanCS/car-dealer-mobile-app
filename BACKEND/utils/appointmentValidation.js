const Holiday = require("../models/Holiday");
const Event = require("../models/Event");
const Appointment = require("../models/Appointment");
const User = require("../models/User");

// Working hours: 9:00 AM to 5:00 PM
const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17; // 5 PM
const WORK_END_MINUTE = 0;
const APPOINTMENT_DURATION = 60; // minutes

const buildAppointmentDateTime = (dateStr, timeStr = "00:00") => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return null;
  if (!/^\d{2}:\d{2}$/.test(String(timeStr || ""))) return null;
  return new Date(`${dateStr}T${timeStr}:00`);
};

const buildDayRange = (dateStr) => {
  const appointmentDate = new Date(dateStr);
  const dayStart = new Date(appointmentDate);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(appointmentDate);
  dayEnd.setHours(23, 59, 59, 999);

  return { dayStart, dayEnd };
};

const isSameCalendarDate = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

// Check if date is today or in the future
const isTodayOrFutureDate = (dateStr) => {
  const appointmentDate = buildAppointmentDateTime(dateStr);
  if (!appointmentDate || Number.isNaN(appointmentDate.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return appointmentDate >= today;
};

// Check if time is within working hours (9:00 AM to 5:00 PM, 1-hour slots)
const isWorkingHours = (timeStr) => {
  if (!/^\d{2}:\d{2}$/.test(timeStr || "")) return false;
  const [hours, minutes] = timeStr.split(":").map(Number);

  // 8 one-hour sessions: 09:00 through 16:00, ending at 17:00.
  if (minutes !== 0) return false;
  return hours >= WORK_START_HOUR && hours < WORK_END_HOUR;
};

// Check if date is a holiday (Poya day or other holiday)
const isHoliday = async (dateStr) => {
  const { dayStart, dayEnd } = buildDayRange(dateStr);

  const holiday = await Holiday.findOne({
    date: { $gte: dayStart, $lte: dayEnd }
  });

  return !!holiday;
};

const getHolidayClosure = async (dateStr) => {
  const { dayStart, dayEnd } = buildDayRange(dateStr);
  return Holiday.findOne({
    date: { $gte: dayStart, $lte: dayEnd }
  });
};

const getShopClosureEvent = async (dateStr) => {
  const { dayStart, dayEnd } = buildDayRange(dateStr);
  return Event.findOne({
    isShopClosed: true,
    startDate: { $lte: dayEnd },
    endDate: { $gte: dayStart }
  }).sort({ startDate: 1, createdAt: 1 });
};

const getDateClosureInfo = async (dateStr) => {
  const event = await getShopClosureEvent(dateStr);
  if (event) {
    const trimmedDescription = String(event.description || "").trim();
    const reason = trimmedDescription || event.name;

    return {
      type: "event",
      name: event.name,
      reason,
      description: trimmedDescription,
      isShopClosed: true,
      startDate: event.startDate,
      endDate: event.endDate,
      message: trimmedDescription
        ? `Shop is closed on this date for ${event.name}: ${trimmedDescription}`
        : `Shop is closed on this date for ${event.name}.`,
    };
  }

  const holiday = await getHolidayClosure(dateStr);
  if (holiday) {
    const trimmedDescription = String(holiday.description || "").trim();
    const reason = trimmedDescription || holiday.name;

    return {
      type: "holiday",
      name: holiday.name,
      reason,
      description: trimmedDescription,
      isShopClosed: true,
      message: trimmedDescription
        ? `Shop is closed on this date for ${holiday.name}: ${trimmedDescription}`
        : `Shop is closed on this date for ${holiday.name}.`,
    };
  }

  return null;
};

// Get available staff members for a given date and time
const getAvailableStaff = async (dateStr, timeStr, excludeAppointmentId = null) => {
  const allStaff = await User.find({
    role: "staff",
    isDeleted: false
  });

  const filter = {
    status: { $ne: "cancelled" },
    isArchived: { $ne: true },
    date: {
      $gte: new Date(dateStr + "T00:00:00"),
      $lt: new Date(dateStr + "T23:59:59")
    },
    time: timeStr,
    staffMember: { $exists: true }
  };

  if (excludeAppointmentId) {
    filter._id = { $ne: excludeAppointmentId };
  }

  const overlappingAppointments = await Appointment.find(filter);

  // Get staff IDs that are already booked at this time
  const bookedStaffIds = overlappingAppointments.map(a => a.staffMember.toString());

  // Return available staff
  const availableStaff = allStaff.filter(
    staff => !bookedStaffIds.includes(staff._id.toString())
  );

  return availableStaff;
};

// Check if specific staff member is available
const isStaffAvailable = async (staffId, dateStr, timeStr, excludeAppointmentId = null) => {
  const availableStaff = await getAvailableStaff(dateStr, timeStr, excludeAppointmentId);
  return availableStaff.some(staff => staff._id.toString() === staffId.toString());
};

// Validate appointment details
const validateAppointmentDetails = async (dateStr, timeStr, staffId = null, excludeAppointmentId = null) => {
  const errors = [];
  const appointmentDateTime = buildAppointmentDateTime(dateStr, timeStr);
  const now = new Date();

  if (!isTodayOrFutureDate(dateStr)) {
    errors.push("Appointment date cannot be in the past");
  }

  if (!appointmentDateTime || Number.isNaN(appointmentDateTime.getTime())) {
    errors.push("Appointment date or time is invalid");
  } else if (appointmentDateTime <= now) {
    errors.push("Appointment must be in the future");
  }

  // Check working hours
  if (!isWorkingHours(timeStr)) {
    errors.push("Appointments are available from 9:00 AM to 5:00 PM in 1-hour sessions");
  }

  const closure = await getDateClosureInfo(dateStr);
  if (closure) {
    errors.push(closure.message);
  }

  // If staff ID provided, check availability
  if (staffId) {
    const available = await isStaffAvailable(staffId, dateStr, timeStr, excludeAppointmentId);
    if (!available) {
      errors.push("Selected staff member is not available at this time");
    }
  }

  return errors;
};

// Get available time slots for a specific date
const getAvailableTimeSlots = async (dateStr, excludeAppointmentId = null) => {
  if (!isTodayOrFutureDate(dateStr)) {
    return [];
  }

  const closure = await getDateClosureInfo(dateStr);
  if (closure) {
    return [];
  }

  const slots = [];
  const now = new Date();
  const requestedDate = buildAppointmentDateTime(dateStr);
  const isToday = requestedDate ? isSameCalendarDate(requestedDate, now) : false;
  
  // Generate hourly slots from 9:00 AM to 4:00 PM.
  for (let hour = WORK_START_HOUR; hour <= 16; hour++) {
    const timeStr = `${String(hour).padStart(2, "0")}:00`;
    const slotDateTime = buildAppointmentDateTime(dateStr, timeStr);

    if (!slotDateTime || (isToday && slotDateTime <= now)) {
      continue;
    }
    
    const availableStaff = await getAvailableStaff(dateStr, timeStr, excludeAppointmentId);
    
    slots.push({
      time: timeStr,
      availableStaffCount: availableStaff.length,
      availableStaff: availableStaff.map(s => ({ id: s._id, name: s.name }))
    });
  }

  return slots;
};

module.exports = {
  isTodayOrFutureDate,
  isWorkingHours,
  isHoliday,
  getDateClosureInfo,
  buildAppointmentDateTime,
  getAvailableStaff,
  isStaffAvailable,
  validateAppointmentDetails,
  getAvailableTimeSlots,
  WORK_START_HOUR,
  WORK_END_HOUR,
  WORK_END_MINUTE,
  APPOINTMENT_DURATION
};
