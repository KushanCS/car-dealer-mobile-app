const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function validateStrongPassword(password) {
  const value = String(password || "");
  if (!value) {
    return "Password is required";
  }

  if (!STRONG_PASSWORD_REGEX.test(value)) {
    return "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character";
  }

  return "";
}

module.exports = {
  validateStrongPassword,
};
