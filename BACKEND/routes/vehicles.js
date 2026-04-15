const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const Vehicle = require("../models/Vehicle");
const { logActivity } = require("../utils/activityLogger");

const authorize = require("../middleware/authorize");
const upload = require("../middleware/vehicleUpload");
const { validateObjectId } = require("../utils/validateObjectId");
const authMiddleware = require("../middleware/auth.middleware");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

async function saveVehicleImage(buffer) {
  const uploadDir = path.join(__dirname, "..", "uploads", "vehicles");
  ensureDir(uploadDir);

  const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`;
  const filepath = path.join(uploadDir, filename);

  await sharp(buffer)
    .resize(1200, 900, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(filepath);

  return { url: `/uploads/vehicles/${filename}`, filename };
}

// Helper function to build absolute image URLs
function buildAbsoluteImageUrls(vehicles, req) {
  const baseUrl = process.env.IMAGE_BASE_URL || `${req.protocol}://${req.get('host')}`;
  
  return vehicles.map(v => {
    const vehicleObj = v.toObject ? v.toObject() : v;
    if (vehicleObj.images && vehicleObj.images.length > 0) {
      vehicleObj.images = vehicleObj.images.map(img => ({
        ...img,
        url: img.url.startsWith('http') ? img.url : `${baseUrl}${img.url}`
      }));
    }
    return vehicleObj;
  });
}

// GET all
router.get("/", async (req, res) => {
  const {
    q,
    type,
    fuelType,
    transmission,
    status,
    minPrice,
    maxPrice,
    minYear,
    maxYear,
    maxMileage,
  } = req.query;

  const query = {};

  if (q?.trim()) {
    const search = q.trim();
    query.$or = [
      { brand: { $regex: search, $options: "i" } },
      { model: { $regex: search, $options: "i" } },
      { type: { $regex: search, $options: "i" } },
      { condition: { $regex: search, $options: "i" } },
      { fuelType: { $regex: search, $options: "i" } },
      { transmission: { $regex: search, $options: "i" } },
      { details: { $regex: search, $options: "i" } },
      { vehicleNumber: { $regex: search, $options: "i" } },
    ];
  }

  if (type?.trim()) query.type = type.trim();
  if (fuelType?.trim()) query.fuelType = fuelType.trim();
  if (transmission?.trim()) query.transmission = transmission.trim();
  if (status?.trim()) query.status = status.trim();

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  if (minYear || maxYear) {
    query.year = {};
    if (minYear) query.year.$gte = Number(minYear);
    if (maxYear) query.year.$lte = Number(maxYear);
  }

  if (maxMileage) {
    query.mileage = { $lte: Number(maxMileage) };
  }

  const vehicles = await Vehicle.find(query).sort({ createdAt: -1 });
  const vehiclesWithUrls = buildAbsoluteImageUrls(vehicles, req);
  res.json(vehiclesWithUrls);
});

// GET one
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid vehicle id" });

  const v = await Vehicle.findById(id);
  if (!v) return res.status(404).json({ message: "Vehicle not found" });

  const vehiclesWithUrls = buildAbsoluteImageUrls([v], req);
  res.json(vehiclesWithUrls[0]);
});

// CREATE
router.post(
  "/",
  authMiddleware,
  authorize("admin"),
  upload.array("images", 4),
  async (req, res) => {
    try {
      const files = req.files || [];
      const images = [];

      // Process uploaded files
      for (const f of files) {
        images.push(await saveVehicleImage(f.buffer));
      }

      // Delete images from req.body if it somehow got added as a string
      delete req.body.images;

      const vehicle = await Vehicle.create({
        brand: (req.body.brand || "").trim(),
        model: (req.body.model || "").trim(),
        type: req.body.type,
        condition: req.body.condition || "",
        fuelType: req.body.fuelType || "",
        transmission: req.body.transmission || "",
        year: Number(req.body.year),
        mileage: req.body.mileage ? Number(req.body.mileage) : null,
        price: Number(req.body.price),
        status: req.body.status || "available",
        vehicleNumber: (req.body.vehicleNumber || "").trim(),
        details: (req.body.details || "").trim(),
        images: images, // Use only the processed images from files
      });

      await logActivity({
        actionType: "CREATE",
        entityType: "VEHICLE",
        userId: req.user?._id || req.user?.id,
        userName: req.user?.name || req.user?.email || "Unknown",
        userRole: req.user?.role,
        title: `Vehicle Added: ${vehicle.brand} ${vehicle.type}`,
        description: `New ${vehicle.year} ${vehicle.brand} ${vehicle.type} added to inventory`,
        entityId: vehicle._id,
        metadata: {
          brand: vehicle.brand,
          model: vehicle.model,
          type: vehicle.type,
          condition: vehicle.condition,
          fuelType: vehicle.fuelType,
          transmission: vehicle.transmission,
          year: vehicle.year,
          mileage: vehicle.mileage,
          price: vehicle.price,
          status: vehicle.status,
        },
      });

      res.status(201).json(vehicle);
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to add vehicle" });
    }
  }
);

// UPDATE
router.put(
  "/:id",
  authMiddleware,
  authorize("admin"),
  upload.array("images", 4),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid vehicle id" });

      const vehicle = await Vehicle.findById(id);
      if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

      const previousValues = {
        brand: vehicle.brand,
        model: vehicle.model,
        type: vehicle.type,
        condition: vehicle.condition,
        fuelType: vehicle.fuelType,
        transmission: vehicle.transmission,
        year: vehicle.year,
        mileage: vehicle.mileage,
        price: vehicle.price,
        status: vehicle.status,
        vehicleNumber: vehicle.vehicleNumber,
        details: vehicle.details,
      };

      // Initialize images array if undefined
      if (!vehicle.images) {
        vehicle.images = [];
      }

      vehicle.brand = (req.body.brand ?? vehicle.brand).trim();
      vehicle.model = (req.body.model ?? vehicle.model).trim();
      vehicle.type = req.body.type ?? vehicle.type;
      vehicle.condition = req.body.condition ?? vehicle.condition;
      vehicle.fuelType = req.body.fuelType ?? vehicle.fuelType;
      vehicle.transmission = req.body.transmission ?? vehicle.transmission;
      vehicle.year = req.body.year ? Number(req.body.year) : vehicle.year;
      vehicle.mileage = req.body.mileage ? Number(req.body.mileage) : req.body.mileage === "" ? null : vehicle.mileage;
      vehicle.price = req.body.price ? Number(req.body.price) : vehicle.price;
      vehicle.status = req.body.status ?? vehicle.status;
      vehicle.vehicleNumber = (req.body.vehicleNumber ?? vehicle.vehicleNumber).trim();
      vehicle.details = (req.body.details ?? vehicle.details).trim();

      // Process new uploaded files
      const files = req.files || [];
      if (files.length) {
        const remaining = 4 - vehicle.images.length;
        if (remaining <= 0) return res.status(400).json({ message: "Max 4 images already uploaded" });

        for (const f of files.slice(0, remaining)) {
          vehicle.images.push(await saveVehicleImage(f.buffer));
        }
      }

      // Delete images from req.body if it somehow got added as a string
      delete req.body.images;

      if (vehicle.images.length > 4) {
        return res.status(400).json({ message: "Maximum 4 images allowed" });
      }

      await vehicle.save();

      const changes = {};
      if (previousValues.brand !== vehicle.brand) changes.brand = { from: previousValues.brand, to: vehicle.brand };
      if (previousValues.model !== vehicle.model) changes.model = { from: previousValues.model, to: vehicle.model };
      if (previousValues.type !== vehicle.type) changes.type = { from: previousValues.type, to: vehicle.type };
      if (previousValues.condition !== vehicle.condition) changes.condition = { from: previousValues.condition, to: vehicle.condition };
      if (previousValues.fuelType !== vehicle.fuelType) changes.fuelType = { from: previousValues.fuelType, to: vehicle.fuelType };
      if (previousValues.transmission !== vehicle.transmission) changes.transmission = { from: previousValues.transmission, to: vehicle.transmission };
      if (previousValues.year !== vehicle.year) changes.year = { from: previousValues.year, to: vehicle.year };
      if (previousValues.mileage !== vehicle.mileage) changes.mileage = { from: previousValues.mileage, to: vehicle.mileage };
      if (previousValues.price !== vehicle.price) changes.price = { from: previousValues.price, to: vehicle.price };
      if (previousValues.status !== vehicle.status) changes.status = { from: previousValues.status, to: vehicle.status };
      if (previousValues.vehicleNumber !== vehicle.vehicleNumber) changes.vehicleNumber = { from: previousValues.vehicleNumber, to: vehicle.vehicleNumber };
      if (previousValues.details !== vehicle.details) changes.details = "updated";
      if (files.length) changes.images = "updated";

      if (Object.keys(changes).length > 0) {
        await logActivity({
          actionType: "UPDATE",
          entityType: "VEHICLE",
          userId: req.user?._id || req.user?.id,
          userName: req.user?.name || req.user?.email || "Unknown",
          userRole: req.user?.role,
          title: `Vehicle Updated: ${vehicle.brand} ${vehicle.type}`,
          description: `Vehicle details were updated`,
          entityId: vehicle._id,
          changes,
          metadata: {
            brand: vehicle.brand,
            model: vehicle.model,
            type: vehicle.type,
            condition: vehicle.condition,
            fuelType: vehicle.fuelType,
            transmission: vehicle.transmission,
            year: vehicle.year,
            mileage: vehicle.mileage,
            price: vehicle.price,
            status: vehicle.status,
          },
        });
      }

      res.json(vehicle);
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to update vehicle" });
    }
  }
);

// DELETE
router.delete(
  "/:id",
  authMiddleware,
  authorize("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid vehicle id" });

      const vehicle = await Vehicle.findById(id);
      if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

      // Delete images from filesystem
      if (vehicle.images && Array.isArray(vehicle.images)) {
        const uploadDir = path.join(__dirname, "..", "uploads", "vehicles");
        for (const img of vehicle.images) {
          const filename = img.filename || img.url?.split("/").pop();
          const filepath = path.join(uploadDir, filename);
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
        }
      }

      // Delete from database
      await Vehicle.findByIdAndDelete(id);

      await logActivity({
        actionType: "DELETE",
        entityType: "VEHICLE",
        userId: req.user?._id || req.user?.id,
        userName: req.user?.name || req.user?.email || "Unknown",
        userRole: req.user?.role,
        title: `Vehicle Deleted: ${vehicle.brand} ${vehicle.type}`,
        description: `${vehicle.year} ${vehicle.brand} ${vehicle.type} was removed from inventory`,
        entityId: vehicle._id,
        metadata: {
          brand: vehicle.brand,
          model: vehicle.model,
          type: vehicle.type,
          condition: vehicle.condition,
          year: vehicle.year,
          price: vehicle.price,
          status: vehicle.status,
        },
      });

      res.json({ message: "Vehicle deleted successfully" });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to delete vehicle" });
    }
  }
);

// DELETE SINGLE IMAGE
router.delete(
  "/:id/images/:filename",
  authMiddleware,
  authorize("admin"),
  async (req, res) => {
    try {
      const { id, filename } = req.params;
      if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid vehicle id" });

      const vehicle = await Vehicle.findById(id);
      if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

      const imgIndex = vehicle.images.findIndex(img => img.filename === filename);
      if (imgIndex === -1) return res.status(404).json({ message: "Image not found" });

      // Remove from filesystem
      const uploadDir = path.join(__dirname, "..", "uploads", "vehicles");
      const filepath = path.join(uploadDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      // Remove from database
      vehicle.images.splice(imgIndex, 1);
      await vehicle.save();

      res.json({ message: "Image deleted", vehicle });
    } catch (err) {
      res.status(400).json({ message: err.message || "Failed to delete image" });
    }
  }
);

module.exports = router;
