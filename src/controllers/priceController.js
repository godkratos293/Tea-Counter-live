const TeaPrice = require("../models/TeaPrice");

const setPrice = async (req, res) => {
  try {
    const { price } = req.body;

    if (!price || isNaN(price) || price <= 0) {
      return res.status(400).json({
        message: "Valid price is required",
      });
    }

    const newPrice = new TeaPrice({
      price_per_cup: price,
      effective_from: new Date(),
    });

    await newPrice.save();

    res.status(201).json({
      message: "Price updated successfully",
      data: newPrice,
    });
  } catch (error) {
    console.error("Set Price Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getCurrentPrice = async (req, res) => {
  try {
    const priceDoc = await TeaPrice.findOne().sort({
      effective_from: -1,
    });

    if (!priceDoc) {
      return res.status(404).json({
        message: "Price not set",
      });
    }

    res.status(200).json({
      price: priceDoc.price_per_cup,
      effective_from: priceDoc.effective_from,
    });
  } catch (error) {
    console.error("Get Price Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getPriceHistory = async (req, res) => {
  try {
    let { page = 1, limit = 5 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const skip = (page - 1) * limit;

    const history = await TeaPrice.find()
      .sort({ effective_from: -1 })
      .skip(skip)
      .limit(limit);

    const total = await TeaPrice.countDocuments();

    if (!history.length) {
      return res.status(404).json({
        message: "Price history not found",
      });
    }

    res.status(200).json({
      // total,
      // page,
      // limit,
      history,
    });
  } catch (error) {
    console.error("Error fetching price history:", error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  setPrice,
  getCurrentPrice,
  getPriceHistory,
};
