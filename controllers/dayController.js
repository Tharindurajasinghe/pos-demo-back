const ActiveDay = require('../models/ActiveDay');
const Bill = require('../models/Bill');
const Product = require('../models/Product');
const DailySummary = require('../models/DailySummary');
const moment = require('moment-timezone');

// Get today's summary (up to now) - BACKWARD COMPATIBLE
const getCurrentDaySummary = async (req, res) => {
  try {
    const today = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
    const bills = await Bill.find({ dayIdentifier: today });

    const itemsMap = new Map();
    let totalSales = 0;
    let totalProfit = 0;
    
    for (const bill of bills) {
      totalSales += bill.totalAmount;
      
      for (const item of bill.items) {
        // Profit = Selling Price - Buying Price
        // Handle old bills that might not have buyingPrice
        const buyingPrice = item.buyingPrice || 0;
        const profit = (item.price - buyingPrice) * item.quantity;
        totalProfit += profit;

        // Create unique key using productId + variant (with fallback for old data)
        const variant = item.variant || 'Standard';
        const itemKey = `${item.productId}_${variant}`;
        
        if (itemsMap.has(itemKey)) {
          const existing = itemsMap.get(itemKey);
          existing.soldQuantity += item.quantity;
          existing.totalIncome += item.total;
          existing.profit += profit;
        } else {
          itemsMap.set(itemKey, {
            productId: item.productId,
            name: item.name,
            variant: variant,
            soldQuantity: item.quantity,
            totalIncome: item.total,
            profit
          });
        }
      }
    }
    
    res.json({
      date: today,
      totalSales,
      totalProfit,
      billCount: bills.length,
      items: Array.from(itemsMap.values()),
      bills
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// End day and create summary - BACKWARD COMPATIBLE
const endDay = async (req, res) => {
  try {
    const today = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
    const bills = await Bill.find({ dayIdentifier: today });
    
    const itemsMap = new Map();
    let totalIncome = 0;
    let totalProfit = 0;

    for (const bill of bills) {
      for (const item of bill.items) {
        // Profit = Selling Price - Buying Price
        // Handle old bills that might not have buyingPrice
        const buyingPrice = item.buyingPrice || 0;
        const profit = (item.price - buyingPrice) * item.quantity;
        
        // Create unique key using productId + variant (with fallback for old data)
        const variant = item.variant || 'Standard';
        const itemKey = `${item.productId}_${variant}`;
        
        if (itemsMap.has(itemKey)) {
          const existing = itemsMap.get(itemKey);
          existing.soldQuantity += item.quantity;
          existing.totalIncome += item.total;
          existing.profit += profit;
        } else {
          itemsMap.set(itemKey, {
            productId: item.productId,
            name: item.name,
            variant: variant,
            soldQuantity: item.quantity,
            totalIncome: item.total,
            profit
          });
        }
        totalIncome += item.total;
        totalProfit += profit;
      }
    }

    const summary = await DailySummary.create({
      date: today,
      items: Array.from(itemsMap.values()),
      totalIncome,
      totalProfit,
      endedAt: moment().tz('Asia/Colombo').toDate()
    });

    // Mark day as ended
    const activeDay = await ActiveDay.findOne({ date: today });
    if (activeDay) {
      activeDay.isActive = false;
      await activeDay.save();
    }

    res.json(summary);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  getCurrentDaySummary,
  endDay
};