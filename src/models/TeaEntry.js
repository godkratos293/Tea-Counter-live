const mongoose = require("mongoose");

const teaEntrySchema = new mongoose.Schema(
  {
    date_time: {
      type: Date,
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    time: {
      type: String,
      required: true,
    },

    cup_count: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Cup count must be a whole number",
      },
    },

    price_per_cup: {
      type: Number,
      required: true,
      min: [1, "Price must be greater than 0"],
    },

    total: {
      type: Number,
      required: true,
    },
    month: {
      type: Number,
    },

    year: {
      type: Number,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("TeaEntry", teaEntrySchema);
