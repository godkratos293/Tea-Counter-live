const TeaPrice = require("../models/TeaPrice");

const getPriceForMonth = async (month, year) => {
  const monthStart = new Date(year, month - 1, 1);

  const priceDoc = await TeaPrice.findOne({
    effective_from: { $lte: monthStart },
  }).sort({ effective_from: -1 });

  return priceDoc ? priceDoc.price : 0;
};

const calculateBilling = (entries, pricePerCup) => {
  const totalCups = entries.reduce((sum, e) => sum + e.cup_count, 0);

  const totalAmount = entries.reduce((sum, e) => {
    return sum + e.cup_count * pricePerCup;
  }, 0);

  return {
    totalCups,
    totalAmount,
  };
};

module.exports = {
  getPriceForMonth,
  calculateBilling,
};
