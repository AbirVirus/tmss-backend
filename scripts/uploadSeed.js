/**
 * Upload pre-built seed data to the Vercel API in batches.
 * Usage: node scripts/uploadSeed.js [apiBaseUrl] [batchSize]
 */
const fs = require('fs');
const path = require('path');

const API_BASE = process.argv[2] || 'https://tmss-backend.vercel.app/api';
const BATCH_SIZE = parseInt(process.argv[3]) || 200;
const SEED_FILE = path.join(__dirname, '..', 'data', 'bangladesh-seed.json');

async function main() {
  if (!fs.existsSync(SEED_FILE)) {
    console.error('Seed file not found. Run "node scripts/buildSeedData.js > data/bangladesh-seed.json" first.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
  console.log(`Loaded ${data.length} locations. Seeding in batches of ${BATCH_SIZE}...`);

  let totalInserted = 0;
  let totalMatched = 0;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length));
    const progress = Math.min(i + BATCH_SIZE, data.length);

    try {
      const res = await fetch(`${API_BASE}/locations/seed-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch)
      });
      const result = await res.json();

      if (result.error) {
        console.error(`Batch ${i}-${progress} failed: ${result.error}`);
        continue;
      }

      totalInserted += result.inserted || 0;
      totalMatched += result.matched || 0;
      console.log(`Progress: ${progress}/${data.length} — batch: ${result.inserted} new, ${result.matched} existing`);
    } catch (err) {
      console.error(`Batch ${i}-${progress} failed: ${err.message}`);
    }

    // Small delay to avoid overwhelming the serverless function
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone! Total: ${totalInserted} inserted, ${totalMatched} already existed`);
}

main().catch(err => { console.error(err); process.exit(1); });
