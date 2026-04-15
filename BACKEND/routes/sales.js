const router = require("express").Router();
const Sale = require("../models/Sale");
const Vehicle = require("../models/Vehicle");
const { logActivity } = require("../utils/activityLogger");
const authorize = require("../middleware/authorize");
const { validateObjectId } = require("../utils/validateObjectId");
const authMiddleware = require("../middleware/auth.middleware");

const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "other"];
const CHEQUE_NUMBER_PATTERN = /^\d+$/;

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCurrency(value, fieldName) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${fieldName} must be 0 or more`);
  }
  return amount;
}

function derivePaymentStatus(price, paidAmount) {
  if (paidAmount <= 0) return "pending";
  if (paidAmount >= price) return "completed";
  return "partial";
}

function buildVehicleLabel(vehicle) {
  if (!vehicle) return "";
  return [vehicle.brand, vehicle.type, vehicle.year ? `(${vehicle.year})` : ""].filter(Boolean).join(" ");
}

function buildSalePayload(body) {
  const price = normalizeCurrency(body.price, "Price");
  const paid_amount = normalizeCurrency(body.paid_amount ?? 0, "Paid amount");

  if (paid_amount > price) {
    throw new Error("Paid amount cannot be greater than the sale price");
  }

  const payment_method = sanitizeText(body.payment_method);
  const payment_reference = sanitizeText(body.payment_reference);
  const bank_name = sanitizeText(body.bank_name);
  const cheque_number = sanitizeText(body.cheque_number);
  const payment_details = sanitizeText(body.payment_details);

  if (paid_amount > 0 && !payment_method) {
    throw new Error("Payment method is required when a payment has been recorded");
  }

  if (payment_method && !PAYMENT_METHODS.includes(payment_method)) {
    throw new Error("Invalid payment method");
  }

  if (payment_method === "bank_transfer" && !payment_reference) {
    throw new Error("Payment reference is required for bank transfers");
  }

  if (payment_method === "cheque" && !cheque_number) {
    throw new Error("Cheque number is required for cheque payments");
  }

  if (payment_method === "cheque" && !CHEQUE_NUMBER_PATTERN.test(cheque_number)) {
    throw new Error("Cheque number must contain numbers only");
  }

  let payment_date = null;
  if (paid_amount > 0) {
    payment_date = body.payment_date ? new Date(body.payment_date) : new Date();
    if (Number.isNaN(payment_date.getTime())) {
      throw new Error("Invalid payment date");
    }
  }

  return {
    price,
    paid_amount,
    pending_amount: Math.max(price - paid_amount, 0),
    payment_status: derivePaymentStatus(price, paid_amount),
    payment_method: paid_amount > 0 ? payment_method : "",
    payment_reference: paid_amount > 0 ? payment_reference : "",
    bank_name: paid_amount > 0 ? bank_name : "",
    cheque_number: paid_amount > 0 ? cheque_number : "",
    payment_date,
    payment_details: paid_amount > 0 ? payment_details : "",
  };
}

async function syncVehicleStatus(vehicleId, paymentStatus) {
  if (!vehicleId) return;
  const nextStatus = paymentStatus === "completed" ? "sold" : "available";
  await Vehicle.findByIdAndUpdate(vehicleId, { status: nextStatus });
}

router.get("/stats", authMiddleware, authorize("admin", "staff"), async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const completed = await Sale.find({
      payment_status: "completed",
      createdAt: { $gte: start, $lt: end },
    });

    const allInYear = await Sale.find({
      createdAt: { $gte: start, $lt: end },
    });

    let totalRevenue = 0;
    let collectedAmount = 0;
    let outstandingAmount = 0;
    const totalSales = completed.length;

    const months = new Set();
    completed.forEach((sale) => {
      totalRevenue += Number(sale.price || 0);
      const date = new Date(sale.createdAt);
      months.add(`${date.getFullYear()}-${date.getMonth() + 1}`);
    });

    allInYear.forEach((sale) => {
      collectedAmount += Number(sale.paid_amount || 0);
      outstandingAmount += Number(sale.pending_amount || 0);
    });

    const avgMonthlyRevenue = months.size ? totalRevenue / months.size : 0;

    res.json({ year, totalRevenue, totalSales, avgMonthlyRevenue, collectedAmount, outstandingAmount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", authMiddleware, authorize("admin", "staff"), async (req, res) => {
  try {
    const sales = await Sale.find().populate("vehicle").populate("customer").sort({ createdAt: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const createSale = async (req, res) => {
  try {
    const { vehicle, customer } = req.body;

    if (!validateObjectId(vehicle)) return res.status(400).json({ message: "Invalid vehicle ID" });
    if (!validateObjectId(customer)) return res.status(400).json({ message: "Invalid customer ID" });
    if (req.body.price === undefined || req.body.price === null) {
      return res.status(400).json({ message: "Price is required" });
    }

    const vehicleDoc = await Vehicle.findById(vehicle);
    if (!vehicleDoc) return res.status(404).json({ message: "Vehicle not found" });
    if (vehicleDoc.status === "sold") {
      return res.status(400).json({ message: "This vehicle is already marked as sold" });
    }

    const customerDoc = await Sale.db.model("Lead").findById(customer).select("name email");

    const paymentData = buildSalePayload(req.body);

    const sale = await Sale.create({
      vehicle,
      customer,
      ...paymentData,
    });

    await syncVehicleStatus(vehicle, sale.payment_status);

    await logActivity({
      actionType: "CREATE",
      entityType: "SALE",
      userId: req.user?._id || req.user?.id,
      userName: req.user?.name || req.user?.email || "Unknown",
      userRole: req.user?.role,
      title: "Sale Created",
      description: `${buildVehicleLabel(vehicleDoc)} sale recorded for ${customerDoc?.name || "customer"}`,
      entityId: sale._id,
      metadata: {
        vehicle,
        vehicleName: buildVehicleLabel(vehicleDoc),
        vehicleNumber: vehicleDoc.vehicleNumber || "",
        customer,
        customerName: customerDoc?.name || "",
        price: sale.price,
        paid_amount: sale.paid_amount,
        pending_amount: sale.pending_amount,
        payment_status: sale.payment_status,
        payment_method: sale.payment_method,
        payment_reference: sale.payment_reference,
      },
    });

    res.status(201).json(sale);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

router.post("/", authMiddleware, authorize("admin", "staff"), createSale);
router.post("/add", authMiddleware, authorize("admin", "staff"), createSale);

router.get("/:id", authMiddleware, authorize("admin", "staff"), async (req, res) => {
  const { id } = req.params;
  if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid sale ID" });

  try {
    const sale = await Sale.findById(id).populate("vehicle").populate("customer");
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", authMiddleware, authorize("admin", "staff"), async (req, res) => {
  const { id } = req.params;
  if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid sale ID" });

  try {
    const existing = await Sale.findById(id);
    if (!existing) return res.status(404).json({ message: "Sale not found" });
    const vehicleDoc = existing.vehicle ? await Vehicle.findById(existing.vehicle).select("brand type year vehicleNumber") : null;
    const customerDoc = existing.customer ? await Sale.db.model("Lead").findById(existing.customer).select("name email") : null;

    const paymentData = buildSalePayload(req.body);

    const updated = await Sale.findByIdAndUpdate(id, paymentData, { new: true, runValidators: true });

    await syncVehicleStatus(updated.vehicle, updated.payment_status);

    const changes = {};
    if (Number(existing.price) !== Number(updated.price)) {
      changes.price = { from: existing.price, to: updated.price };
    }
    if (Number(existing.paid_amount || 0) !== Number(updated.paid_amount || 0)) {
      changes.paid_amount = { from: existing.paid_amount || 0, to: updated.paid_amount || 0 };
    }
    if (Number(existing.pending_amount || 0) !== Number(updated.pending_amount || 0)) {
      changes.pending_amount = { from: existing.pending_amount || 0, to: updated.pending_amount || 0 };
    }
    if ((existing.payment_status || "") !== (updated.payment_status || "")) {
      changes.payment_status = { from: existing.payment_status || "", to: updated.payment_status || "" };
    }
    if ((existing.payment_method || "") !== (updated.payment_method || "")) {
      changes.payment_method = { from: existing.payment_method || "", to: updated.payment_method || "" };
    }
    if ((existing.payment_reference || "") !== (updated.payment_reference || "")) {
      changes.payment_reference = { from: existing.payment_reference || "", to: updated.payment_reference || "" };
    }
    if ((existing.bank_name || "") !== (updated.bank_name || "")) {
      changes.bank_name = { from: existing.bank_name || "", to: updated.bank_name || "" };
    }
    if ((existing.cheque_number || "") !== (updated.cheque_number || "")) {
      changes.cheque_number = { from: existing.cheque_number || "", to: updated.cheque_number || "" };
    }
    if ((existing.payment_details || "") !== (updated.payment_details || "")) {
      changes.payment_details = { from: existing.payment_details || "", to: updated.payment_details || "" };
    }

    if (Object.keys(changes).length > 0) {
      await logActivity({
        actionType: "UPDATE",
        entityType: "SALE",
        userId: req.user?._id || req.user?.id,
        userName: req.user?.name || req.user?.email || "Unknown",
        userRole: req.user?.role,
        title: "Sale Updated",
        description: `Payment details updated for ${buildVehicleLabel(vehicleDoc) || "sale record"}`,
        entityId: updated._id,
        changes,
        metadata: {
          vehicle: updated.vehicle,
          vehicleName: buildVehicleLabel(vehicleDoc),
          vehicleNumber: vehicleDoc?.vehicleNumber || "",
          customer: updated.customer,
          customerName: customerDoc?.name || "",
          price: updated.price,
          paid_amount: updated.paid_amount,
          pending_amount: updated.pending_amount,
          payment_status: updated.payment_status,
          payment_method: updated.payment_method,
          payment_reference: updated.payment_reference,
        },
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", authMiddleware, authorize("admin"), async (req, res) => {
  const { id } = req.params;
  if (!validateObjectId(id)) return res.status(400).json({ message: "Invalid sale ID" });

  try {
    const deleted = await Sale.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Sale not found" });
    const vehicleDoc = deleted.vehicle ? await Vehicle.findById(deleted.vehicle).select("brand type year vehicleNumber") : null;
    const customerDoc = deleted.customer ? await Sale.db.model("Lead").findById(deleted.customer).select("name email") : null;

    await syncVehicleStatus(deleted.vehicle, "pending");

    await logActivity({
      actionType: "DELETE",
      entityType: "SALE",
      userId: req.user?._id || req.user?.id,
      userName: req.user?.name || req.user?.email || "Unknown",
      userRole: req.user?.role,
      title: "Sale Deleted",
      description: `${buildVehicleLabel(vehicleDoc) || "Sale record"} was deleted`,
      entityId: deleted._id,
      metadata: {
        vehicle: deleted.vehicle,
        vehicleName: buildVehicleLabel(vehicleDoc),
        vehicleNumber: vehicleDoc?.vehicleNumber || "",
        customer: deleted.customer,
        customerName: customerDoc?.name || "",
        price: deleted.price,
        paid_amount: deleted.paid_amount,
        pending_amount: deleted.pending_amount,
        payment_status: deleted.payment_status,
        payment_method: deleted.payment_method,
        payment_reference: deleted.payment_reference,
      },
    });

    res.json({ message: "Sale deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
