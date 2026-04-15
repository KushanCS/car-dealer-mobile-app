const multer = require("multer");

const storage = multer.memoryStorage();
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;

const upload = multer({
  storage,
  limits: { files: 4, fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

module.exports = upload;
