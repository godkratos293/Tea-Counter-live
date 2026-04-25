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
  exportMonthlyPDF,
} = require("../controllers/entry");

// Routes
router.post("/add", addEntry);
router.get("/today", getTodayEntries);
router.get("/month", getMonthlyEntries);
router.put("/update/:id", updateEntry);
router.delete("/delete/:id", deleteEntry);
router.get("/export/pdf", exportMonthlyPDF);

module.exports = router;
