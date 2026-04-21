// utils/validator.js

export const Validator = {
  isNonEmptyString: (value) => {
    return typeof value === "string" && value.trim().length > 0;
  },

  // Relajamos las reglas: En IPTV a veces hay usuarios/passwords muy cortos (ej: "123")
  // Con que no estén vacíos, nos damos por servidos.
  isValidUsername: (username) => {
    return Validator.isNonEmptyString(username);
  },

  isValidPassword: (password) => {
    return Validator.isNonEmptyString(password);
  },

  /** * @param {object} json
   * @param {string[]} requiredFields
   */
  isValidApiResponse: (json, requiredFields = []) => {
    if (!json || typeof json !== "object") return false;
    if (requiredFields.length === 0) return true;
    return requiredFields.every(field => Object.prototype.hasOwnProperty.call(json, field));
  },

  isValidTMDBData: (data) => {
    if (!data) return false;
    const hasName = data.title || data.name;
    const hasPoster = !!data.poster_path;
    return !!(hasName && hasPoster);
  }
};