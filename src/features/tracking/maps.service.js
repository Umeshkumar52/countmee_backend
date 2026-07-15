import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Calculates travel distance/duration between origin and destination using Google Distance Matrix API
 * @param {number} lat1 - Origin latitude
 * @param {number} lon1 - Origin longitude
 * @param {number} lat2 - Destination latitude
 * @param {number} lon2 - Destination longitude
 * @param {string} mode - 'walking' or 'driving'
 * @returns {Promise<string>} Distance string (e.g., '10.5 km')
 */
export const distanceBetween = async (lat1, lon1, lat2, lon2, mode = 'walking') => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('Google Maps API key is missing');
      return 'API key missing';
    }

    const origin = `${lat1},${lon1}`;
    const destination = `${lat2},${lon2}`;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=${mode}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await axios.get(url, { timeout: 15000 });
    const data = response.data;

    console.log('Google Distance Matrix Call:', { status: data.status, origin, destination });

    if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.distance?.text) {
      return data.rows[0].elements[0].distance.text;
    } else {
      console.error('Google Distance Matrix Error Status:', data.status);
      return 'Something went wrong: ' + (data.status || 'unknown error');
    }
  } catch (error) {
    console.error('Google Distance Matrix connection error:', error.message);
    return 'Connection error';
  }
};

/**
 * Robustly parses Google Maps distance text into numeric kilometers
 * @param {string} distanceStr - e.g., '2,129 km', '500 m'
 * @returns {number} Distance in kilometers
 */
export const parseDistanceTextToKm = (distanceStr) => {
  if (!distanceStr || typeof distanceStr !== "string") return 0;
  // Remove all commas
  const cleanedStr = distanceStr.replace(/,/g, "");
  const val = parseFloat(cleanedStr);
  if (isNaN(val)) return 0;
  
  // If the result is explicitly in meters, convert to kilometers
  const lowerStr = cleanedStr.toLowerCase();
  if (lowerStr.includes(" m") && !lowerStr.includes("km")) {
    return val / 1000;
  }
  return val;
};

/**
 * Filters PDCs along a route from origin to destination
 * @param {Array<object>} pdcs - List of online PDCs
 * @param {string} origin - 'lat,lon' of origin
 * @param {string} destination - 'lat,lon' of destination
 * @param {number} maxRadius - Maximum search radius in meters
 * @returns {Promise<Array<object>|string>} PDCs along the path, or error string
 */
export const pdcAlongWay = async (pdcs, origin, destination, maxRadius) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('Google Maps API key is missing');
      return 'API Key missing';
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url, { timeout: 20000 });
    const directionsData = response.data;

    if (directionsData.status === 'OK' && directionsData.routes?.[0]) {
      const points = directionsData.routes[0].overview_polyline.points;
      const path = decodePolyline(points);
      
      const pdcOnRoute = [];
      for (const pdc of pdcs) {
        if (isPDCOnRoute(pdc, path, maxRadius)) {
          pdcOnRoute.push(pdc);
        }
      }
      return pdcOnRoute;
    } else {
      const status = directionsData.status || 'UNKNOWN_ERROR';
      const detail = directionsData.error_message ? `: ${directionsData.error_message}` : '';
      console.error(`Failed to get directions. Status: ${status}${detail}`);
      return `Failed to get directions. Status: ${status}`;
    }
  } catch (error) {
    console.error('Google Directions API connection error:', error.message);
    return 'Connection error';
  }
};

/**
 * Decodes Google Maps Encoded Polyline algorithm string
 * @param {string} encoded - Encoded polyline points
 * @returns {Array<object>} Decoded coordinates [{lat, lng}]
 */
export const decodePolyline = (encoded) => {
  const len = encoded.length;
  let index = 0;
  const array = [];
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    array.push({
      lat: lat * 1e-5,
      lng: lng * 1e-5
    });
  }
  return array;
};

/**
 * Checks if PDC is near a route path within a radius limit
 */
const isPDCOnRoute = (pdc, path, maxRadius) => {
  for (const point of path) {
    const distance = haversineGreatCircleDistance(
      pdc.latitude,
      pdc.longitude,
      point.lat,
      point.lng
    );
    if (distance < maxRadius) {
      return true;
    }
  }
  return false;
};

/**
 * Haversine Great Circle distance calculator in meters
 */
export const haversineGreatCircleDistance = (lat1, lon1, lat2, lon2, earthRadius = 6371000) => {
  const radLat1 = (Math.PI * lat1) / 180;
  const radLon1 = (Math.PI * lon1) / 180;
  const radLat2 = (Math.PI * lat2) / 180;
  const radLon2 = (Math.PI * lon2) / 180;

  const latDelta = radLat2 - radLat1;
  const lonDelta = radLon2 - radLon1;

  const angle = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin(latDelta / 2), 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(lonDelta / 2), 2)
  ));
  return angle * earthRadius;
};

/**
 * Geocodes an address text to get lat/long coordinates using Google Geocoding API
 * @param {string} address - Full address text
 * @returns {Promise<Array<number|null>>} [latitude, longitude]
 */
export const getLatLongFromAddress = async (address) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('Geocoding API: key missing');
      return [null, null];
    }
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    const json = response.data;

    if (json.status === 'OK' && json.results?.[0]?.geometry?.location) {
      const loc = json.results[0].geometry.location;
      return [loc.lat, loc.lng];
    }
    return [null, null];
  } catch (error) {
    console.error('Geocoding failed:', error.message);
    return [null, null];
  }
};
