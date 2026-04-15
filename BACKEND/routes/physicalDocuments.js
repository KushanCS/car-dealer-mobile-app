const router = require("express").Router();
const PhysicalDocument = require("../models/PhysicalDocument");
const Vehicle = require("../models/Vehicle");
const auth = require("../middleware/auth.middleware");
const authorize = require("../middleware/authorize");
const { validateObjectId } = require("../utils/validateObjectId");
const { logActivity } = require("../utils/activityLogger");

const sanitizeDocBody = (body = {}) => {
  const clean = { ...body };
  delete clean.holder;    
  delete clean.createdBy;  
  delete clean.isArchived; 
  return clean;
};

router.post("/", auth, authorize("staff", "admin"), async (req, res) => {
  try {
    const doc = await PhysicalDocument.create({
      ...sanitizeDocBody(req.body),
      createdBy: req.user.id,
    });

    const vehicle = doc.vehicle ? await Vehicle.findById(doc.vehicle).select("brand type year vehicleNumber") : null;

    await logActivity({
      actionType: "CREATE",
      entityType: "DOCUMENT",
      userId: req.user.id,
      userName: req.user.name || req.user.email || "Unknown",
      userRole: req.user.role,
      title: `Document Added: ${doc.title}`,
      description: `${doc.docType} document was added${vehicle ? ` for ${vehicle.brand} ${vehicle.type}` : ""}`,
      entityId: doc._id,
      metadata: {
        title: doc.title,
        docType: doc.docType,
        status: doc.status,
        location: doc.location,
        referenceNo: doc.referenceNo,
        vehicleId: vehicle?._id || null,
        vehicleName: vehicle ? `${vehicle.brand} ${vehicle.type}` : "",
        vehicleNumber: vehicle?.vehicleNumber || "",
      },
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/", auth, authorize("staff", "admin"), async (req, res) => {
  try {
    const docs = await PhysicalDocument.find({ isArchived: { $ne: true } })
      .populate("vehicle") 
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", auth, authorize("staff", "admin"), async (req, res) => {
  const { id } = req.params;
  if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid doc id" });

  try {
    const doc = await PhysicalDocument.findById(id)
      .populate("vehicle")
      .populate("createdBy", "name email role");

    if (!doc) return res.status(404).json({ message: "Document not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", auth, authorize("staff", "admin"), async (req, res) => {
  const { id } = req.params;
  if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid doc id" });

  try {
    const existing = await PhysicalDocument.findById(id);
    if (!existing) return res.status(404).json({ message: "Document not found" });

    const updated = await PhysicalDocument.findByIdAndUpdate(id, sanitizeDocBody(req.body), { new: true, runValidators: true });

    const previousVehicle = existing.vehicle ? await Vehicle.findById(existing.vehicle).select("brand type year vehicleNumber") : null;
    const nextVehicle = updated.vehicle ? await Vehicle.findById(updated.vehicle).select("brand type year vehicleNumber") : null;

    const changes = {};
    if (existing.title !== updated.title) changes.title = { from: existing.title, to: updated.title };
    if (existing.docType !== updated.docType) changes.docType = { from: existing.docType, to: updated.docType };
    if (existing.status !== updated.status) changes.status = { from: existing.status, to: updated.status };
    if ((existing.location || "") !== (updated.location || "")) changes.location = { from: existing.location || "", to: updated.location || "" };
    if ((existing.referenceNo || "") !== (updated.referenceNo || "")) changes.referenceNo = { from: existing.referenceNo || "", to: updated.referenceNo || "" };
    if (String(existing.vehicle || "") !== String(updated.vehicle || "")) {
      changes.vehicle = {
        from: previousVehicle ? `${previousVehicle.brand} ${previousVehicle.type}` : "",
        to: nextVehicle ? `${nextVehicle.brand} ${nextVehicle.type}` : "",
      };
    }

    if (Object.keys(changes).length > 0) {
      await logActivity({
        actionType: "UPDATE",
        entityType: "DOCUMENT",
        userId: req.user.id,
        userName: req.user.name || req.user.email || "Unknown",
        userRole: req.user.role,
        title: `Document Updated: ${updated.title}`,
        description: `Document details were updated for ${updated.title}`,
        entityId: updated._id,
        changes,
        metadata: {
          title: updated.title,
          docType: updated.docType,
          status: updated.status,
          location: updated.location,
          referenceNo: updated.referenceNo,
          vehicleId: nextVehicle?._id || null,
          vehicleName: nextVehicle ? `${nextVehicle.brand} ${nextVehicle.type}` : "",
          vehicleNumber: nextVehicle?.vehicleNumber || "",
        },
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", auth, authorize("admin"), async (req, res) => {
  const { id } = req.params;
  if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid doc id" });

  try {
    const deleted = await PhysicalDocument.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Document not found" });

    const vehicle = deleted.vehicle ? await Vehicle.findById(deleted.vehicle).select("brand type year vehicleNumber") : null;

    await logActivity({
      actionType: "DELETE",
      entityType: "DOCUMENT",
      userId: req.user.id,
      userName: req.user.name || req.user.email || "Unknown",
      userRole: req.user.role,
      title: `Document Deleted: ${deleted.title}`,
      description: `${deleted.docType} document was removed`,
      entityId: deleted._id,
      metadata: {
        title: deleted.title,
        docType: deleted.docType,
        status: deleted.status,
        location: deleted.location,
        referenceNo: deleted.referenceNo,
        vehicleId: vehicle?._id || null,
        vehicleName: vehicle ? `${vehicle.brand} ${vehicle.type}` : "",
        vehicleNumber: vehicle?.vehicleNumber || "",
      },
    });

    res.json({ message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
