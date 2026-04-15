const mongoose = require("mongoose");

const SaleSchema = new mongoose.Schema(
  {
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", required: true },
    price: { type: Number, required: true, min: 0 },
    paid_amount: { type: Number, default: 0, min: 0 },
    pending_amount: { type: Number, default: 0, min: 0 },
    payment_status: {
      type: String,
      enum: ["pending", "partial", "completed"],
      default: "pending",
    },
    payment_method: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque", "other", ""],
      default: "",
    },
    payment_reference: { type: String, trim: true, default: "" },
    bank_name: { type: String, trim: true, default: "" },
    cheque_number: { type: String, trim: true, default: "" },
    payment_date: { type: Date, default: null },
    payment_details: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

SaleSchema.index({ createdAt: -1 });
SaleSchema.index({ vehicle: 1 });
SaleSchema.index({ customer: 1 });
SaleSchema.index({ payment_status: 1, createdAt: -1 });

module.exports = mongoose.model("Sale", SaleSchema);
