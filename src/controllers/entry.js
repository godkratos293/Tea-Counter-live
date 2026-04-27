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
const addEntry = async (req, res, next) => {
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
      data: {
        date: saved.date,
        time: saved.time,
        price_per_cup: saved.price_per_cup,
        cup_count: saved.cup_count,
        total: saved.total,
        month: saved.month,
        year: saved.year,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

//  TODAY
const getTodayEntries = async (req, res, next) => {
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
    })
      .select("-_id -__v -createdAt -updatedAt")
      .sort({ date_time: 1 });

    let totalCups = 0;
    let totalAmount = 0;

    entries.forEach((e) => {
      const price = e.price_per_cup || 0;
      totalCups += e.cup_count || 0;
      totalAmount += (e.cup_count || 0) * price;
    });

    const day = String(now.getDate()).padStart(2, "0");
    const year = now.getFullYear();

    const customMonths = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
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
// MONTHLY SUMMARY
const getMonthlySummary = async (req, res, next) => {
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
      const price = e.price_per_cup ?? currentPrice;
      totalCups += e.cup_count;
      totalAmount += e.cup_count * price;
    });

    res.json({
      month,
      year,
      totalCups,
      currentPrice,
      totalAmount,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
//   MONTHTLY ENTRIES
const getMonthlyEntries = async (req, res, next) => {
  try {
    let { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month & year required" });
    }

    month = parseInt(month);
    year = parseInt(year);

    // latest fallback price
    const priceDoc = await TeaPrice.findOne().sort({ effective_from: -1 });
    const currentPrice = priceDoc ? priceDoc.price_per_cup : 0;

    const entries = await TeaEntry.find({ month, year }).sort({
      date_time: 1,
    });

    let totalCups = 0;
    let totalAmount = 0;

    const updatedEntries = entries.map((e) => {
      const price = e.price_per_cup ?? currentPrice;
      const amount = e.cup_count * price;

      totalCups += e.cup_count;
      totalAmount += amount;

      const obj = e.toObject();
      delete obj._id;
      delete obj.__v;
      delete obj.createdAt;
      delete obj.updatedAt;

      return {
        ...obj,
        price_per_cup: price,
        amount,
      };
    });

    res.json({
      month,
      year,
      totalCups,
      currentPrice,
      totalAmount,
      totalEntries: entries.length,
      entries: updatedEntries,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
// UPDATE
const updateEntry = async (req, res, next) => {
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
      data: {
        date: updated.date,
        time: updated.time,
        price_per_cup: updated.price_per_cup,
        cup_count: updated.cup_count,
        total: updated.total,
        month: updated.month,
        year: updated.year,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

//  DELETE
const deleteEntry = async (req, res, next) => {
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
const exportMonthlyPDF = async (req, res, next) => {
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

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

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
      timeZone: "Asia/Kolkata",
    });

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=tea-report-${month}-${year}.pdf`,
    );

    doc.pipe(res);

    // HEADER
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

    const tableTop = doc.y;

    const col = {
      sr: 30,
      date: 80,
      time: 175,
      price: 250,
      cups: 350,
      total: 435,
    };

    const ROWS_PER_PAGE = 20;
    let rowCount = 0;

    const drawHeader = (yPos) => {
      doc.fillColor("#000000").font("Helvetica-Bold").fontSize(12);

      doc.text("#", col.sr, yPos);
      doc.text("DATE", col.date, yPos);
      doc.text("TIME", col.time, yPos);
      doc.text("PER CUP", col.price, yPos);
      doc.text("CUPS", col.cups, yPos);
      doc.text("TOTAL", col.total + 15, yPos);

      doc
        .moveTo(30, yPos + 15)
        .lineTo(550, yPos + 15)
        .lineWidth(1)
        .strokeColor("#000000")
        .stroke();

      doc.font("Helvetica").fillColor("black");
    };

    drawHeader(tableTop);

    let y = tableTop + 25;

    const drawBottomLine = (yPos) => {
      doc
        .moveTo(30, yPos)
        .lineTo(550, yPos)
        .lineWidth(1)
        .strokeColor("#000000")
        .stroke();
    };

    entries.forEach((e, index) => {
      if (rowCount === ROWS_PER_PAGE) {
        drawBottomLine(y);

        doc.addPage();
        y = 50;

        drawHeader(y);
        y += 25;

        rowCount = 0;
      }
      // ✅ FIX 2: Always format date in IST
      const dateObj = new Date(e.date_time);

      const formattedDate = dateObj
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        })
        .replace(/ /g, "-");

      const timeObj = new Date(e.createdAt);

      const formattedTime = timeObj.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });

      const cups = e.cup_count || 0;
      const price = e.price_per_cup || 0;
      const total = cups * price;

      doc.text(String(index + 1), col.sr, y, { width: 30 });
      doc.text(formattedDate, col.date - 20, y, { width: 90 });
      doc.text(formattedTime, col.time - 5, y, { width: 70 });
      doc.text(`${price}`, col.price + 20, y, { width: 50 });
      doc.text(String(cups), col.cups + 10, y, { width: 40 });
      doc.text(`${total}`, col.total + 25, y, { width: 60 });

      y += 22;
      rowCount++;
    });

    drawBottomLine(y);

    y += 15;

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
  getMonthlySummary,
};
