const { verifyAuthToken } = require("../utils/authSession");

module.exports = function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).json({ message: "No token" });

    const decoded = verifyAuthToken(token);
    req.user = decoded;

    return next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
