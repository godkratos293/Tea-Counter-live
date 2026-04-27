const express = require("express");
const router = express.Router();

const {
  setPrice,
  getCurrentPrice,
  getPriceHistory,
} = require("../controllers/priceController");
const { generalLimiter } = require("../middleware/rateLimiter");

router.post("/set", generalLimiter, setPrice);
router.get("/current", generalLimiter, getCurrentPrice);
router.get("/history", generalLimiter, getPriceHistory);

module.exports = router;
