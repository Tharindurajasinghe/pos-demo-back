const dotenv = require('dotenv');
dotenv.config();  // MUST be first — loads env vars before anything else imports them

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const cron = require('node-cron');

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/api/ping', (req, res) => {
  res.status(200).send('OK');
});

// Connect to MongoDB
connectDB();

//auto create month summary cron job
const scheduleMonthlySummary = require('./cron/monthlySummaryCron');
scheduleMonthlySummary();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/summary', require('./routes/summary'));
app.use('/api/day', require('./routes/day'));
app.use('/api/categories', require('./routes/categories'));

// Auto end day at midnight - BACKWARD COMPATIBLE
cron.schedule('0 0 * * *', async () => {
  console.log('Running auto day-end at midnight Sri Lanka time');
  const moment = require('moment-timezone');
  const ActiveDay = require('./models/ActiveDay');
  const Bill = require('./models/Bill');
  const Product = require('./models/Product');
  const DailySummary = require('./models/DailySummary');
  
  // Get the day that just ended (in Sri Lanka timezone)
  const endedDay = moment().tz('Asia/Colombo').subtract(1, 'minute');
  const endedDayStr = endedDay.format('YYYY-MM-DD');
  
  console.log(`Checking for active day: ${endedDayStr}`);
  
  const activeDay = await ActiveDay.findOne({ date: endedDayStr, isActive: true });
  
  if (activeDay) {
    console.log(`Active day found for ${endedDayStr}, creating summary...`);
    
    // Calculate day summary - BACKWARD COMPATIBLE
    const bills = await Bill.find({ dayIdentifier: endedDayStr });
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

    await DailySummary.create({
      date: endedDayStr,
      items: Array.from(itemsMap.values()),
      totalIncome,
      totalProfit,
      endedAt: new Date()
    });

    activeDay.isActive = false;
    await activeDay.save();
    
    console.log(`Auto day-end completed for ${endedDayStr}`);
  }
}, { timezone: "Asia/Colombo" });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));