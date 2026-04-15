const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, refPath: 'onModel', required: [true, "Recipient is required"] },
    onModel: { type: String, enum: ['Lead', 'User'], required: true },
    type: { type: String, enum: ['appointment','payment','general'], required: true },
    message: { type: String, required: [true, "Message is required"] },
    send_time: { type: Date, required: [true, "Send time is required"] },
    status: { type: String, enum: ["pending","sent"], default: "pending" }
}, { timestamps: true });

module.exports = mongoose.model("Notification", NotificationSchema);
