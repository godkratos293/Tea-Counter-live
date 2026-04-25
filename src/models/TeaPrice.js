const mongoose = require("mongoose");

const teaPriceSchema = new mongoose.Schema({
  price_per_cup: {
    type: Number,
    required: true,
  },
  effective_from: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model("TeaPrice", teaPriceSchema);
