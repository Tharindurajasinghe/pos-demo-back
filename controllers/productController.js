const Product = require('../models/Product');

// Get next available product ID
const getNextProductId = async (req, res) => {
  try {
    const products = await Product.find().sort({ productId: 1 });
    const usedIds = new Set(products.map(p => parseInt(p.productId)));
    
    for (let i = 1; i <= 999; i++) {
      if (!usedIds.has(i)) {
        return res.json({ productId: i.toString().padStart(3, '0') });
      }
    }
    
    res.status(400).json({ message: 'No available product IDs' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all products
const getAllProducts = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const filter = categoryId ? { categoryId } : {};
    const products = await Product.find(filter).sort({ productId: 1, variant: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Search product by barcode (exact match)
const searchByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    if (!barcode || !barcode.trim()) {
      return res.status(400).json({ message: 'Barcode is required' });
    }
    const product = await Product.findOne({ barcode:  { $regex: `^${barcode.trim()}$`, $options: 'i' }});
    if (!product) {
      return res.status(404).json({ message: 'No product found for this barcode' });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Search products by name (case-insensitive)
const searchProducts = async (req, res) => {
  try {
    const { query } = req.query;
    const products = await Product.find({
      name: { $regex: query, $options: 'i' }
    }).limit(20);
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get product by ID (BACKWARD COMPATIBLE)
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { variant } = req.query;
    
    // If variant is specified, get that specific variant
    if (variant) {
      const product = await Product.findOne({ productId: id, variant });
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      return res.json(product);
    }
    
    // If no variant specified, get all variants of this product
    const products = await Product.find({ productId: id });
    
    if (products.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // If only one variant exists, return it directly (backward compatible)
    if (products.length === 1) {
      return res.json(products[0]);
    }
    
    // If multiple variants exist, return all
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all variants of a product
const getProductVariants = async (req, res) => {
  try {
    const variants = await Product.find({ productId: req.params.id }).sort({ variant: 1 });
    if (variants.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(variants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add new product (BACKWARD COMPATIBLE - variant, unit and barcode are optional)
const addProduct = async (req, res) => {
  try {
    const { productId, name, variant, categoryId, stock, buyingPrice, sellingPrice, unit, barcode } = req.body;
    
    // Use 'Standard' as default variant if not provided (backward compatible)
    const finalVariant = variant || 'Standard';
    
    // Use 'unit' as default unit if not provided (backward compatible)
    const finalUnit = unit || 'unit';
    
    // Validate unit
    const validUnits = ['Kg', 'g', 'L', 'ml', 'unit'];
    if (!validUnits.includes(finalUnit)) {
      return res.status(400).json({ message: 'Invalid unit. Must be one of: Kg, g, L, ml, unit' });
    }
    
    // Check if this exact combination exists
    const existing = await Product.findOne({ productId, variant: finalVariant });
    if (existing) {
      return res.status(400).json({ message: 'Product with this variant already exists' });
    }
    
    if (!/^[0-9]{3}$/.test(productId) || parseInt(productId) < 1 || parseInt(productId) > 999) {
      return res.status(400).json({ message: 'Invalid product ID. Must be between 001-999' });
    }
    
    // Verify category exists
    const Category = require('../models/Category');
    const category = await Category.findOne({ categoryId });
    if (!category) {
      return res.status(400).json({ message: 'Category not found' });
    }
    
    // Validate stock based on unit
    // For unit (piece/item), stock must be integer
    // For Kg, g, L, ml - stock can be decimal
    if (finalUnit === 'unit') {
      if (!Number.isInteger(parseFloat(stock))) {
        return res.status(400).json({ message: 'Stock for "unit" must be a whole number (no decimals)' });
      }
    }

    // Validate barcode uniqueness if provided
    const finalBarcode = barcode && barcode.trim() ? barcode.trim() : null;
    if (finalBarcode) {
      const barcodeExists = await Product.findOne({ barcode: finalBarcode });
      if (barcodeExists) {
        return res.status(400).json({ message: 'Barcode already assigned to another product variant' });
      }
    }
    
    const product = new Product({
      productId,
      name,
      variant: finalVariant,
      categoryId,
      stock,
      buyingPrice,
      sellingPrice,
      unit: finalUnit,
      barcode: finalBarcode   // barcode field (null if not provided)
    });
    
    const newProduct = await product.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update product (BACKWARD COMPATIBLE - unit and barcode are optional)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { variant } = req.query;
    const { name, categoryId, stock, buyingPrice, sellingPrice, unit, barcode } = req.body;
    
    // Use 'Standard' as default if variant not provided (backward compatible)
    const finalVariant = variant || 'Standard';
    
    const product = await Product.findOne({ productId: id, variant: finalVariant });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    if (categoryId) {
      const Category = require('../models/Category');
      const category = await Category.findOne({ categoryId });
      if (!category) {
        return res.status(400).json({ message: 'Category not found' });
      }
      product.categoryId = categoryId;
    }
    
    // UPDATE UNIT IF PROVIDED
    if (unit) {
      const validUnits = ['Kg', 'g', 'L', 'ml', 'unit'];
      if (!validUnits.includes(unit)) {
        return res.status(400).json({ message: 'Invalid unit. Must be one of: Kg, g, L, ml, unit' });
      }
      
      // Validate stock based on new unit
      const newStock = stock !== undefined ? stock : product.stock;
      if (unit === 'unit' && !Number.isInteger(parseFloat(newStock))) {
        return res.status(400).json({ message: 'Stock for "unit" must be a whole number (no decimals)' });
      }
      
      product.unit = unit;
    }

    // UPDATE VARIANT NAME: if a new variant name is provided in body, rename it
if (req.body.variant !== undefined && req.body.variant.trim() !== finalVariant) {
  const newVariantName = req.body.variant.trim() || 'Standard';
  // Check no other document with same productId already uses this variant name
  const clash = await Product.findOne({ productId: id, variant: newVariantName, _id: { $ne: product._id } });
  if (clash) {
    return res.status(400).json({ message: `Variant name "${newVariantName}" already exists for this product` });
  }
  product.variant = newVariantName;
}
    
    if (name) product.name = name;
    if (stock !== undefined) {
      // Validate stock based on current unit
      const currentUnit = unit || product.unit;
      if (currentUnit === 'unit' && !Number.isInteger(parseFloat(stock))) {
        return res.status(400).json({ message: 'Stock for "unit" must be a whole number (no decimals)' });
      }
      product.stock = stock;
    }
    if (buyingPrice !== undefined) product.buyingPrice = buyingPrice;
    if (sellingPrice !== undefined) product.sellingPrice = sellingPrice;

    // UPDATE BARCODE: allow setting, changing, or clearing (send "" or null to clear)
    if (barcode !== undefined) {
      const newBarcode = barcode && barcode.trim() ? barcode.trim() : null;
      if (newBarcode) {
        // Check uniqueness — exclude current product
        const barcodeExists = await Product.findOne({
          barcode: newBarcode,
          _id: { $ne: product._id }
        });
        if (barcodeExists) {
          return res.status(400).json({ message: 'Barcode already assigned to another product variant' });
        }
      }
      product.barcode = newBarcode;
    }
    
    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete product (BACKWARD COMPATIBLE)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { variant } = req.query;
    
    // Use 'Standard' as default if variant not provided (backward compatible)
    const finalVariant = variant || 'Standard';
    
    const product = await Product.findOne({ productId: id, variant: finalVariant });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    await Product.deleteOne({ productId: id, variant: finalVariant });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getNextProductId,
  getAllProducts,
  searchProducts,
  searchByBarcode,
  getProductById,
  getProductVariants,
  addProduct,
  updateProduct,
  deleteProduct
};
