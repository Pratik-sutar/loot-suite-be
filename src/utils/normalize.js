// src/utils/normalize.js

module.exports = {
  normalizeOrderId(orderId) {
    return (orderId || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  },
  normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  },
};
