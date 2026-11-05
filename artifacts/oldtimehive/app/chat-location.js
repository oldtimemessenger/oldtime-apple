const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

function cleanCoordinate(value, maximum) {
  if (!Number.isFinite(value) || value < -maximum || value > maximum) {
    throw new TypeError("Location coordinates are invalid.");
  }
  const rounded = Math.round(value * 100_000) / 100_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function encodeSharedCoordinates(latitude, longitude) {
  const lat = cleanCoordinate(latitude, MAX_LATITUDE);
  const lon = cleanCoordinate(longitude, MAX_LONGITUDE);
  return `${lat},${lon}`;
}

export function parseSharedCoordinates(value) {
  const match = /^(-?(?:\d{1,2}(?:\.\d{1,5})?|90(?:\.0{1,5})?)),(-?(?:\d{1,3}(?:\.\d{1,5})?|180(?:\.0{1,5})?))$/.exec(String(value || "").trim());
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > MAX_LATITUDE || Math.abs(longitude) > MAX_LONGITUDE) return null;
  return {
    latitude,
    longitude,
    mapsUrl: `https://maps.google.com/?q=${latitude},${longitude}`,
  };
}
