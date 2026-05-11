const cron = require('node-cron');
const moment = require('moment-timezone');
const Bill = require('../models/Bill');
const MonthlySummary = require('../models/MonthlySummary');

/**
 * Monthly Summary Cron Job
 *
 * Runs at 00:01 AM on the 1st of every month (Sri Lanka time).
 * Calculates summary for the ENTIRE previous calendar month —
 * e.g. on Feb 1 it covers Jan 1 00:00 → Jan 31 23:59:59
 * This handles 28, 29, 30, and 31 day months correctly.
 */
const scheduleMonthlySummary = () => {
  // Cron: minute=1, hour=0, day=1, every month
  cron.schedule('1 0 1 * *', async () => {
    try {
      const now = moment().tz('Asia/Colombo');

      // Previous month
      const prevMonth    = moment(now).subtract(1, 'month');
      const monthKey     = prevMonth.format('YYYY-MM');
      const monthName    = prevMonth.format('MMMM YYYY');
      const startOfMonth = prevMonth.clone().startOf('month');
      const endOfMonth   = prevMonth.clone().endOf('month');

      console.log(`[Cron] Building monthly summary for ${monthName} (${startOfMonth.format('YYYY-MM-DD')} → ${endOfMonth.format('YYYY-MM-DD')})`);

      // Fetch all bills from the previous calendar month
      const bills = await Bill.find({
        date: {
          $gte: startOfMonth.toDate(),
          $lte: endOfMonth.toDate(),
        }
      });

      if (bills.length === 0) {
        console.log(`[Cron] No bills found for ${monthName} — skipping.`);
        return;
      }

      // Aggregate items by productId + variant
      const itemsMap  = new Map();
      let totalIncome = 0;
      let totalProfit = 0;

      for (const bill of bills) {
        for (const item of bill.items) {
          const buyingPrice = item.buyingPrice || 0;
          const profit      = (item.price - buyingPrice) * item.quantity;
          const variant     = item.variant || 'Standard';
          const itemKey     = `${item.productId}_${variant}`;

          if (itemsMap.has(itemKey)) {
            const existing     = itemsMap.get(itemKey);
            existing.soldQuantity += item.quantity;
            existing.totalIncome  += item.total;
            existing.profit       += profit;
          } else {
            itemsMap.set(itemKey, {
              productId   : item.productId,
              name        : item.name,
              variant,
              soldQuantity: item.quantity,
              totalIncome : item.total,
              profit,
            });
          }

          totalIncome += item.total;
          totalProfit += profit;
        }
      }

      // Save or update the summary
      let summary = await MonthlySummary.findOne({ month: monthKey });

      if (summary) {
        summary.items        = Array.from(itemsMap.values());
        summary.totalIncome  = totalIncome;
        summary.totalProfit  = totalProfit;
        summary.startDate    = startOfMonth.format('YYYY-MM-DD');
        summary.endDate      = endOfMonth.format('YYYY-MM-DD');
        summary.daysIncluded = endOfMonth.diff(startOfMonth, 'days') + 1;
      } else {
        summary = new MonthlySummary({
          month       : monthKey,
          monthName,
          items       : Array.from(itemsMap.values()),
          totalIncome,
          totalProfit,
          startDate   : startOfMonth.format('YYYY-MM-DD'),
          endDate     : endOfMonth.format('YYYY-MM-DD'),
          daysIncluded: endOfMonth.diff(startOfMonth, 'days') + 1,
        });
      }

      await summary.save();
      console.log(`[Cron] ✅ Monthly summary saved for ${monthName} — Income: ${totalIncome.toFixed(2)}, Profit: ${totalProfit.toFixed(2)}, Bills: ${bills.length}`);

      // Keep only last 12 months, delete older ones
      const all = await MonthlySummary.find().sort({ month: -1 });
      if (all.length > 12) {
        const toDelete = all.slice(12);
        for (const old of toDelete) {
          await MonthlySummary.deleteOne({ _id: old._id });
        }
        console.log(`[Cron] Cleaned up ${toDelete.length} old monthly summaries.`);
      }

    } catch (err) {
      console.error('[Cron] ❌ Error creating monthly summary:', err.message);
    }
  }, {
    timezone: 'Asia/Colombo'
  });

  console.log('[Cron] Monthly summary scheduler registered — runs at 00:01 on the 1st of each month (Asia/Colombo).');
};

module.exports = scheduleMonthlySummary;
