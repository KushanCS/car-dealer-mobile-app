const nodemailer = require("nodemailer");
require("dotenv").config();

// Create email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error("Email transporter error:", error);
  } else {
    console.log("Email transporter ready! SMTP connection established.");
  }
});

/**
 * Send appointment reminder email
 * @param {string} recipientEmail - Email address of the recipient
 * @param {string} recipientName - Name of the recipient
 * @param {object} appointmentDetails - Appointment details { date, time, appointmentType, vehicleDetails }
 */
const formatVehicleLabel = (vehicleDetails = {}) => {
  const brand = vehicleDetails.brand || vehicleDetails.make || "";
  const model = vehicleDetails.modelName || vehicleDetails.model || "";
  const type = vehicleDetails.type || "";
  const year = vehicleDetails.year ? `(${vehicleDetails.year})` : "";

  return [brand, model || type, year].filter(Boolean).join(" ").trim();
};

const sendAppointmentReminder = async (recipientEmail, recipientName, appointmentDetails, options = {}) => {
  try {
    const { date, time, appointmentType, vehicleDetails } = appointmentDetails;
    const { recipientRole = "customer" } = options;

    // Format the appointment date and time
    const appointmentDate = new Date(date);
    const formattedDate = appointmentDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const appointmentTypeLabel = {
      viewing: "Vehicle Viewing",
      test_drive: "Test Drive",
      follow_up: "Follow-up Meeting",
    }[appointmentType] || "Appointment";

    const heading = recipientRole === "staff" ? "Upcoming Appointment Assigned" : "Upcoming Appointment Reminder";
    const intro =
      recipientRole === "staff"
        ? "This is a reminder that you have an upcoming customer appointment assigned within the next hour."
        : "This is a friendly reminder about your upcoming appointment with us.";
    const actionNotes =
      recipientRole === "staff"
        ? [
            "Please be ready a few minutes before the booked time",
            "Review the vehicle and booking details before the customer arrives",
            "Prepare any documents or keys needed for the session",
          ]
        : [
            "Please arrive 5-10 minutes early",
            "Bring a valid ID",
            "Our team will be ready to assist you",
          ];
    const vehicleLabel = formatVehicleLabel(vehicleDetails) || "Vehicle details will be shared by the team";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #edf1f3;
              color: #1f2937;
              margin: 0;
              padding: 24px 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 20px;
              overflow: hidden;
              box-shadow: 0 20px 48px rgba(12, 58, 87, 0.12);
            }
            .header {
              background: linear-gradient(135deg, #0c3a57 0%, #11496d 60%, #8DBB01 100%);
              color: white;
              padding: 28px 32px;
            }
            .content {
              padding: 28px 32px 32px;
            }
            .appointment-details {
              background: #f7faf8;
              border: 1px solid rgba(12, 58, 87, 0.08);
              padding: 18px;
              border-radius: 16px;
              margin: 20px 0;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              gap: 16px;
              margin: 12px 0;
            }
            .detail-label {
              font-weight: 700;
              color: #49606f;
              text-transform: uppercase;
              font-size: 12px;
              letter-spacing: 0.08em;
            }
            .detail-value {
              color: #12202b;
              font-weight: 700;
              text-align: right;
            }
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #9ca3af;
              font-size: 12px;
            }
            .button {
              display: inline-block;
              background: #8DBB01;
              color: white;
              padding: 12px 22px;
              border-radius: 999px;
              text-decoration: none;
              margin-top: 15px;
              font-weight: 700;
            }
            .eyebrow {
              font-size: 11px;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              opacity: 0.78;
              margin-bottom: 10px;
            }
            .header h2 {
              margin: 0;
              font-size: 28px;
              line-height: 1.15;
            }
            .panel-note {
              background: rgba(141, 187, 1, 0.1);
              border: 1px solid rgba(141, 187, 1, 0.24);
              color: #27410c;
              padding: 14px 16px;
              border-radius: 14px;
              margin-top: 18px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="eyebrow">Leaf Lanka Appointment Desk</div>
              <h2>${heading}</h2>
            </div>
            <div class="content">
              <p>Hi ${recipientName},</p>
              <p>${intro}</p>
              
              <div class="appointment-details">
                <h3 style="margin-top: 0; margin-bottom: 12px; color: #0c3a57;">Appointment Summary</h3>
                <div class="detail-row">
                  <span class="detail-label">Type:</span>
                  <span class="detail-value">${appointmentTypeLabel}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span class="detail-value">${formattedDate}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time:</span>
                  <span class="detail-value">${time}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Vehicle:</span>
                  <span class="detail-value">${vehicleLabel}</span>
                </div>
              </div>

              <p><strong>${recipientRole === "staff" ? "Before the appointment:" : "What to expect:"}</strong></p>
              <ul>
                ${actionNotes.map((item) => `<li>${item}</li>`).join("")}
              </ul>

              <div class="panel-note">
                ${
                  recipientRole === "staff"
                    ? "If the appointment changes, please review the appointment panel for the latest details."
                    : "If you need to reschedule or cancel, please let us know as soon as possible."
                }
              </div>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}" class="button">Visit Our Website</a>
              </div>

              <div class="footer">
                <p>This is an automated message, please do not reply to this email.</p>
                <p>&copy; 2024 Leaf Lanka AutoPulse. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: `${appointmentTypeLabel} Reminder - ${formattedDate}`,
      html: htmlContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${recipientEmail}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send email with custom HTML
 * @param {string} recipientEmail - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML content
 */
const sendEmail = async (recipientEmail, subject, htmlContent) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: subject,
      html: htmlContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${recipientEmail}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset OTP email
 * @param {string} recipientEmail - Email address of the recipient
 * @param {string} recipientName - Name of the recipient
 * @param {string} otp - One-time password
 */
const sendResetOtpEmail = async (recipientEmail, recipientName, otp) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background-color: #ffffff;
              border-radius: 8px;
              padding: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #0c3a57, #154f73);
              color: white;
              padding: 20px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .content {
              padding: 20px 0;
            }
            .reset-details {
              background-color: #f3f4f6;
              padding: 15px;
              border-radius: 5px;
              margin: 15px 0;
            }
            .footer {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #9ca3af;
              font-size: 12px;
            }
            .otp-code {
              margin: 18px auto;
              width: fit-content;
              padding: 14px 22px;
              border-radius: 14px;
              background: #f7faef;
              border: 1px solid rgba(141, 187, 1, 0.35);
              color: #0c3a57;
              font-size: 28px;
              letter-spacing: 8px;
              font-weight: 700;
            }
            .warning {
              color: #d32f2f;
              font-size: 12px;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Password Reset OTP</h2>
            </div>
            <div class="content">
              <p>Hi ${recipientName},</p>
              <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
              
              <div class="reset-details">
                <h3 style="margin-top: 0;">Reset Your Password</h3>
                <p>Use the temporary OTP below on the reset password screen. This code expires in 10 minutes.</p>
                <div class="otp-code">${otp}</div>
                <p style="margin-bottom: 0; color: #4b5563;">Enter the email address you used for your account together with this OTP to set a new password.</p>
              </div>

              <p><strong>For your security:</strong></p>
              <ul>
                <li>Never share this OTP with anyone</li>
                <li>Use a strong password with uppercase, lowercase, numbers, and symbols</li>
                <li>Request a new OTP if this code expires</li>
              </ul>

              <div class="footer">
                <p>This is an automated message, please do not reply to this email.</p>
                <p>&copy; 2024 Leaf Lanka. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: "Your Password Reset OTP - Leaf Lanka",
      html: htmlContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(
      `✅ Password reset OTP email sent to ${recipientEmail}. Message ID: ${result.messageId}. Response: ${result.response}`
    );
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("❌ Error sending password reset OTP email:", error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendAppointmentReminder, sendEmail, sendResetOtpEmail, transporter };
