const rateLimit = require("express-rate-limit");

// 🟢 General APIs
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 min
  max: 100,
  message: {
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔴 Heavy APIs (PDF/Excel)
const heavyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5, // stricter because PDF is heavy
  message: {
    message: "Too many export requests. Please wait.",
  },
});

module.exports = {
  generalLimiter,
  heavyLimiter,
};
