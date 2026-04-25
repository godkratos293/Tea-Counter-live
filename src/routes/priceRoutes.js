const express = require("express");
const router = express.Router();

const {
  setPrice,
  getCurrentPrice,
  getPriceHistory,
} = require("../controllers/priceController");

router.post("/set", setPrice);
router.get("/current", getCurrentPrice);
router.get("/history", getPriceHistory);

module.exports = router;
