const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    match: /^[0-9]{3}$/
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  variant: {
    type: String,
    trim: true,
    default: 'Standard'  // Optional - defaults to 'Standard' for backward compatibility
  },
  stock: {
    type: Number,
    required: true,
    min: 0
  },
  buyingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  categoryId: {                   
    type: String,
    required: true,
    ref: 'Category'
  },
  // ✅ NEW FIELD - Unit of measurement
  unit: {
    type: String,
    enum: ['Kg', 'g', 'L', 'ml', 'unit'],
    default: 'unit',
    required: true
  },
  // Barcode field — optional, unique per variant when provided
  barcode: {
    type: String,
    trim: true,
    default: null,
    sparse: true   // allows multiple null values while enforcing uniqueness on non-null
  }
}, { timestamps: true });

// Compound unique index for productId + variant combination
productSchema.index({ productId: 1, variant: 1 }, { unique: true });

// Unique index for barcode — sparse so null values are ignored
productSchema.index({ barcode: 1 }, { unique: true, sparse: true });

// Index for case-insensitive name search
productSchema.index({ name: 'text' });

module.exports = mongoose.model('Product', productSchema);
