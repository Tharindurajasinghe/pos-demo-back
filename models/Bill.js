const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  billId: {
    type: String,
    required: true,
    unique: true
  },
  customerName: {
    type: String,
    trim: true,
    default: ''   // optional — empty string means no name entered
  },
  items: [{
    productId: String,
    name: String,
    variant: { type: String, default: 'Standard' },  // Optional for backward compatibility
    quantity: Number,
    price: Number,  // This will be the selling price (can be edited by user)
    buyingPrice: Number,  // Store buying price for profit calculation
    originalPrice: { type: Number, default: null },
    total: Number,
    // ✅ NEW FIELD - Unit of measurement for this item
    unit: { type: String, default: 'unit' }  // Store unit with bill for historical accuracy
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  dayIdentifier: {
    type: String,
    required: true // Format: YYYY-MM-DD
  },
  cash: {
     type: Number,
     required : true
  },
  change : {
    type : Number,
    required : true
  }
}, { timestamps: true });

billSchema.index({ dayIdentifier: 1, createdAt: -1 });

module.exports = mongoose.model('Bill', billSchema);
