const TeaEntry = require("../models/TeaEntry");
const TeaPrice = require("../models/TeaPrice");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit-table");

const getCurrentMonthYear = () => {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
};

// ADD ENTRY
const addEntry = async (req, res) => {
  try {
    const { cup_count, date } = req.body;

    if (!cup_count || !Number.isInteger(cup_count) || cup_count <= 0) {
      return res.status(400).json({ message: "Valid cup count is required" });
    }

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const manualDate = new Date(date);

    if (isNaN(manualDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const now = new Date();
    const time = now.toLocaleTimeString("en-IN");

    const priceDoc = await TeaPrice.findOne().sort({ effective_from: -1 });

    if (!priceDoc) {
      return res.status(400).json({ message: "No price found in DB" });
    }

    const currentPrice = priceDoc.price_per_cup;

    const newEntry = new TeaEntry({
      cup_count,
      price_per_cup: currentPrice,
      total: cup_count * currentPrice,
      date_time: manualDate,
      date: manualDate,
      time,
      month: manualDate.getMonth() + 1,
      year: manualDate.getFullYear(),
    });

    const saved = await newEntry.save();

    res.status(201).json({
      message: "Entry added successfully",
      data: saved,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

//  TODAY
const getTodayEntries = async (req, res) => {
  try {
    const now = new Date();

    const start = new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
    );

    const end = new Date(
      Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const entries = await TeaEntry.find({
      date_time: { $gte: start, $lte: end },
    }).sort({ date_time: 1 });

    let totalCups = 0;
    let totalAmount = 0;

    entries.forEach((e) => {
      const price = e.price_per_cup || 0;
      totalCups += e.cup_count || 0;
      totalAmount += (e.cup_count || 0) * price;
    });

    //Custom date format (dd-Ap-yyyy)
    const day = String(now.getDate()).padStart(2, "0");
    const year = now.getFullYear();

    const customMonths = [
      "Ja",
      "Fe",
      "Ma",
      "Ap",
      "My",
      "Jn",
      "Jl",
      "Au",
      "Se",
      "Oc",
      "No",
      "De",
    ];

    const month = customMonths[now.getMonth()];
    const formattedDate = `${day}-${month}-${year}`;

    res.json({
      date: formattedDate,
      totalCups,
      totalAmount,
      totalEntries: entries.length,
      entries,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
//  MONTHLY
const getMonthlyEntries = async (req, res) => {
  try {
    let { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month & year required" });
    }

    month = parseInt(month);
    year = parseInt(year);

    const priceDoc = await TeaPrice.findOne().sort({ effective_from: -1 });
    const currentPrice = priceDoc ? priceDoc.price_per_cup : 0;

    const entries = await TeaEntry.find({ month, year }).sort({
      date_time: 1,
    });

    let totalCups = 0;
    let totalAmount = 0;

    entries.forEach((e) => {
      totalCups += e.cup_count;
      totalAmount += e.cup_count * currentPrice;
    });

    res.json({
      month,
      year,
      totalCups,
      currentPrice,
      totalAmount,
      totalEntries: entries.length,
      entries,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// UPDATE
const updateEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { cup_count } = req.body;

    if (!Number.isInteger(cup_count) || cup_count <= 0) {
      return res.status(400).json({ message: "Invalid cup count" });
    }

    const entry = await TeaEntry.findById(id);
    if (!entry) return res.status(404).json({ message: "Not found" });

    const { month: cm, year: cy } = getCurrentMonthYear();

    if (entry.year < cy || (entry.year === cy && entry.month < cm)) {
      return res.status(403).json({
        message: "Cannot edit past month entries",
      });
    }

    entry.cup_count = cup_count;
    entry.total = cup_count * (entry.price_per_cup || 0);

    const updated = await entry.save();

    res.json({
      message: "Updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

//  DELETE
const deleteEntry = async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await TeaEntry.findById(id);
    if (!entry) return res.status(404).json({ message: "Not found" });

    const { month: cm, year: cy } = getCurrentMonthYear();

    if (entry.year < cy || (entry.year === cy && entry.month < cm)) {
      return res.status(403).json({
        message: "Cannot delete past month entries",
      });
    }

    await entry.deleteOne();

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

//  PDF
const exportMonthlyPDF = async (req, res) => {
  try {
    let { month, year } = req.query;

    month = Number(month);
    year = Number(year);

    if (
      !month ||
      !year ||
      isNaN(month) ||
      isNaN(year) ||
      month < 1 ||
      month > 12
    ) {
      return res.status(400).json({
        message: "Valid month (1-12) and year required",
      });
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const entries = await TeaEntry.find({
      date_time: { $gte: start, $lte: end },
    }).sort({ date_time: 1 });

    let totalCups = 0;
    let totalAmount = 0;
    let pricePerCup = 0;

    entries.forEach((e) => {
      const price = e.price_per_cup || 0;
      const cups = e.cup_count || 0;

      pricePerCup = price;
      totalCups += cups;
      totalAmount += cups * price;
    });

    const monthName = new Date(year, month - 1).toLocaleString("en-IN", {
      month: "long",
    });

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=tea-report-${month}-${year}.pdf`,
    );

    doc.pipe(res);

    //  HEADER
    doc
      .fontSize(22)
      .fillColor("#000000")
      .text(`Tea Counter Report (${monthName}, ${year})`, {
        align: "center",
      });

    doc.moveDown();

    doc.fillColor("black").fontSize(12);
    doc.text(`Month: ${monthName} ${year}`);
    doc.moveDown(0.5);
    doc.text(`Total Cups: ${totalCups}`);
    doc.moveDown(0.5);
    doc.text(`Current Cup Price: ${pricePerCup}`);
    doc.moveDown(0.5);

    doc.fontSize(14).fillColor("#0E9F6E").text(`Total Amount: ${totalAmount}`);

    doc.moveDown(2);

    const pageHeight = doc.page.height;
    const tableTop = doc.y;

    const col = {
      sr: 30,
      date: 80,
      time: 175,
      price: 250,
      cups: 350,
      total: 435,
    };

    //  TABLE HEADER
    doc.fillColor("#000000").font("Helvetica-Bold").fontSize(12);

    doc.text("#", col.sr, tableTop);
    doc.text("DATE", col.date, tableTop);
    doc.text("TIME", col.time, tableTop);
    doc.text("PER CUP", col.price, tableTop);
    doc.text("CUPS", col.cups, tableTop);
    doc.text("TOTAL", col.total + 15, tableTop);

    doc
      .moveTo(30, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .lineWidth(1)
      .strokeColor("#000000")
      .stroke();

    doc.font("Helvetica").fillColor("black");

    let y = tableTop + 25;

    // TABLE ROWS
    entries.forEach((e, index) => {
      const dateObj = new Date(e.date_time);

      const formattedDate = dateObj
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .replace(/ /g, "-");

      const formattedTime = e.time
        ? e.time.split(":").slice(0, 2).join(":") + " " + e.time.split(" ")[1]
        : "-";

      const cups = e.cup_count || 0;
      const price = e.price_per_cup || 0;
      const total = cups * price;

      doc.text(String(index + 1), col.sr, y, { width: 30 });
      doc.text(formattedDate, col.date - 20, y, { width: 90 });
      doc.text(formattedTime, col.time - 5, y, { width: 70 });
      doc.text(`${price}`, col.price + 20, y, { width: 50 });
      doc.text(String(cups), col.cups + 10, y, { width: 40 });
      doc.text(`${total}`, col.total + 25, y, { width: 60 });

      const rowHeight = Math.max(
        doc.heightOfString(formattedDate, { width: 90 }),
        doc.heightOfString(formattedTime, { width: 70 }),
        20,
      );

      y += rowHeight + 3;

      // PAGE BREAK
      if (y > pageHeight - 80) {
        doc.addPage();
        y = 50;

        doc.font("Helvetica-Bold").fillColor("#000000").fontSize(12);

        doc.text("#", col.sr, y);
        doc.text("DATE", col.date, y);
        doc.text("TIME", col.time, y);
        doc.text("PER CUP", col.price, y);
        doc.text("CUPS", col.cups, y);
        doc.text("TOTAL", col.total + 15, y);

        doc
          .moveTo(30, y + 15)
          .lineTo(550, y + 15)
          .lineWidth(1)
          .strokeColor("#000000")
          .stroke();

        doc.font("Helvetica").fillColor("black");

        y += 25;
      }
    });

    // TOTAL SECTION
    y += 10;

    doc
      .save()
      .strokeColor("#000000")
      .lineWidth(1)
      .moveTo(30, y)
      .lineTo(550, y)
      .stroke()
      .restore();

    y += 8;
    y += 10;

    doc.font("Helvetica-Bold").fontSize(13);

    doc.text("Total", col.price + 20, y);
    doc.text(String(totalCups), col.cups + 10, y);
    doc.text(`${totalAmount}`, col.total + 25, y);

    doc.end();
  } catch (error) {
    console.error("PDF Export Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  addEntry,
  getTodayEntries,
  getMonthlyEntries,
  updateEntry,
  deleteEntry,
  exportMonthlyPDF,
};
