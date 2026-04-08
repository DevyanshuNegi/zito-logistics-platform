// src/controllers/map.controller.js
// Thin HTTP layer around the free map service

const { geocode, reverseGeocode, route } = require('../services/maps.service');
const { success, error } = require('../utils/response');

exports.search = async (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q) return error(res, 'VALIDATION_ERROR', 'q (query) is required', 422);
    const data = await geocode(q, limit ? Number(limit) : 5);
    return success(res, { results: data });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.reverse = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return error(res, 'VALIDATION_ERROR', 'lat and lng are required', 422);
    const data = await reverseGeocode(lat, lng);
    return success(res, { result: data });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.distance = async (req, res) => {
  try {
    const { from_lat, from_lng, to_lat, to_lng } = req.query;
    if (![from_lat, from_lng, to_lat, to_lng].every(Boolean)) {
      return error(res, 'VALIDATION_ERROR', 'from_lat, from_lng, to_lat, to_lng are required', 422);
    }
    const result = await route(
      { lat: Number(from_lat), lng: Number(from_lng) },
      { lat: Number(to_lat), lng: Number(to_lng) }
    );
    return success(res, result);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
