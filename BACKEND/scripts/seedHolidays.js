const mongoose = require("mongoose");
const Holiday = require("../models/Holiday");
require("dotenv").config();
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

// Common Sri Lankan Poya days and public holidays for 2024-2025
const holidays = [
  { name: "Thai Pongal", date: "2024-01-14", description: "Tamil harvest festival" },
  { name: "Independence Day", date: "2024-02-04", description: "Sri Lanka Independence Day" },
  { name: "Maha Shivarathri Poya", date: "2024-02-26", description: "Full moon poya day" },
  { name: "Mawlid-Ul-Nabi", date: "2024-03-16", description: "Prophet Muhammad's birthday" },
  { name: "Medin Poya", date: "2024-03-28", description: "Full moon poya day" },
  { name: "Sinhala and Tamil New Year", date: "2024-04-14", description: "New Year celebration" },
  { name: "Sinhala and Tamil New Year Holiday", date: "2024-04-15", description: "New Year public holiday" },
  { name: "Baisakh Poya", date: "2024-04-25", description: "Full moon poya day" },
  { name: "Labour Day", date: "2024-05-01", description: "International Workers' Day" },
  { name: "Vesakha Poya", date: "2024-05-23", description: "Birth of Buddha full moon poya" },
  { name: "Poson Poya", date: "2024-06-21", description: "Full moon poya day" },
  { name: "Esala Poya", date: "2024-07-21", description: "Full moon poya day" },
  { name: "Nikini Poya", date: "2024-08-19", description: "Full moon poya day" },
  { name: "Il Full Moon Poya", date: "2024-09-18", description: "Full moon poya day" },
  { name: "Deepavali", date: "2024-11-01", description: "Festival of lights" },
  { name: "Il Poya", date: "2024-11-15", description: "Full moon poya day" },
  { name: "Christmas Day", date: "2024-12-25", description: "Christmas celebration" },
  { name: "Unduvap Poya", date: "2024-12-15", description: "Full moon poya day" },
  
  // 2025 holidays
  { name: "Thai Pongal", date: "2025-01-14", description: "Tamil harvest festival" },
  { name: "Independence Day", date: "2025-02-04", description: "Sri Lanka Independence Day" },
  { name: "Mawlid-Ul-Nabi", date: "2025-03-05", description: "Prophet Muhammad's birthday" },
  { name: "Sinhala and Tamil New Year", date: "2025-04-14", description: "New Year celebration" },
  { name: "Sinhala and Tamil New Year Holiday", date: "2025-04-15", description: "New Year public holiday" },
  { name: "Labour Day", date: "2025-05-01", description: "International Workers' Day" },
  { name: "Deepavali", date: "2025-10-31", description: "Festival of lights" },
  { name: "Christmas Day", date: "2025-12-25", description: "Christmas celebration" },
];

async function seedHolidays() {
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Clear existing holidays (optional - comment out to keep existing)
    // await Holiday.deleteMany({});
    // console.log("Cleared existing holidays");

    let addedCount = 0;
    let skippedCount = 0;

    for (const h of holidays) {
      const date = new Date(h.date);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const existing = await Holiday.findOne({
        date: { $gte: dayStart, $lte: dayEnd }
      });

      if (existing) {
        console.log(`⏭️  Skipped: ${h.name} (${h.date}) - already exists`);
        skippedCount++;
        continue;
      }

      const holiday = new Holiday({
        name: h.name,
        date: date,
        description: h.description
      });

      await holiday.save();
      console.log(`✅  Added: ${h.name} (${h.date})`);
      addedCount++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Added: ${addedCount} holidays`);
    console.log(`   Skipped: ${skippedCount} holidays`);
    console.log(`   Total: ${addedCount + skippedCount} holidays processed`);

    process.exit(0);
  } catch (err) {
    console.error("Error seeding holidays:", err);
    process.exit(1);
  }
}

seedHolidays();
