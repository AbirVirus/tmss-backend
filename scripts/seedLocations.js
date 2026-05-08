/**
 * Seed Bangladesh location hierarchy from GeoJSON or structured JSON files.
 *
 * Data sources (free):
 * - Bangladesh GeoJSON (divisions/districts/upazilas): https://github.com/fahimzubayer/bangladesh-geojson
 * - Or download from: https://data.humdata.org/dataset/cod-ab-bgd (Humanitarian Data Exchange)
 *
 * The BD GeoJSON typically has structure: features[].properties with:
 *   ADM1_EN (Division), ADM2_EN (District), ADM3_EN (Upazila), ADM4_EN (Union)
 *
 * For Village/Para level, you'll need to add those manually through the API/app
 * as that granularity isn't available in standard free datasets.
 *
 * Usage:
 *   1. Download the BD admin boundary GeoJSON from the sources above
 *   2. Place it at backend/data/bangladesh-districts.json (or similar)
 *   3. Run: node scripts/seedLocations.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Location = require('../models/Location');

const GEOJSON_PATH = path.join(__dirname, '..', 'data', 'bangladesh-districts.json');

async function seedFromGeoJSON() {
  if (!fs.existsSync(GEOJSON_PATH)) {
    console.log(`GeoJSON not found at ${GEOJSON_PATH}`);
    console.log('');
    console.log('How to get the Bangladesh GeoJSON:');
    console.log('1. Visit: https://github.com/fahimzubayer/bangladesh-geojson');
    console.log('2. Download the appropriate admin-level GeoJSON file');
    console.log('3. Place it at: backend/data/bangladesh-districts.json');
    console.log('');
    console.log('Using built-in sample data instead...');
    seedSampleData();
    return;
  }

  const geojson = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf-8'));

  let inserted = 0;
  for (const feature of geojson.features) {
    const p = feature.properties;
    const location = {
      division: p.ADM1_EN || p.Division || p.division || '',
      district: p.ADM2_EN || p.District || p.district || '',
      upazila: p.ADM3_EN || p.Upazila || p.upazila || '',
      union: p.ADM4_EN || p.Union || p.union || 'Default Union',
      village: p.Village || p.village || 'Default Village',
      para: p.Para || p.para || 'Default Para'
    };

    // Skip incomplete entries
    if (!location.division || !location.district) continue;

    const exists = await Location.findOne({
      division: location.division,
      district: location.district,
      upazila: location.upazila,
      union: location.union,
      village: location.village,
      para: location.para
    });

    if (!exists) {
      await Location.create(location);
      inserted++;
    }
  }

  console.log(`Seeded ${inserted} locations from GeoJSON`);
}

async function seedSampleData() {
  const samples = [
    // Rajshahi Division
    { division: 'Rajshahi', district: 'Rajshahi', upazila: 'Paba', union: 'Haripur', village: 'Haripur Bazar', para: 'Paschim Para' },
    { division: 'Rajshahi', district: 'Rajshahi', upazila: 'Paba', union: 'Haripur', village: 'Haripur Bazar', para: 'Purba Para' },
    { division: 'Rajshahi', district: 'Rajshahi', upazila: 'Paba', union: 'Haripur', village: 'Nurpur', para: 'Uttar Para' },
    { division: 'Rajshahi', district: 'Rajshahi', upazila: 'Paba', union: 'Damkura', village: 'Damkura', para: 'Madhya Para' },
    { division: 'Rajshahi', district: 'Rajshahi', upazila: 'Paba', union: 'Damkura', village: 'Nandigram', para: 'Dakshin Para' },
    { division: 'Rajshahi', district: 'Rajshahi', upazila: 'Godagari', union: 'Godagari', village: 'Godagari Bazar', para: 'Bazar Para' },
    { division: 'Rajshahi', district: 'Natore', upazila: 'Natore Sadar', union: 'Boraigram', village: 'Boraigram', para: 'Uttar Para' },
    { division: 'Rajshahi', district: 'Natore', upazila: 'Natore Sadar', union: 'Chanchkoir', village: 'Chanchkoir', para: 'Purba Para' },
    // Dhaka Division
    { division: 'Dhaka', district: 'Dhaka', upazila: 'Savar', union: 'Savar', village: 'Hemayetpur', para: 'Taltola' },
    { division: 'Dhaka', district: 'Dhaka', upazila: 'Savar', union: 'Dhamrai', village: 'Dhamrai', para: 'Bazar Para' },
    { division: 'Dhaka', district: 'Gazipur', upazila: 'Gazipur Sadar', union: 'Gazipur', village: 'Tongi', para: 'Station Road' },
    // Chittagong Division
    { division: 'Chittagong', district: 'Chittagong', upazila: 'Hathazari', union: 'Hathazari', village: 'Fatikchhari', para: 'Madhya Para' },
    { division: 'Chittagong', district: 'Chittagong', upazila: 'Patiya', union: 'Patiya', village: 'Patiya Bazar', para: 'Dakshin Para' },
    // Khulna Division
    { division: 'Khulna', district: 'Khulna', upazila: 'Dumuria', union: 'Dumuria', village: 'Dumuria Bazar', para: 'Paschim Para' },
    { division: 'Khulna', district: 'Jessore', upazila: 'Jessore Sadar', union: 'Chanchra', village: 'Chanchra', para: 'Uttar Para' },
    // Barisal Division
    { division: 'Barisal', district: 'Barisal', upazila: 'Barisal Sadar', union: 'Chandpasha', village: 'Chandpasha', para: 'Purba Para' },
    { division: 'Barisal', district: 'Patuakhali', upazila: 'Patuakhali Sadar', union: 'Lohalia', village: 'Lohalia', para: 'Madhya Para' },
    // Sylhet Division
    { division: 'Sylhet', district: 'Sylhet', upazila: 'Sylhet Sadar', union: 'Tuker Bazar', village: 'Tuker Bazar', para: 'Dakshin Para' },
    { division: 'Sylhet', district: 'Moulvibazar', upazila: 'Moulvibazar Sadar', union: 'Khalilpur', village: 'Khalilpur', para: 'Uttar Para' },
    // Rangpur Division
    { division: 'Rangpur', district: 'Rangpur', upazila: 'Rangpur Sadar', union: 'Darshana', village: 'Darshana', para: 'Paschim Para' },
    { division: 'Rangpur', district: 'Dinajpur', upazila: 'Dinajpur Sadar', union: 'Chetara', village: 'Chetara', para: 'Purba Para' },
    // Mymensingh Division
    { division: 'Mymensingh', district: 'Mymensingh', upazila: 'Mymensingh Sadar', union: 'Bhavok', village: 'Bhavok', para: 'Madhya Para' },
    { division: 'Mymensingh', district: 'Netrokona', upazila: 'Netrokona Sadar', union: 'Amtola', village: 'Amtola', para: 'Dakshin Para' }
  ];

  let inserted = 0;
  for (const loc of samples) {
    const exists = await Location.findOne(loc);
    if (!exists) {
      await Location.create(loc);
      inserted++;
    }
  }
  console.log(`Seeded ${inserted} sample locations`);
}

// Connect and run
mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected');
    await seedFromGeoJSON();
    console.log('Done. Disconnecting...');
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
