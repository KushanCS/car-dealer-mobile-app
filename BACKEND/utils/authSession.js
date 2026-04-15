const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const serverSessionId = crypto.randomBytes(16).toString("hex");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return `${process.env.JWT_SECRET}:${serverSessionId}`;
};

const signAuthToken = (payload, options = {}) =>
  jwt.sign(payload, getJwtSecret(), { expiresIn: "7d", ...options });

const verifyAuthToken = (token, options = {}) => jwt.verify(token, getJwtSecret(), options);

module.exports = {
  serverSessionId,
  signAuthToken,
  verifyAuthToken,
};
