const Bill = require('../models/Bill');
const Product = require('../models/Product');
const ActiveDay = require('../models/ActiveDay');
const moment = require('moment-timezone');

// Generate next bill ID
async function generateBillId() {
  const lastBill = await Bill.findOne().sort({ billId: -1 });
  if (!lastBill) return '10001';
  
  const nextId = parseInt(lastBill.billId) + 1;
  return nextId.toString();
}

const createBill = async (req, res) => {
  try {
    const { items, cash, customerName } = req.body;
    
    let totalAmount = 0;
    const billItems = [];

    // ── FIX 1: Validate ALL items FIRST before touching any stock ──────────
    // Collect resolved product data in a first pass (read-only).
    // Stock is only deducted after every validation passes including cash check.
    // This prevents partial stock deductions when a later item fails validation.
    const resolvedItems = [];

    for (const item of items) {
      // Use 'Standard' as default variant if not provided (BACKWARD COMPATIBLE)
      const finalVariant = item.variant || 'Standard';
      
      // Find product by productId and variant
      const product = await Product.findOne({ 
        productId: item.productId,
        variant: finalVariant
      });
      
      if (!product) {
        return res.status(400).json({ 
          message: `Product ${item.productId}${finalVariant !== 'Standard' ? ' (' + finalVariant + ')' : ''} not found` 
        });
      }
      
      // VALIDATE QUANTITY BASED ON UNIT
      const quantity = parseFloat(item.quantity);
      
      // For "unit" (pieces), quantity must be whole number
      if (product.unit === 'unit' && !Number.isInteger(quantity)) {
        return res.status(400).json({ 
          message: `Quantity for ${product.name} must be a whole number (this product is sold by unit/piece)` 
        });
      }
      
      // For Kg, g, L, ml - allow decimals (e.g., 0.5 Kg, 2.75 L)
      if (quantity <= 0) {
        return res.status(400).json({ 
          message: `Invalid quantity for ${product.name}` 
        });
      }
      
      // Check stock
      if (product.stock < quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.name}${finalVariant !== 'Standard' ? ' (' + finalVariant + ')' : ''}. Available: ${product.stock} ${product.unit}` 
        });
      }
      
      // Use the price provided by user (edited price) or default to selling price
      let finalPrice = item.price !== undefined ? item.price : product.sellingPrice;
      
      // Validate: edited price must be >= buying price
      if (finalPrice < product.buyingPrice) {
        return res.status(400).json({ 
          message: `Price for ${product.name}${finalVariant !== 'Standard' ? ' (' + finalVariant + ')' : ''} cannot be less than buying price (Rs.${product.buyingPrice})` 
        });
      }
      
      const itemTotal = finalPrice * quantity;
      totalAmount += itemTotal;

      // originalPrice: only set when user actually edited the price
      const originalPrice = (item.price !== undefined && item.originalPrice !== undefined)
        ? item.originalPrice
        : null;

      // Store resolved data for second pass
      resolvedItems.push({ product, quantity, finalPrice, originalPrice, itemTotal, finalVariant });

      billItems.push({
        productId: product.productId,
        name: product.name,
        variant: finalVariant,
        quantity: quantity,
        price: finalPrice,
        originalPrice: originalPrice,
        buyingPrice: product.buyingPrice,
        total: itemTotal,
        unit: product.unit
      });
    }

    // ── FIX 1: Cash check BEFORE any stock is touched ──────────────────────
    if (cash < totalAmount) {
      return res.status(400).json({ message: 'Insufficient cash' });
    }

    // ── FIX 1: All validations passed — now deduct stock ───────────────────
    for (const { product, quantity } of resolvedItems) {
      product.stock -= quantity;
      await product.save();
    }

    const change = cash - totalAmount;
    
    // Use Sri Lanka timezone for everything
    const now = moment().tz('Asia/Colombo');
    const billId = await generateBillId();
    const dayIdentifier = now.format('YYYY-MM-DD');
    const time = now.format('hh:mm A');
    
    const bill = new Bill({
      customerName: (customerName || '').trim(),
      billId,
      items: billItems,
      totalAmount,
      date: now.toDate(),
      time,
      cash,
      change,
      dayIdentifier
    });
    
    await bill.save();

    // ── FIX 5: Use $inc for atomic increment on currentTotal ───────────────
    // Prevents race condition where two bills read the same currentTotal
    // and overwrite each other — $inc is a single atomic DB operation
    await ActiveDay.findOneAndUpdate(
      { date: dayIdentifier },
      {
        $inc: { currentTotal: totalAmount },
        $setOnInsert: { startedAt: now.toDate(), isActive: true }
      },
      { upsert: true, new: true }
    );
    
    res.status(201).json(bill);
  } catch (err) {
    // ── FIX 2: If duplicate billId race condition, give clear message ───────
    if (err.code === 11000 && err.message && err.message.includes('billId')) {
      return res.status(400).json({ message: 'Bill ID conflict — please try saving again' });
    }
    res.status(400).json({ message: err.message });
  }
};

// Get all bills for today
const getTodayBills = async (req, res) => {
  try {
    const today = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
    const bills = await Bill.find({ dayIdentifier: today }).sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get bills by date
const getBillsByDate = async (req, res) => {
  try {
    const bills = await Bill.find({ dayIdentifier: req.params.date }).sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get bill by ID
const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findOne({ billId: req.params.billId });
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get bills for past 30 days
const getPast30DaysBills = async (req, res) => {
  try {
    const today = new Date();
    const past30Days = new Date(today);
    past30Days.setDate(past30Days.getDate() - 29);
    
    const bills = await Bill.find({
      date: { $gte: past30Days, $lte: today }
    }).sort({ date: -1 });
    
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete bill by billId (BACKWARD COMPATIBLE - handles bills with/without variants and units)
const deleteBill = async (req, res) => {
  try {
    const { billId } = req.params;
    const bill = await Bill.findOne({ billId });

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Restore stock for each item variant
    for (const item of bill.items) {
      const product = await Product.findOne({ 
        productId: item.productId,
        variant: item.variant || 'Standard'  // Backward compatible
      });
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }
    }

    // Update ActiveDay if today
    const today = moment().tz('Asia/Colombo').format('YYYY-MM-DD');
    if (bill.dayIdentifier === today) {
      const activeDay = await ActiveDay.findOne({ date: today });
      if (activeDay) {
        activeDay.currentTotal -= bill.totalAmount;
        if (activeDay.currentTotal < 0) activeDay.currentTotal = 0;
        await activeDay.save();
      }
    }

    // Delete the bill
    await bill.deleteOne();

    res.json({ message: 'Bill deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createBill,
  getTodayBills,
  getBillsByDate,
  getBillById,
  getPast30DaysBills,
  deleteBill
};
