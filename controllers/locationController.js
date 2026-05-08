const Location = require('../models/Location');

// Bulk seed using insertMany for speed
exports.bulkSeed = async (req, res) => {
  const locations = req.body;
  if (!Array.isArray(locations) || locations.length === 0) {
    return res.status(400).json({ error: 'Provide an array of location objects' });
  }
  try {
    const result = await Location.bulkWrite(
      locations.map(loc => ({
        updateOne: {
          filter: {
            division: loc.division,
            district: loc.district,
            upazila: loc.upazila,
            union: loc.union,
            village: loc.village,
            para: loc.para
          },
          update: { $setOnInsert: loc },
          upsert: true
        }
      })),
      { ordered: false }
    );
    res.json({
      inserted: result.upsertedCount || 0,
      matched: result.matchedCount || 0,
      total: locations.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDivisions = async (req, res) => {
  const divisions = await Location.distinct('division');
  res.json(divisions.sort());
};

exports.getDistricts = async (req, res) => {
  const { division } = req.query;
  const districts = await Location.distinct('district', { division });
  res.json(districts.sort());
};

exports.getUpazilas = async (req, res) => {
  const { division, district } = req.query;
  const upazilas = await Location.distinct('upazila', { division, district });
  res.json(upazilas.sort());
};

exports.getUnions = async (req, res) => {
  const { division, district, upazila } = req.query;
  const unions = await Location.distinct('union', { division, district, upazila });
  res.json(unions.sort());
};

exports.getVillages = async (req, res) => {
  const { division, district, upazila, union } = req.query;
  const villages = await Location.distinct('village', { division, district, upazila, union });
  res.json(villages.sort());
};

exports.getParas = async (req, res) => {
  const { division, district, upazila, union, village } = req.query;
  const paras = await Location.distinct('para', { division, district, upazila, union, village });
  res.json(paras.sort());
};

exports.seedLocations = async (req, res) => {
  const locations = req.body;
  const results = { inserted: 0, skipped: 0 };
  for (const loc of locations) {
    const exists = await Location.findOne({
      division: loc.division, district: loc.district, upazila: loc.upazila,
      union: loc.union, village: loc.village, para: loc.para
    });
    if (!exists) {
      await Location.create(loc);
      results.inserted++;
    } else {
      results.skipped++;
    }
  }
  res.json(results);
};

exports.searchLocations = async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const results = await Location.find({
    $or: [
      { village: { $regex: q, $options: 'i' } },
      { para: { $regex: q, $options: 'i' } },
      { union: { $regex: q, $options: 'i' } }
    ]
  }).limit(20);
  res.json(results);
};
