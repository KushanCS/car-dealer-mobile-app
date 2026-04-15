// models/Vehicle.js
const mongoose = require("mongoose");

const currentYear = new Date().getFullYear();
const VEHICLE_CONDITIONS = ["Brand New", "Used (Registered)", "Reconditioned", ""];

const VehicleSchema = new mongoose.Schema(
  {
    brand: { type: String, required: true, trim: true },

    model: { type: String, default: "", trim: true },

    type: {
      type: String,
      enum: ["SUV", "Sedan", "Hatchback", "Truck", "Van", "Coupe"],
      required: true,
    },

    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "Hybrid", "Electric", "Other", ""],
      default: "",
      trim: true,
    },

    transmission: {
      type: String,
      enum: ["Automatic", "Manual", ""],
      default: "",
      trim: true,
    },

    condition: {
      type: String,
      enum: VEHICLE_CONDITIONS,
      default: "",
      trim: true,
    },

    year: { type: Number, required: true, min: 1900, max: currentYear },

    mileage: { type: Number, min: 0, default: null },

    price: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["available", "reserved", "sold"],
      default: "available",
    },

    details: { type: String, default: "", trim: true },

    vehicleNumber: { type: String, default: "", trim: true },

    images: [
      {
        url: { type: String, required: true },
        filename: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

VehicleSchema.index({ status: 1, createdAt: -1 });
VehicleSchema.index({ type: 1, status: 1 });
VehicleSchema.index({ price: 1 });
VehicleSchema.index({ year: -1 });
VehicleSchema.index({ brand: 1, model: 1 });
VehicleSchema.index({ vehicleNumber: 1 });

// Validation without next()
VehicleSchema.pre("save", async function () {
  if ((this.images?.length || 0) > 4) {
    throw new Error("Maximum 4 images allowed");
  }
});

module.exports = mongoose.model("Vehicle", VehicleSchema);
