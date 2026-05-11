/**
 * Migration Script: Add Barcode Field to Products
 * 
 * This script adds the 'barcode' field to the Product model.
 * All existing products will have barcode = undefined (null)
 * 
 * Run this ONCE after updating the Product model.
 * 
 * Usage:
 *   node scripts/add_barcode_field.js
 */

const mongoose = require('mongoose');
const Product = require('../models/Product');

// Update this with your actual MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jagath-store';

async function addBarcodeField() {
  try {
    console.log('🚀 Starting migration: Add barcode field to products\n');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log(`📍 Database: ${mongoose.connection.name}\n`);

    // Count total products
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in database: ${totalProducts}\n`);

    // Create sparse unique index for barcode
    console.log('🔧 Creating barcode index...');
    await Product.collection.createIndex(
      { barcode: 1 }, 
      { unique: true, sparse: true }
    );
    console.log('✅ Barcode index created (unique, sparse)\n');

    console.log('📝 Notes:');
    console.log('   • Barcode field is now available for all products');
    console.log('   • Existing products have barcode = null (undefined)');
    console.log('   • Barcode is optional - products can exist without barcodes');
    console.log('   • Each barcode must be unique if provided');
    console.log('   • Multiple products can have no barcode (null is allowed)\n');

    console.log('✅ Migration completed successfully\n');

    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    process.exit(1);
  }
}

// Run migration
console.log('\n════════════════════════════════════════════════════════');
console.log('  ADD BARCODE FIELD MIGRATION');
console.log('════════════════════════════════════════════════════════\n');

addBarcodeField();
