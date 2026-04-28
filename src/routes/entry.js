const express = require("express");
const router = express.Router();

const {
  addEntry,
  getTodayEntries,
  getMonthlyEntries,
  updateEntry,
  deleteEntry,
  exportMonthlySummary,
  exportMonthlyEntries,
  getMonthlySummary,
  generateBillPDF,
} = require("../controllers/entry");
const { generalLimiter, heavyLimiter } = require("../middleware/rateLimiter");

// Routes
router.post("/add", generalLimiter, addEntry);
router.get("/today", generalLimiter, getTodayEntries);
router.get("/month", getMonthlyEntries);
router.get("/monthsummary", generalLimiter, getMonthlySummary);
router.put("/update/:id", generalLimiter, updateEntry);
router.delete("/delete/:id", generalLimiter, deleteEntry);
router.get("/export/pdf", heavyLimiter, generateBillPDF);

module.exports = router;
