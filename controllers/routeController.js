const DailyRoute = require('../models/DailyRoute');
const DailyLog = require('../models/DailyLog');
const { calculateRouteDistance, calculateHaversineRoute } = require('../services/osrmService');

/**
 * Save route entry. Supports both methods:
 * - manual_odometer: startOdometer + endOdometer
 * - osrm: startLocation + waypoints + endLocation with coordinate data
 */
exports.calculateAndSave = async (req, res) => {
  try {
    const {
      date, supervisorId, calculationMethod,
      startOdometer, endOdometer,
      startLocation, waypoints, endLocation,
      fuelCostPerKm, travelMode
    } = req.body;

    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);

    const routeData = {
      date: d,
      supervisorId,
      calculationMethod: calculationMethod || 'manual_odometer',
      fuelCostPerKm: fuelCostPerKm || 15,
      travelMode: travelMode || 'motorcycle',
      legs: []
    };

    if (calculationMethod === 'manual_odometer') {
      // Option A: Manual odometer reading
      if (startOdometer == null || endOdometer == null) {
        return res.status(400).json({ error: 'Manual odometer requires startOdometer and endOdometer' });
      }
      routeData.startOdometer = startOdometer;
      routeData.endOdometer = endOdometer;
      routeData.totalDistanceKm = +(endOdometer - startOdometer).toFixed(2);

      // Save optional location names
      if (startLocation?.name) routeData.startLocation = { name: startLocation.name };
      if (endLocation?.name) routeData.endLocation = { name: endLocation.name };
      if (waypoints?.length) {
        routeData.waypoints = waypoints.map((w, i) => ({
          name: w.name || `Stop ${i + 1}`,
          order: i
        }));
      }
    } else {
      // Option B: OSRM road-distance calculation
      if (!startLocation?.lat || !startLocation?.lng) {
        return res.status(400).json({ error: 'OSRM method requires startLocation with lat/lng' });
      }
      if (!endLocation?.lat || !endLocation?.lng) {
        return res.status(400).json({ error: 'OSRM method requires endLocation with lat/lng' });
      }

      routeData.startLocation = startLocation;
      routeData.endLocation = endLocation;
      routeData.waypoints = waypoints || [];

      const validWaypoints = (waypoints || []).filter(w => w.lat && w.lng);

      let result;
      try {
        result = await calculateRouteDistance(startLocation, endLocation, validWaypoints);
      } catch (osrmErr) {
        console.warn('OSRM failed, falling back to Haversine:', osrmErr.message);
        const allPoints = [
          { name: startLocation.name, lat: startLocation.lat, lng: startLocation.lng },
          ...validWaypoints,
          { name: endLocation.name, lat: endLocation.lat, lng: endLocation.lng }
        ];
        result = await calculateHaversineRoute(allPoints);
      }

      routeData.totalDistanceKm = result.totalDistanceKm;
      routeData.legs = result.legs;
      routeData.totalFuelCost = Math.round(result.totalDistanceKm * (fuelCostPerKm || 15));
    }

    // Upsert
    let route = await DailyRoute.findOne({ date: d, supervisorId });
    if (route) {
      Object.assign(route, routeData);
      await route.save();
    } else {
      route = await DailyRoute.create(routeData);
    }

    // Update daily log aggregate
    await DailyLog.findOneAndUpdate(
      { date: d, supervisorId },
      {
        dailyRoute: route._id,
        totalKmTraveled: route.totalDistanceKm,
        totalFuelCost: route.totalFuelCost
      },
      { upsert: true }
    );

    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getByDate = async (req, res) => {
  const { date, supervisorId } = req.query;
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const route = await DailyRoute.findOne({ date: d, supervisorId });
  res.json(route || null);
};

exports.getRange = async (req, res) => {
  const { startDate, endDate, supervisorId } = req.query;
  const routes = await DailyRoute.find({
    date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    supervisorId
  }).sort({ date: -1 });
  res.json(routes);
};

/**
 * Preview OSRM route without saving
 */
exports.calculatePreview = async (req, res) => {
  try {
    const { startLocation, waypoints, endLocation } = req.body;
    const validWaypoints = (waypoints || []).filter(w => w.lat && w.lng);

    let result;
    try {
      result = await calculateRouteDistance(startLocation, endLocation, validWaypoints);
    } catch (osrmErr) {
      const allPoints = [
        { name: startLocation.name, lat: startLocation.lat, lng: startLocation.lng },
        ...validWaypoints,
        { name: endLocation.name, lat: endLocation.lat, lng: endLocation.lng }
      ];
      result = await calculateHaversineRoute(allPoints);
      result._fallback = 'haversine';
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
