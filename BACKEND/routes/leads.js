const router = require("express").Router();
const Lead = require("../models/Lead");
const {
    normalizeEmail,
    normalizePhoneNumber,
    validateEmailAddress,
    validatePhoneNumber,
} = require("../utils/inputValidation");

function normalizeLeadPayload(payload = {}) {
    return {
        ...payload,
        email: typeof payload.email === "string" ? normalizeEmail(payload.email) : payload.email,
        contact_number: typeof payload.contact_number === "string" ? normalizePhoneNumber(payload.contact_number) : payload.contact_number,
    };
}

function getLeadValidationErrors(payload = {}) {
    const errors = [];
    const phoneError = validatePhoneNumber(payload.contact_number, "Contact number");
    const emailError = validateEmailAddress(payload.email);

    if (phoneError) errors.push(phoneError);
    if (emailError) errors.push(emailError);

    return errors;
}

router.post("/add", async (req, res) => {
    try {
        const payload = normalizeLeadPayload(req.body);
        const validationErrors = getLeadValidationErrors(payload);
        if (validationErrors.length > 0) {
            return res.status(400).json({ errors: validationErrors });
        }

        const lead = new Lead(payload);
        const savedLead = await lead.save();
        res.status(201).json(savedLead);
    } catch (err) {
        if (err.name === "ValidationError") {
            return res.status(400).json({
                errors: Object.values(err.errors).map(e => e.message)
            });
        }
        res.status(500).json({ message: err.message });
    }
});

router.get("/", async (req, res) => {
    try {
        res.json(await Lead.find());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: "Lead not found" });
        res.json(lead);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const payload = normalizeLeadPayload(req.body);
        const validationErrors = getLeadValidationErrors(payload);
        if (validationErrors.length > 0) {
            return res.status(400).json({ errors: validationErrors });
        }

        const updated = await Lead.findByIdAndUpdate(
            req.params.id,
            payload,
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: "Lead not found" });
        res.json(updated);
    } catch (err) {
        if (err.name === "ValidationError") {
            return res.status(400).json({
                errors: Object.values(err.errors).map(e => e.message)
            });
        }
        res.status(500).json({ message: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const deleted = await Lead.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Lead not found" });
        res.json({ message: "Lead deleted" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
