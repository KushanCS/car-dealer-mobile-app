const mongoose = require("mongoose");
const {
    isValidEmailAddress,
    isValidPhoneNumber,
    normalizeEmail,
    normalizePhoneNumber,
} = require("../utils/inputValidation");

const LeadSchema = new mongoose.Schema({
    name: { type: String, required: [true, "Name is required"] },
    contact_number: { 
        type: String, 
        required: [true, "Contact number is required"], 
        set: normalizePhoneNumber,
        validate: {
            validator: isValidPhoneNumber,
            message: "Contact number must contain exactly 10 digits",
        }
    },
    email: { 
        type: String, 
        required: [true, "Email is required"], 
        lowercase: true,
        trim: true,
        set: normalizeEmail,
        validate: {
            validator: isValidEmailAddress,
            message: "Please enter a valid email address with a real domain like gmail.com, yahoo.com, or outlook.com",
        }
    },
    lead_source: { type: String, required: [true, "Lead source is required"] },
    interest_level: { type: String, enum: ["low","medium","high"], default: "medium" },
    status: { type: String, enum: ["new","contacted","converted","lost"], default: "new" }
}, { timestamps: true });

LeadSchema.index({ email: 1 });
LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ interest_level: 1, createdAt: -1 });
LeadSchema.index({ contact_number: 1 });

module.exports = mongoose.model("Lead", LeadSchema);
