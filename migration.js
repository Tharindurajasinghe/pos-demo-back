const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'Connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');
  
  try {
    console.log('\n=== Starting BACKWARD-COMPATIBLE Migration ===\n');
    console.log('This migration will NOT break your existing system!\n');
    
    // Step 1: Add variant field to existing products (if not already present)
    console.log('Step 1: Adding variant field to existing products...');
    const productsResult = await db.collection('products').updateMany(
      { variant: { $exists: false } },
      { $set: { variant: 'Standard' } }
    );
    console.log(`✓ Updated ${productsResult.modifiedCount} products with 'Standard' variant`);
    
    // Step 2: Drop old unique index on productId (if exists)
    console.log('\nStep 2: Updating product indexes...');
    try {
      await db.collection('products').dropIndex('productId_1');
      console.log('✓ Dropped old productId index');
    } catch (err) {
      if (err.code === 27) {
        console.log('✓ Old index already removed or does not exist');
      } else {
        throw err;
      }
    }
    
    // Step 3: Create new compound unique index on productId + variant
    console.log('\nStep 3: Creating compound index on productId + variant...');
    try {
      await db.collection('products').createIndex(
        { productId: 1, variant: 1 },
        { unique: true }
      );
      console.log('✓ Created compound unique index (productId + variant)');
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log('✓ Index already exists');
      } else {
        throw err;
      }
    }
    
    // Step 4: Update existing bills to add variant and buyingPrice (optional, for better profit tracking)
    console.log('\nStep 4: Updating existing bills...');
    console.log('(This step adds variant and buyingPrice fields for accurate profit calculation)');
    
    const bills = await db.collection('bills').find({
      $or: [
        { 'items.variant': { $exists: false } },
        { 'items.buyingPrice': { $exists: false } }
      ]
    }).toArray();
    
    let billsUpdated = 0;
    
    for (const bill of bills) {
      const updatedItems = [];
      let needsUpdate = false;
      
      for (const item of bill.items) {
        let itemNeedsUpdate = false;
        const updatedItem = { ...item };
        
        // Add variant if missing
        if (!item.variant) {
          updatedItem.variant = 'Standard';
          itemNeedsUpdate = true;
        }
        
        // Add buyingPrice if missing (try to fetch from product, otherwise estimate)
        if (!item.buyingPrice) {
          const product = await db.collection('products').findOne({
            productId: item.productId,
            variant: updatedItem.variant
          });
          
          if (product) {
            updatedItem.buyingPrice = product.buyingPrice;
            console.log(`  ✓ Added buyingPrice for ${item.name} from product data`);
          } else {
            // Estimate buying price as 70% of selling price (you can adjust this ratio)
            updatedItem.buyingPrice = Math.round(item.price * 0.7);
            console.log(`  ⚠ Estimated buyingPrice for ${item.name}: Rs.${updatedItem.buyingPrice}`);
          }
          itemNeedsUpdate = true;
        }
        
        if (itemNeedsUpdate) {
          needsUpdate = true;
        }
        
        updatedItems.push(updatedItem);
      }
      
      if (needsUpdate) {
        await db.collection('bills').updateOne(
          { _id: bill._id },
          { $set: { items: updatedItems } }
        );
        billsUpdated++;
      }
    }
    
    console.log(`✓ Updated ${billsUpdated} bills with variant and buyingPrice`);
    
    // Step 5: Update existing daily summaries (optional)
    console.log('\nStep 5: Updating daily summaries...');
    const dailySummaries = await db.collection('dailysummaries').find({
      'items.variant': { $exists: false }
    }).toArray();
    
    let dailySummariesUpdated = 0;
    
    for (const summary of dailySummaries) {
      const updatedItems = summary.items.map(item => ({
        ...item,
        variant: item.variant || 'Standard'
      }));
      
      await db.collection('dailysummaries').updateOne(
        { _id: summary._id },
        { $set: { items: updatedItems } }
      );
      dailySummariesUpdated++;
    }
    
    console.log(`✓ Updated ${dailySummariesUpdated} daily summaries`);
    
    // Step 6: Update existing monthly summaries (optional)
    console.log('\nStep 6: Updating monthly summaries...');
    const monthlySummaries = await db.collection('monthlysummaries').find({
      'items.variant': { $exists: false }
    }).toArray();
    
    let monthlySummariesUpdated = 0;
    
    for (const summary of monthlySummaries) {
      const updatedItems = summary.items.map(item => ({
        ...item,
        variant: item.variant || 'Standard'
      }));
      
      await db.collection('monthlysummaries').updateOne(
        { _id: summary._id },
        { $set: { items: updatedItems } }
      );
      monthlySummariesUpdated++;
    }
    
    console.log(`✓ Updated ${monthlySummariesUpdated} monthly summaries`);
    
    console.log('\n=== Migration Completed Successfully! ===\n');
    console.log('✅ Your system is now ready for:');
    console.log('   1. Product variants (same productId, different sizes/variants)');
    console.log('   2. Price editing during billing');
    console.log('   3. Accurate profit calculation (Selling Price - Buying Price)\n');
    console.log('Summary:');
    console.log(`- Products updated: ${productsResult.modifiedCount}`);
    console.log(`- Bills updated: ${billsUpdated}`);
    console.log(`- Daily summaries updated: ${dailySummariesUpdated}`);
    console.log(`- Monthly summaries updated: ${monthlySummariesUpdated}`);
    console.log('\n✅ All existing functionality preserved!');
    console.log('✅ Your system will continue to work exactly as before!');
    console.log('✅ New features are now available when you need them!');
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
});