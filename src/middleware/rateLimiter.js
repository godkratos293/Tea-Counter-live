const rateLimit = require("express-rate-limit");

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: {
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const heavyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: {
    message: "Too many export requests. Please wait.",
  },
});

module.exports = {
  generalLimiter,
  heavyLimiter,
};
