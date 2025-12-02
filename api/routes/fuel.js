const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');

// Fuel API endpoints - fresh implementation
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limitParam = req.query.limit;
    const searchQuery = req.query.search ? req.query.search.trim() : '';
    const plateFilter = req.query.plate_number || '';
    let limit, offset;

    if (limitParam === 'all') {
      limit = null;
      offset = 0;
    } else {
      limit = parseInt(limitParam) || 50;
      offset = (page - 1) * limit;
    }

    // Build search condition if searching
    let searchCondition = '';
    let searchParams = [];
    if (searchQuery) {
      searchCondition = `
        WHERE (
          LOWER(plate_number) LIKE LOWER($1) OR
          LOWER(po_number) LIKE LOWER($1) OR
          LOWER(product) LIKE LOWER($1) OR
          LOWER(gas_station) LIKE LOWER($1) OR
          LOWER(status) LIKE LOWER($1) OR
          LOWER(notes) LIKE LOWER($1) OR
          CAST(liters AS TEXT) LIKE $1 OR
          CAST(price_per_liter AS TEXT) LIKE $1 OR
          CAST(amount AS TEXT) LIKE $1
        )
      `;
      searchParams = [`%${searchQuery}%`];
    }

    // Add plate number filter if specified
    if (plateFilter && !searchQuery) {
      searchCondition = 'WHERE plate_number = $1';
      searchParams = [plateFilter];
    } else if (plateFilter && searchQuery) {
      searchCondition += ' AND plate_number = $' + (searchParams.length + 1);
      searchParams.push(plateFilter);
    }

    // For paginated requests
    if (limit !== null) {
      let fuelQuery, countQuery, fuelParams, countParams;

      fuelQuery = `SELECT *, date::text as date FROM fuel ${searchCondition} ORDER BY fuel.date DESC LIMIT $${searchParams.length + 1} OFFSET $${searchParams.length + 2}`;
      countQuery = `SELECT COUNT(*) as total FROM fuel ${searchCondition}`;
      fuelParams = [...searchParams, limit, offset];
      countParams = searchParams;

      const fuelResult = await query(fuelQuery, fuelParams);
      const countResult = await query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);

      // Transform database format to frontend expected format
      const transformedFuel = fuelResult.rows.map(fuel => ({
        id: fuel.id,
        date: fuel.date,
        liters: parseFloat(fuel.liters),
        pricePerLiter: parseFloat(fuel.price_per_liter),
        amount: parseFloat(fuel.amount),
        plateNumber: fuel.plate_number,
        poNumber: fuel.po_number,
        product: fuel.product,
        gasStation: fuel.gas_station,
        status: fuel.status,
        notes: fuel.notes,
        createdAt: fuel.created_at,
        updatedAt: fuel.updated_at
      }));

      return res.json({
        fuel: transformedFuel,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      });
    }

    // For "all" requests
    const countQuery = `SELECT COUNT(*) as total FROM fuel ${searchCondition}`;
    const countResult = await query(countQuery, searchParams);
    const total = parseInt(countResult.rows[0].total);
    const fuelResult = await query(`SELECT *, date::text as date FROM fuel ${searchCondition} ORDER BY date DESC`, searchParams);

    const transformedFuel = fuelResult.rows.map(fuel => ({
      id: fuel.id,
      date: fuel.date,
      liters: parseFloat(fuel.liters),
      pricePerLiter: parseFloat(fuel.price_per_liter),
      amount: parseFloat(fuel.amount),
      plateNumber: fuel.plate_number,
      poNumber: fuel.po_number,
      product: fuel.product,
      gasStation: fuel.gas_station,
      status: fuel.status,
      notes: fuel.notes,
      createdAt: fuel.created_at,
      updatedAt: fuel.updated_at
    }));

    res.json({
      fuel: transformedFuel,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching fuel:', error);
    res.status(500).json({ error: 'Failed to fetch fuel records' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT *, date::text as date FROM fuel WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Fuel record not found' });
    }

    const fuel = result.rows[0];
    const transformedFuel = {
      id: fuel.id,
      date: fuel.date,
      liters: parseFloat(fuel.liters),
      pricePerLiter: parseFloat(fuel.price_per_liter),
      amount: parseFloat(fuel.amount),
      plateNumber: fuel.plate_number,
      poNumber: fuel.po_number,
      product: fuel.product,
      gasStation: fuel.gas_station,
      status: fuel.status,
      notes: fuel.notes,
      createdAt: fuel.created_at,
      updatedAt: fuel.updated_at
    };

    res.json(transformedFuel);
  } catch (error) {
    console.error('Error fetching fuel record:', error);
    res.status(500).json({ error: 'Failed to fetch fuel record' });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Validate required fields
    if (!body.date || !body.liters || !body.pricePerLiter) {
      return res.status(400).json({ error: 'Date, liters, and price_per_liter are required' });
    }

    // Calculate amount if not provided (liters * price_per_liter)
    let amount = body.amount;
    if (!amount && body.liters && body.pricePerLiter) {
      amount = parseFloat(body.liters) * parseFloat(body.pricePerLiter);
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Amount is required or must be calculable from liters and price_per_liter' });
    }

    const result = await query(`
      INSERT INTO fuel (
        date, liters, price_per_liter, amount, plate_number, po_number,
        product, gas_station, status, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *, date::text as date
    `, [
      body.date,
      parseFloat(body.liters),
      parseFloat(body.pricePerLiter),
      parseFloat(amount),
      body.plateNumber || null,
      body.poNumber || null,
      body.product || 'Diesel',
      body.gasStation || null,
      body.status || 'completed',
      body.notes || null
    ]);

    const fuel = result.rows[0];
    const transformedFuel = {
      id: fuel.id,
      date: fuel.date,
      liters: parseFloat(fuel.liters),
      pricePerLiter: parseFloat(fuel.price_per_liter),
      amount: parseFloat(fuel.amount),
      plateNumber: fuel.plate_number,
      poNumber: fuel.po_number,
      product: fuel.product,
      gasStation: fuel.gas_station,
      status: fuel.status,
      notes: fuel.notes,
      createdAt: fuel.created_at,
      updatedAt: fuel.updated_at
    };

    res.status(201).json(transformedFuel);
  } catch (error) {
    console.error('Error creating fuel record:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      error: 'Failed to create fuel record',
      details: error.message,
      code: error.code
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const body = req.body;

    // Validate required fields
    if (!body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    // Map frontend format to database format
    const fieldMapping = {
      date: 'date',
      liters: 'liters',
      pricePerLiter: 'price_per_liter',
      amount: 'amount',
      plateNumber: 'plate_number',
      poNumber: 'po_number',
      product: 'product',
      gasStation: 'gas_station',
      status: 'status',
      notes: 'notes'
    };

    Object.keys(fieldMapping).forEach(frontendKey => {
      if (body[frontendKey] !== undefined) {
        updateFields.push(`${fieldMapping[frontendKey]} = $${paramCount}`);
        values.push(body[frontendKey]);
        paramCount++;
      }
    });

    // Auto-recalculate amount when liters or price_per_liter change
    const existingFuel = await query('SELECT liters, price_per_liter FROM fuel WHERE id = $1', [parseInt(req.params.id)]);
    if (existingFuel.rows.length > 0 && updateFields.length > 0) {
      const currentValues = existingFuel.rows[0];
      const newLiters = body.liters !== undefined ? parseFloat(body.liters) : currentValues.liters;
      const newPricePerLiter = body.pricePerLiter !== undefined ? parseFloat(body.pricePerLiter) : currentValues.price_per_liter;

      if (newLiters && newPricePerLiter && body.amount === undefined) {
        const calculatedAmount = newLiters * newPricePerLiter;
        updateFields.push(`amount = $${paramCount}`);
        values.push(calculatedAmount);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(parseInt(req.params.id)); // Add ID at the end

    const result = await query(`
      UPDATE fuel
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *, date::text as date
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Fuel record not found' });
    }

    const fuel = result.rows[0];
    const transformedFuel = {
      id: fuel.id,
      date: fuel.date,
      liters: parseFloat(fuel.liters),
      pricePerLiter: parseFloat(fuel.price_per_liter),
      amount: parseFloat(fuel.amount),
      plateNumber: fuel.plate_number,
      poNumber: fuel.po_number,
      product: fuel.product,
      gasStation: fuel.gas_station,
      status: fuel.status,
      notes: fuel.notes,
      createdAt: fuel.created_at,
      updatedAt: fuel.updated_at
    };

    res.json(transformedFuel);
  } catch (error) {
    console.error('Error updating fuel record:', error);
    res.status(500).json({ error: 'Failed to update fuel record' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM fuel WHERE id = $1 RETURNING *', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Fuel record not found' });
    }

    res.json({ message: 'Fuel record deleted successfully' });
  } catch (error) {
    console.error('Error deleting fuel record:', error);
    res.status(500).json({ error: 'Failed to delete fuel record' });
  }
});

// Bulk fuel insert endpoint for efficient large imports
router.post('/bulk', async (req, res) => {
  try {
    const body = req.body;

    if (!body.entries || !Array.isArray(body.entries) || body.entries.length === 0) {
      return res.status(400).json({ error: 'Request body must contain a non-empty entries array' });
    }


    const results = {
      total: body.entries.length,
      inserted: 0,
      failed: 0,
      errors: [],
      insertedIds: []
    };

    // Process entries in batches to avoid database timeout issues
    const BATCH_SIZE = 50; // Process in reasonable chunks
    const batches = [];

    for (let i = 0; i < body.entries.length; i += BATCH_SIZE) {
      batches.push(body.entries.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {

      // Prepare batch insert query
      const values = [];
      const placeholders = [];
      let paramIndex = 1;
      const validEntries = [];

      for (const entry of batch) {
        try {
          // Validate required fields
          if (!entry.date || !entry.liters || !entry.pricePerLiter) {
            results.errors.push({
              rowData: JSON.stringify(entry),
              error: 'Missing required fields: date, liters, and pricePerLiter'
            });
            results.failed++;
            continue;
          }

          // Calculate amount if not provided
          let amount = parseFloat(entry.amount || 0);
          if (!amount || amount <= 0) {
            const liters = parseFloat(entry.liters);
            const price = parseFloat(entry.pricePerLiter);
            if (liters > 0 && price > 0) {
              amount = liters * price;
            } else {
              results.errors.push({
                rowData: JSON.stringify(entry),
                error: 'Cannot calculate amount: invalid liters or price_per_liter'
              });
              results.failed++;
              continue;
            }
          }

          // Parse date safely (similar to single insert)
          if (entry.date) {
            const dateStr = entry.date.trim();

            // Check if already YYYY-MM-DD format - leave alone
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              // Format: MM/DD/YYYY or DD/MM/YYYY
              const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
              if (slashMatch) {
                const year = parseInt(slashMatch[3]);
                const month = parseInt(slashMatch[2]); // DD/MM/YYYY preferred
                const day = parseInt(slashMatch[1]);

                if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2050) {
                  entry.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                }
              }

              // Format: "Sep 4, 25"
              const alphaMatch = dateStr.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s*,\s*|\s+)(\d{4}|\d{2})$/);
              if (alphaMatch && !entry.date.includes('-')) {
                const monthName = alphaMatch[1].toLowerCase();
                const day = parseInt(alphaMatch[2]);
                const yearStr = alphaMatch[3];

                let year = parseInt(yearStr);
                if (year < 100) {
                  year = year >= 60 ? year + 1900 : year + 2000;
                }

                const monthMap = {
                  'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                  'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
                };

                const month = monthMap[monthName.substring(0, 3).toLowerCase()];
                if (month && day >= 1 && day <= 31 && year >= 1900 && year <= 2050) {
                  entry.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                }
              }
            }
          }

          // Add to valid entries array
          validEntries.push({
            date: entry.date,
            liters: parseFloat(entry.liters),
            pricePerLiter: parseFloat(entry.pricePerLiter),
            amount: parseFloat(amount),
            plateNumber: entry.plateNumber || null,
            poNumber: entry.poNumber || null,
            product: entry.product || 'Diesel',
            gasStation: entry.gasStation || null,
            notes: entry.notes || null
          });

          // Build placeholders and values for batch insert
          placeholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8})`);
          values.push(validEntries[validEntries.length - 1].date);
          values.push(validEntries[validEntries.length - 1].liters);
          values.push(validEntries[validEntries.length - 1].pricePerLiter);
          values.push(validEntries[validEntries.length - 1].amount);
          values.push(validEntries[validEntries.length - 1].plateNumber);
          values.push(validEntries[validEntries.length - 1].poNumber);
          values.push(validEntries[validEntries.length - 1].product);
          values.push(validEntries[validEntries.length - 1].gasStation);
          values.push(validEntries[validEntries.length - 1].notes);
          paramIndex += 9;

        } catch (entryError) {
          console.error('Error processing entry:', entry, entryError);
          results.errors.push({
            rowData: JSON.stringify(entry),
            error: entryError.message || 'Processing error'
          });
          results.failed++;
        }
      }

      // Execute batch insert if there are valid entries
      if (validEntries.length > 0) {
        try {
          const queryStr = `
            INSERT INTO fuel (date, liters, price_per_liter, amount, plate_number, po_number, product, gas_station, notes)
            VALUES ${placeholders.join(', ')}
            RETURNING id
          `;

          const batchResult = await query(queryStr, values);

          results.inserted += validEntries.length;
          results.insertedIds.push(...batchResult.rows.map(row => row.id));


        } catch (batchError) {
          console.error('Batch insert error:', batchError);
          results.failed += validEntries.length;
          results.errors.push({
            batch: `${validEntries.length} entries`,
            error: `Batch insert failed: ${batchError.message}`
          });
        }
      }
    }


    res.json({
      message: `Successfully imported ${results.inserted}/${results.total} fuel entries`,
      inserted: results.inserted,
      failed: results.failed,
      errors: results.errors.slice(0, 10), // Limit error output
      insertedIds: results.insertedIds
    });

  } catch (error) {
    console.error('Error in bulk fuel import:', error);
    res.status(500).json({
      error: 'Bulk fuel import failed',
      details: error.message
    });
  }
});

module.exports = router;
