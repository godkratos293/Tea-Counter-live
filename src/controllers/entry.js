const TeaEntry = require("../models/TeaEntry");
const TeaPrice = require("../models/TeaPrice");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

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
    }).sort({ date_time: 1 });

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

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const priceDoc = await TeaPrice.findOne().sort({ effective_from: -1 });
    const currentPrice = priceDoc ? priceDoc.price_per_cup : 0;

    const entries = await TeaEntry.find({
      date_time: { $gte: start, $lte: end },
    }).sort({ date_time: 1 });

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
      totalEntries: entries.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const getMonthlyEntries = async (req, res, next) => {
  try {
    let { month, year, page = 1, limit = 10 } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month & year required" });
    }

    month = parseInt(month);
    year = parseInt(year);
    page = parseInt(page);
    limit = parseInt(limit);

    const skip = (page - 1) * limit;

    const priceDoc = await TeaPrice.findOne().sort({ effective_from: -1 });
    const currentPrice = priceDoc ? priceDoc.price_per_cup : 0;

    const totalEntries = await TeaEntry.countDocuments({ month, year });

    const totals = await TeaEntry.aggregate([
      { $match: { month, year } },
      {
        $addFields: {
          price: { $ifNull: ["$price_per_cup", currentPrice] },
        },
      },
      {
        $group: {
          _id: null,
          totalCups: { $sum: "$cup_count" },
          totalAmount: {
            $sum: { $multiply: ["$cup_count", "$price"] },
          },
        },
      },
    ]);

    const totalCups = totals[0]?.totalCups || 0;
    const totalAmount = totals[0]?.totalAmount || 0;

    const entries = await TeaEntry.find({ month, year })
      .sort({ date_time: 1 })
      .skip(skip)
      .limit(limit);

    let pageTotalCups = 0;
    let pageTotalAmount = 0;

    const updatedEntries = entries.map((e) => {
      const price = e.price_per_cup ?? currentPrice;
      const amount = e.cup_count * price;

      pageTotalCups += e.cup_count;
      pageTotalAmount += amount;

      const obj = {
        ...e._doc,
        id: e._id,
        price_per_cup: price,
        // amount,
      };

      delete obj._id;
      delete obj.__v;
      delete obj.date_time;

      return obj;
    });

    res.json({
      month,
      year,
      currentPrice,

      page,
      limit,
      totalEntries,
      totalPages: Math.ceil(totalEntries / limit),

      totalCups,
      totalAmount,

      entries: updatedEntries,
    });
  } catch (error) {
    console.error(error);
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
const padRight = (text, length) => {
  return text.toString().padEnd(length, " ");
};

const padLeft = (text, length) => {
  return text.toString().padStart(length, " ");
};

const generateBillPDF = async (req, res, next) => {
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

    const monthName = new Date(year, month - 1).toLocaleString("en-IN", {
      month: "long",
    });

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    //FIFO
    const entries = await TeaEntry.find({
      date_time: { $gte: start, $lte: end },
    }).sort({ date_time: 1 });

    if (!entries.length) {
      return res.status(404).json({ message: "No data found" });
    }

    //  CALCULATIONS (FIFO ORDER)
    let totalAmount = 0;
    let totalCups = 0;

    // Already FIFO because of sort
    for (const e of entries) {
      const qty = e.cup_count || 0;
      const rate = e.price_per_cup || 0;

      totalCups += qty;
      totalAmount += qty * rate;
    }

    const currentPrice = entries[entries.length - 1]?.price_per_cup || 0;

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=tea-bill-${month}-${year}.pdf`,
    );

    doc.pipe(res);

    //  HEADER
    doc.font("Courier-Bold").fontSize(22).text("TEA COUNTER", {
      align: "center",
    });

    doc.moveDown(0.2);

    doc.font("Courier").fontSize(14).text(`(${monthName}-${year})`, {
      align: "center",
    });

    doc.moveDown(0.7);
    doc.text("-----------------------------------------------------------");
    doc.moveDown(1);

    //  INFO
    doc.font("Courier").fontSize(14);

    doc.text(`Total Cups       : ${totalCups}`);
    doc.text(`Current Price    : ${currentPrice}`);
    doc.text(`Total Amount     : ${totalAmount}`);

    doc.moveDown(1);

    //  PAGINATION TABLE
    let index = 1;
    let rowCount = 0;
    const ROWS_PER_PAGE = 20;

    const drawTableHeader = () => {
      doc.font("Courier-Bold").fontSize(15);

      const header =
        padRight("#", 4) +
        padRight("Date", 12) +
        padRight("Time", 12) +
        padLeft("Per Cup", 6) +
        padLeft("Cups", 9) +
        padLeft("Total", 10);

      doc.text("--------------------------------------------------------");
      doc.text(header);
      doc.text("--------------------------------------------------------");

      doc.font("Courier").fontSize(14);
    };

    drawTableHeader();

    entries.forEach((e) => {
      if (rowCount === ROWS_PER_PAGE) {
        doc.addPage();
        drawTableHeader();
        rowCount = 0;
      }

      const dateObj = new Date(e.date_time);

      const formattedDate = dateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
      });

      const timeObj = new Date(e.createdAt);

      const formattedTime = timeObj
        .toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        })
        .toUpperCase();

      const qty = e.cup_count || 0;
      const rate = e.price_per_cup || 0;
      const amount = qty * rate;

      const row =
        padRight(index, 4) +
        padRight(formattedDate, 12) +
        padRight(formattedTime, 12) +
        padLeft(rate, 9) +
        padLeft(qty, 10) +
        padLeft(amount, 11);

      doc.text(row);
      doc.moveDown(0.7);

      index++;
      rowCount++;
    });

    // TOTAL ROW
    doc.text("------------------------------------------------------------");

    const totalRow =
      padRight("Total", 28) +
      padLeft("", 6) +
      padLeft(totalCups, 7) +
      padLeft(totalAmount, 10);

    doc.font("Courier-Bold").fontSize(16).text(totalRow);

    doc.text("-----------------------------------------------------");

    //  FOOTER
    doc.moveDown(1);
    doc.font("Courier").fontSize(14).text("Thank You! Visit Again ", {
      align: "center",
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate bill" });
  }
};
module.exports = {
  addEntry,
  getTodayEntries,
  getMonthlyEntries,
  updateEntry,
  deleteEntry,

  getMonthlySummary,
  generateBillPDF,
};
