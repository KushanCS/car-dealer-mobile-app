const multer = require("multer");

module.exports = (err, req, res, next) => {
  console.error("🔥 ERROR:", err?.stack || err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Image is too large. Please upload an image smaller than 15 MB.",
      });
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        message: "You can upload a maximum of 4 images.",
      });
    }

    return res.status(400).json({
      message: err.message || "File upload failed.",
    });
  }

  res.status(err.status || 500).json({
    message: err.message || "Server error",
  });
};
