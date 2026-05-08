const axios = require('axios');

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';

// OSRM expects [lon, lat] ordering, not [lat, lon]
function toCoord(point) {
  return `${point.lng},${point.lat}`;
}

/**
 * Calculate road distance via OSRM between origin, waypoints, and destination.
 * Uses trip service when waypoints exist, route service for simple A->B.
 */
async function calculateRouteDistance(origin, destination, waypoints = []) {
  const allPoints = [origin, ...waypoints, destination];

  if (allPoints.length === 2) {
    return simpleRoute(origin, destination);
  }

  return tripRoute(allPoints);
}

/**
 * Simple A->B route via OSRM /route/v1
 */
async function simpleRoute(origin, destination) {
  const coords = `${toCoord(origin)};${toCoord(destination)}`;
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coords}`;

  const { data } = await axios.get(url, {
    params: { overview: 'full', steps: false, geometries: 'geojson' }
  });

  if (!data.routes || data.routes.length === 0) {
    throw new Error('OSRM: No route found');
  }

  const route = data.routes[0];
  const distanceMeters = route.distance;
  const durationSeconds = route.duration;

  const leg = {
    from: origin.name || 'Start',
    to: destination.name || 'End',
    distanceKm: +(distanceMeters / 1000).toFixed(2),
    durationMin: Math.round(durationSeconds / 60)
  };

  return {
    totalDistanceKm: leg.distanceKm,
    totalDurationMin: leg.durationMin,
    legs: [leg],
    geometry: route.geometry
  };
}

/**
 * Multi-waypoint trip via OSRM /trip/v1 (solves TSP + routing)
 * Falls back to sequential routes if trip service fails.
 */
async function tripRoute(points) {
  const coords = points.map(toCoord).join(';');
  const url = `${OSRM_BASE_URL}/trip/v1/driving/${coords}`;

  try {
    const { data } = await axios.get(url, {
      params: {
        overview: 'full',
        steps: false,
        geometries: 'geojson',
        source: 'first',
        destination: 'last',
        roundtrip: false
      }
    });

    if (data.trips && data.trips.length > 0) {
      const trip = data.trips[0];
      const distanceMeters = trip.distance;
      const durationSeconds = trip.duration;
      const legs = trip.legs.map((leg, i) => ({
        from: points[data.waypoints[i]?.waypoint_index]?.name || points[i]?.name || `Stop ${i}`,
        to: points[data.waypoints[i + 1]?.waypoint_index]?.name || points[i + 1]?.name || `Stop ${i + 1}`,
        distanceKm: +(leg.distance / 1000).toFixed(2),
        durationMin: Math.round(leg.duration / 60)
      }));

      return {
        totalDistanceKm: +(distanceMeters / 1000).toFixed(2),
        totalDurationMin: Math.round(durationSeconds / 60),
        legs,
        geometry: trip.geometry
      };
    }
  } catch (e) {
    console.warn('OSRM trip service failed, falling back to sequential routes:', e.message);
  }

  // Fallback: sequential simple routes
  return sequentialRoutes(points);
}

/**
 * Fallback: chain simple A->B routes sequentially
 */
async function sequentialRoutes(points) {
  let totalDistanceKm = 0;
  let totalDurationMin = 0;
  const legs = [];

  for (let i = 0; i < points.length - 1; i++) {
    const subResult = await simpleRoute(points[i], points[i + 1]);
    totalDistanceKm += subResult.totalDistanceKm;
    totalDurationMin += subResult.totalDurationMin;
    legs.push(subResult.legs[0]);

    // Rate-limit courtesy delay between sequential calls
    if (i < points.length - 2) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return {
    totalDistanceKm: +totalDistanceKm.toFixed(2),
    totalDurationMin: Math.round(totalDurationMin),
    legs
  };
}

/**
 * Calculate distance/duration matrix between multiple points
 * POST to /table/v1/driving with annotations=distance,duration
 */
async function calculateDistanceMatrix(origins, destinations) {
  const allPoints = [...origins, ...destinations];
  const coords = allPoints.map(toCoord).join(';');

  const url = `${OSRM_BASE_URL}/table/v1/driving/${coords}`;

  const { data } = await axios.get(url, {
    params: { annotations: 'distance,duration' }
  });

  if (!data.distances) {
    throw new Error('OSRM: No distance matrix returned');
  }

  const results = [];
  for (let i = 0; i < origins.length; i++) {
    for (let j = 0; j < destinations.length; j++) {
      const dist = data.distances[i]?.[origins.length + j];
      const dur = data.durations[i]?.[origins.length + j];
      if (dist != null) {
        results.push({
          fromIndex: i,
          toIndex: j,
          distanceKm: +(dist / 1000).toFixed(2),
          durationMin: Math.round(dur / 60)
        });
      }
    }
  }

  return results;
}

/**
 * Haversine straight-line distance (fallback when OSRM is unreachable)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Fallback: straight-line haversine route through all points
 */
async function calculateHaversineRoute(points) {
  let totalDistanceKm = 0;
  const legs = [];

  for (let i = 0; i < points.length - 1; i++) {
    const dist = haversineDistance(
      points[i].lat, points[i].lng,
      points[i + 1].lat, points[i + 1].lng
    );
    totalDistanceKm += dist;
    legs.push({
      from: points[i].name || `Stop ${i}`,
      to: points[i + 1].name || `Stop ${i + 1}`,
      distanceKm: +dist.toFixed(2),
      durationMin: Math.round(dist / 40 * 60)
    });
  }

  return {
    totalDistanceKm: +totalDistanceKm.toFixed(2),
    totalDurationMin: Math.round(totalDistanceKm / 40 * 60),
    legs
  };
}

module.exports = {
  calculateRouteDistance,
  calculateDistanceMatrix,
  calculateHaversineRoute,
  haversineDistance
};
