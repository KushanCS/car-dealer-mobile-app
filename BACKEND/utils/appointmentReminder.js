const cron = require("node-cron");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const Lead = require("../models/Lead");
const Vehicle = require("../models/Vehicle");
const { sendAppointmentReminder } = require("./emailService");

const buildAppointmentDateTime = (dateValue, timeValue) => {
  if (!dateValue || !timeValue || !/^\d{2}:\d{2}$/.test(String(timeValue))) return null;

  const baseDate = new Date(dateValue);
  if (Number.isNaN(baseDate.getTime())) return null;

  const [hours, minutes] = String(timeValue).split(":").map(Number);
  const appointmentDateTime = new Date(baseDate);
  appointmentDateTime.setHours(hours, minutes, 0, 0);
  return appointmentDateTime;
};

const getVehicleDetails = (vehicle) => {
  if (!vehicle) return null;

  return {
    brand: vehicle.brand,
    modelName: vehicle.model,
    type: vehicle.type,
    year: vehicle.year,
  };
};

const archivePastAppointments = async (now) => {
  const activeAppointments = await Appointment.find({
    isArchived: { $ne: true },
    status: { $in: ["scheduled", "completed", "cancelled"] },
    date: { $lte: now },
  }).select("_id date time status");

  const expiredIds = activeAppointments
    .filter((appointment) => {
      const appointmentDateTime = buildAppointmentDateTime(appointment.date, appointment.time);
      if (!appointmentDateTime) return false;
      const appointmentEndTime = new Date(appointmentDateTime.getTime() + 60 * 60 * 1000);
      return appointmentEndTime <= now;
    })
    .map((appointment) => appointment._id);

  if (expiredIds.length === 0) return 0;

  const result = await Appointment.updateMany(
    { _id: { $in: expiredIds } },
    { $set: { isArchived: true } }
  );

  return result.modifiedCount || 0;
};

/**
 * Start appointment reminder scheduler
 * Runs every minute to check for appointments in the next 1 hour
 */
const startAppointmentReminder = () => {
  // Run every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const archivedCount = await archivePastAppointments(now);
      if (archivedCount > 0) {
        console.log(`🧹 Archived ${archivedCount} past appointment(s) from active views.`);
      }

      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const searchWindowEnd = new Date(oneHourLater);
      searchWindowEnd.setHours(23, 59, 59, 999);

      const appointments = await Appointment.find({
        status: "scheduled",
        isArchived: { $ne: true },
        date: { $gte: dayStart, $lte: searchWindowEnd },
      })
        .populate("customer")
        .populate("lead")
        .populate("vehicle")
        .populate("staffMember")
        .populate("createdBy");

      const upcomingAppointments = appointments.filter((appointment) => {
        const appointmentDateTime = buildAppointmentDateTime(appointment.date, appointment.time);
        if (!appointmentDateTime) return false;
        return appointmentDateTime >= now && appointmentDateTime <= oneHourLater;
      });

      if (upcomingAppointments.length === 0) return;

      console.log(
        `📧 Found ${upcomingAppointments.length} appointment(s) due for reminder emails...`
      );

      for (const appointment of upcomingAppointments) {
        try {
          const appointmentDateTime = buildAppointmentDateTime(appointment.date, appointment.time);
          if (!appointmentDateTime) {
            console.warn(`⚠️ Invalid appointment date/time for reminder ${appointment._id}`);
            continue;
          }

          const appointmentDetails = {
            date: appointmentDateTime,
            time: appointment.time,
            appointmentType: appointment.appointmentType,
            vehicleDetails: getVehicleDetails(appointment.vehicle),
          };

          let appointmentChanged = false;
          const notifiedEmails = new Set();

          const customerRecipient = appointment.customer
            ? {
                email: appointment.customer.email,
                name: appointment.customer.name,
              }
            : appointment.lead
              ? {
                  email: appointment.lead.email,
                  name: appointment.lead.name,
                }
              : null;

          if (customerRecipient?.email && !appointment.customerReminderSentAt) {
            const customerEmailResult = await sendAppointmentReminder(
              customerRecipient.email,
              customerRecipient.name || "Customer",
              appointmentDetails,
              { recipientRole: "customer" }
            );

            if (customerEmailResult.success) {
              appointment.customerReminderSentAt = new Date();
              appointment.emailSent = true;
              appointment.emailSentAt = appointment.customerReminderSentAt;
              appointmentChanged = true;
              notifiedEmails.add(String(customerRecipient.email).toLowerCase());
              console.log(`✅ Customer reminder sent to ${customerRecipient.email}`);
            } else {
              console.error(`❌ Failed to send customer reminder to ${customerRecipient.email}:`, customerEmailResult.error);
            }
          }

          const staffRecipient = appointment.staffMember?.email
            ? {
                email: appointment.staffMember.email,
                name: appointment.staffMember.name,
              }
            : null;

          const normalizedStaffEmail = staffRecipient?.email ? String(staffRecipient.email).toLowerCase() : "";

          if (
            staffRecipient?.email &&
            !appointment.staffReminderSentAt &&
            !notifiedEmails.has(normalizedStaffEmail)
          ) {
            const staffEmailResult = await sendAppointmentReminder(
              staffRecipient.email,
              staffRecipient.name || "Staff Member",
              appointmentDetails,
              { recipientRole: "staff" }
            );

            if (staffEmailResult.success) {
              appointment.staffReminderSentAt = new Date();
              appointmentChanged = true;
              notifiedEmails.add(normalizedStaffEmail);
              console.log(`✅ Staff reminder sent to ${staffRecipient.email}`);
            } else {
              console.error(`❌ Failed to send staff reminder to ${staffRecipient.email}:`, staffEmailResult.error);
            }
          } else if (staffRecipient?.email && !appointment.staffReminderSentAt && notifiedEmails.has(normalizedStaffEmail)) {
            appointment.staffReminderSentAt = new Date();
            appointmentChanged = true;
            console.log(`ℹ️ Skipped duplicate staff reminder for ${staffRecipient.email} because this address already received a reminder for the appointment.`);
          }

          if (appointmentChanged) {
            await appointment.save();
          }
        } catch (error) {
          console.error("Error processing appointment:", error);
        }
      }
    } catch (error) {
      console.error("Error in appointment reminder cron job:", error);
    }
  });

  console.log("✅ Appointment reminder scheduler started!");
};

module.exports = { startAppointmentReminder };
