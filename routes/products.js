const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');

const {
  getNextProductId,
  getAllProducts,
  searchProducts,
  getExpiringProducts,
  searchByBarcode,  // ✅ NEW: Import searchByBarcode
  getProductById,
  getProductVariants,
  addProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// ✅ NEW: Search by barcode (MUST be before /:id route to avoid conflicts)
router.get('/barcode/:barcode', searchByBarcode);

// Get products expiring within 10 days (or already expired)
router.get('/expiring', getExpiringProducts);

// Get next available product ID
router.get('/next-id', getNextProductId);

// Search products by name (case-insensitive)
router.get('/search', searchProducts);

// Get all variants of a product by ID
router.get('/:id/variants', getProductVariants);

// Get products by category
router.get('/category/:categoryId', getAllProducts);

// Get product by ID (BACKWARD COMPATIBLE)
// Usage: 
// - /api/products/001 → Returns single product or all variants
// - /api/products/001?variant=Small → Returns specific variant only
router.get('/:id', getProductById);

// Get all products
router.get('/', getAllProducts);

// Add new product (BACKWARD COMPATIBLE - variant and barcode are optional)
// Old format: { productId, name, categoryId, stock, buyingPrice, sellingPrice }
// With variant: { productId, name, variant, categoryId, stock, buyingPrice, sellingPrice }
// With barcode: { productId, name, variant, categoryId, stock, buyingPrice, sellingPrice, unit, barcode }
router.post('/', addProduct);

// Update product (BACKWARD COMPATIBLE - variant query param is optional, defaults to 'Standard')
// Old usage: /api/products/001
// New usage: /api/products/001?variant=Small
// With barcode: PUT /api/products/001?variant=Small { ...fields, barcode: "123456" }
router.put('/:id', updateProduct);

// Delete product (BACKWARD COMPATIBLE - variant query param is optional, defaults to 'Standard')
// Old usage: /api/products/001
// New usage: /api/products/001?variant=Small
router.delete('/:id', deleteProduct);

module.exports = router;