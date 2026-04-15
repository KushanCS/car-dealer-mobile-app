const mongoose = require("mongoose");

const PhysicalDocumentSchema = new mongoose.Schema(
  {
    docType: {
      type: String,
      enum: ["RC_BOOK", "INSURANCE", "TRANSFER_FORM", "EMISSION", "SERVICE_BOOK", "OTHER"],
      required: [true, "Document type is required"],
    },

    title: { type: String, required: [true, "Title is required"] },
    referenceNo: { type: String },

    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: false },

    status: {
      type: String,
      enum: ["AVAILABLE", "IN_USE", "MISSING", "ARCHIVED"],
      default: "AVAILABLE",
    },

    location: { type: String, required: [true, "Location is required"] },

    notes: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

PhysicalDocumentSchema.index({ status: 1, isArchived: 1, createdAt: -1 });
PhysicalDocumentSchema.index({ vehicle: 1, status: 1 });
PhysicalDocumentSchema.index({ referenceNo: 1 });

module.exports = mongoose.model("PhysicalDocument", PhysicalDocumentSchema);
