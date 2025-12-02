const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');
const { cache, CACHE_KEYS } = require('../middleware/cache');

// Rates API endpoints - supports both destination and town fields for backward compatibility
router.get('/', async (req, res) => {
  try {
    const { origin, province, destination, town } = req.query;
    const searchTerm = destination || town;

    // Create cache key based on query parameters
    const cacheKey = `rates:${JSON.stringify({ origin, province, destination, town })}`;

    // Check cache first
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    let queryStr = 'SELECT * FROM rates WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (origin) {
      queryStr += ` AND LOWER(origin) LIKE $${paramCount}`;
      params.push(`%${origin.toLowerCase()}%`);
      paramCount++;
    }

    if (province) {
      queryStr += ` AND LOWER(province) LIKE $${paramCount}`;
      params.push(`%${province.toLowerCase()}%`);
      paramCount++;
    }

    if (searchTerm) {
      queryStr += ` AND (LOWER(town) LIKE $${paramCount} OR LOWER(origin) LIKE $${paramCount} OR LOWER(province) LIKE $${paramCount})`;
      params.push(`%${searchTerm.toLowerCase()}%`);
    }

    const result = await query(queryStr, params);

    // Cache the result
    cache.set(cacheKey, result.rows);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { query: searchQuery } = req.query;

    if (!searchQuery) {
      const result = await query('SELECT * FROM rates LIMIT 10');
      return res.json(result.rows);
    }

    const searchTerm = `%${searchQuery.toLowerCase()}%`;
    const result = await query(`
      SELECT * FROM rates
      WHERE LOWER(origin) LIKE $1
         OR LOWER(province) LIKE $1
         OR LOWER(town) LIKE $1
      ORDER BY created_at DESC
    `, [searchTerm]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error searching rates:', error);
    res.status(500).json({ error: 'Failed to search rates' });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO rates (origin, province, town, rate, new_rates, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      req.body.origin,
      req.body.province,
      req.body.town,
      req.body.rate || 0,
      req.body.newRates || req.body.rate || 0
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating rate:', error);
    res.status(500).json({ error: 'Failed to create rate' });
  }
});

router.put('/:origin/:province/:town', async (req, res) => {
  try {
    const { originalOrigin, originalProvince, originalTown, ...updateData } = req.body;

    const result = await query(`
      UPDATE rates
      SET origin = $1, province = $2, town = $3, rate = $4, new_rates = $5, updated_at = CURRENT_TIMESTAMP
      WHERE origin = $6 AND province = $7 AND town = $8
      RETURNING *
    `, [
      updateData.origin || req.body.origin,
      updateData.province || req.body.province,
      updateData.town || req.body.town,
      updateData.rate || updateData.newRates || 0,
      updateData.newRates || updateData.rate || 0,
      req.params.origin,
      req.params.province,
      req.params.town
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rate not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating rate:', error);
    res.status(500).json({ error: 'Failed to update rate' });
  }
});

router.delete('/:origin/:province/:town', async (req, res) => {
  try {
    const result = await query('DELETE FROM rates WHERE origin = $1 AND province = $2 AND town = $3 RETURNING *', [
      req.params.origin,
      req.params.province,
      req.params.town
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rate not found' });
    }
    res.json({ message: 'Rate deleted successfully' });
  } catch (error) {
    console.error('Error deleting rate:', error);
    res.status(500).json({ error: 'Failed to delete rate' });
  }
});

module.exports = router;
