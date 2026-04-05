// utils/validator.js

export const Validator = {
  isNonEmptyString: (value) => {
    return typeof value === "string" && value.trim().length > 0;
  },

  isValidUsername: (username) => {
    return Validator.isNonEmptyString(username) && username.length >= 5;
  },

  isValidPassword: (password) => {
    return Validator.isNonEmptyString(password) && password.length >= 4;
  },
/** 
  * @param {object} json
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
