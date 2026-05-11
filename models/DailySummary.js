const mongoose = require('mongoose');

const dailySummarySchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true // YYYY-MM-DD
  },
  items: [{
    productId: String,
    name: String,
    variant: { type: String, default: 'Standard' },  // Optional for backward compatibility
    soldQuantity: Number,
    totalIncome: Number,
    profit: Number
  }],
  totalIncome: {
    type: Number,
    required: true
  },
  totalProfit: {
    type: Number,
    required: true
  },
  endedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('DailySummary', dailySummarySchema);