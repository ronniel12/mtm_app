const express = require('express');
const router = express.Router();
const { query } = require('../lib/db');

// ============================================================================
// TRIPS ROUTES
// ============================================================================

router.get('/trips', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const countResult = await query('SELECT COUNT(*) as total FROM trips');
    const total = parseInt(countResult.rows[0].total);

    const result = await query(
      'SELECT * FROM trips ORDER BY date DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      trips: result.rows,
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
    console.error('Error fetching trips:', error);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

router.get('/trips/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching trip:', error);
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

router.post('/trips', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO trips (
        date, truck_plate, truck_id, driver_role, helper_role, driver_id, helper_id,
        invoice_number, location_origin, location_destination, bags, rate, amount,
        cash_advance, deductions, net_pay, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      req.body.date,
      req.body.truckPlate || req.body.truck_plate,
      req.body.truckId || req.body.truck_id,
      req.body.driverRole === 'D' || req.body.driverRole === 'Driver' || req.body._role === 'D' ? 'D' : 'H',
      req.body.helperRole === 'H' || req.body.helperRole === 'Helper' || req.body._role === 'H' ? 'H' : null,
      req.body.driverId || req.body.driver_id,
      req.body.helperId || req.body.helper_id,
      req.body.invoiceNumber || req.body.invoice_number,
      req.body.locationOrigin || req.body.location_origin,
      req.body.locationDestination || req.body.location_destination,
      parseInt(req.body.bags) || 0,
      parseFloat(req.body.rate) || 0,
      parseFloat(req.body.amount) || 0,
      parseFloat(req.body.cashAdvance || req.body.cash_advance) || 0,
      JSON.stringify(req.body.deductions || []),
      parseFloat(req.body.netPay || req.body.net_pay) || 0,
      req.body.createdBy || req.body.created_by,
      req.body.status || 'pending'
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ error: 'Failed to create trip', details: error.message });
  }
});

router.put('/trips/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE trips
      SET date = $1, truck_plate = $2, truck_id = $3, driver_role = $4, helper_role = $5,
          driver_id = $6, helper_id = $7, invoice_number = $8, location_origin = $9,
          location_destination = $10, bags = $11, rate = $12, amount = $13, cash_advance = $14,
          deductions = $15, net_pay = $16, updated_at = CURRENT_TIMESTAMP
      WHERE id = $17
      RETURNING *
    `, [
      req.body.date,
      req.body.truckPlate || req.body.truck_plate,
      req.body.truckId || req.body.truck_id,
      req.body.driverRole === 'D' || req.body.driverRole === 'Driver' ? 'D' : 'H',
      req.body.helperRole === 'H' || req.body.helperRole === 'Helper' ? 'H' : null,
      req.body.driverId || req.body.driver_id,
      req.body.helperId || req.body.helper_id,
      req.body.invoiceNumber || req.body.invoice_number,
      req.body.locationOrigin || req.body.location_origin,
      req.body.locationDestination || req.body.location_destination,
      parseInt(req.body.bags) || 0,
      parseFloat(req.body.rate) || 0,
      parseFloat(req.body.amount) || 0,
      parseFloat(req.body.cashAdvance || req.body.cash_advance) || 0,
      JSON.stringify(req.body.deductions || []),
      parseFloat(req.body.netPay || req.body.net_pay) || 0,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating trip:', error);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

router.delete('/trips/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM trips WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    res.json({ message: 'Trip deleted successfully' });
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

router.get('/trips/calculate/:truckPlate/:destination', async (req, res) => {
  try {
    const { truckPlate, destination } = req.params;
    console.log(`Calculating trip: ${truckPlate} -> ${destination}`);

    const isTruckExists = await query('SELECT id FROM vehicles WHERE plate_number = $1', [truckPlate]);
    if (isTruckExists.rows.length === 0) {
      return res.status(400).json({ error: 'Truck not found' });
    }

    const truckId = isTruckExists.rows[0].id;

    const rateResult = await query(`
      SELECT new_rates, rate FROM rates
      WHERE origin = $1 AND town = $2
      ORDER BY created_at DESC LIMIT 1
    `, [truckPlate.split('-')[0], destination]);

    if (rateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rate not found for this route' });
    }

    const finalRate = rateResult.rows[0].new_rates || rateResult.rows[0].rate;

    res.json({
      destination,
      rate: finalRate,
      truckId,
      calculated: true
    });
  } catch (error) {
    console.error('Error calculating trip:', error);
    res.status(500).json({ error: 'Failed to calculate trip', details: error.message });
  }
});

// ============================================================================
// FUEL ROUTES
// ============================================================================

router.get('/fuel', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const countResult = await query('SELECT COUNT(*) as total FROM fuel');
    const total = parseInt(countResult.rows[0].total);

    const result = await query(
      'SELECT * FROM fuel ORDER BY fuel_date DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      fuel: result.rows,
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

router.get('/fuel/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM fuel WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Fuel record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching fuel record:', error);
    res.status(500).json({ error: 'Failed to fetch fuel record' });
  }
});

router.post('/fuel', async (req, res) => {
  try {
    const entries = req.body;

    if (Array.isArray(entries)) {
      // Bulk insert
      const validEntries = [];
      for (const entry of entries) {
        if (entry.fuelDate && entry.vehiclePlate && entry.liters && entry.cost) {
          validEntries.push(entry);
        }
      }

      if (validEntries.length === 0) {
        return res.status(400).json({ error: 'No valid entries provided' });
      }

      const results = [];
      for (const entry of validEntries) {
        try {
          const result = await query(`
            INSERT INTO fuel (fuel_date, vehicle_plate, liters, cost, odometer_reading, location, fuel_type, receipt_url, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
          `, [
            entry.fuelDate,
            entry.vehiclePlate,
            parseFloat(entry.liters),
            parseFloat(entry.cost),
            parseInt(entry.odometerReading || 0),
            entry.location,
            entry.fuelType,
            entry.receiptUrl,
            entry.notes,
            entry.createdBy
          ]);
          results.push(result.rows[0]);
        } catch (entryError) {
          console.error('Error processing entry:', entry, entryError);
          results.push({ error: entryError.message, entry });
        }
      }

      res.status(201).json({
        success: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length,
        results
      });
    } else {
      // Single insert
      const result = await query(`
        INSERT INTO fuel (fuel_date, vehicle_plate, liters, cost, odometer_reading, location, fuel_type, receipt_url, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        entries.fuelDate,
        entries.vehiclePlate,
        parseFloat(entries.liters),
        parseFloat(entries.cost),
        parseInt(entries.odometerReading || 0),
        entries.location,
        entries.fuelType,
        entries.receiptUrl,
        entries.notes,
        entries.createdBy
      ]);

      res.status(201).json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error creating fuel record:', error);
    res.status(500).json({
      error: 'Failed to create fuel record',
      details: error.message,
      stack: error.stack
    });
  }
});

router.put('/fuel/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE fuel
      SET fuel_date = $1, vehicle_plate = $2, liters = $3, cost = $4,
          odometer_reading = $5, location = $6, fuel_type = $7,
          receipt_url = $8, notes = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      req.body.fuelDate,
      req.body.vehiclePlate,
      parseFloat(req.body.liters),
      parseFloat(req.body.cost),
      parseInt(req.body.odometerReading || 0),
      req.body.location,
      req.body.fuelType,
      req.body.receiptUrl,
      req.body.notes,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Fuel record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating fuel record:', error);
    res.status(500).json({ error: 'Failed to update fuel record' });
  }
});

router.delete('/fuel/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM fuel WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Fuel record not found' });
    }
    res.json({ message: 'Fuel record deleted successfully' });
  } catch (error) {
    console.error('Error deleting fuel record:', error);
    res.status(500).json({ error: 'Failed to delete fuel record' });
  }
});

// ============================================================================
// VEHICLES ROUTES
// ============================================================================

router.get('/vehicles', async (req, res) => {
  try {
    const result = await query('SELECT * FROM vehicles ORDER BY plate_number ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

router.get('/vehicles/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

router.post('/vehicles', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO vehicles (plate_number, vehicle_type, capacity, status, make, model, year, color, registration_date, insurance_expiry, next_maintenance_date, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      req.body.plateNumber,
      req.body.vehicleType,
      parseInt(req.body.capacity) || 0,
      req.body.status || 'active',
      req.body.make,
      req.body.model,
      parseInt(req.body.year) || null,
      req.body.color,
      req.body.registrationDate,
      req.body.insuranceExpiry,
      req.body.nextMaintenanceDate,
      req.body.notes,
      req.body.createdBy
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

router.put('/vehicles/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE vehicles
      SET plate_number = $1, vehicle_type = $2, capacity = $3, status = $4,
          make = $5, model = $6, year = $7, color = $8, registration_date = $9,
          insurance_expiry = $10, next_maintenance_date = $11, notes = $12, updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `, [
      req.body.plateNumber,
      req.body.vehicleType,
      parseInt(req.body.capacity) || 0,
      req.body.status || 'active',
      req.body.make,
      req.body.model,
      parseInt(req.body.year) || null,
      req.body.color,
      req.body.registrationDate,
      req.body.insuranceExpiry,
      req.body.nextMaintenanceDate,
      req.body.notes,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

router.delete('/vehicles/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM vehicles WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

// ============================================================================
// MAINTENANCE ROUTES
// ============================================================================

router.get('/maintenance', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const countResult = await query('SELECT COUNT(*) as total FROM maintenance');
    const total = parseInt(countResult.rows[0].total);

    const result = await query(
      'SELECT * FROM maintenance ORDER BY maintenance_date DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      maintenance: result.rows,
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
    console.error('Error fetching maintenance schedules:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance schedules' });
  }
});

router.get('/maintenance/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM maintenance WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance schedule not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance schedule' });
  }
});

router.post('/maintenance', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO maintenance (
        vehicle_id, maintenance_date, maintenance_type, description,
        cost, odometer_reading, next_maintenance_date, performed_by,
        status, location, parts_used, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      req.body.vehicleId,
      req.body.maintenanceDate,
      req.body.maintenanceType,
      req.body.description,
      parseFloat(req.body.cost) || 0,
      parseInt(req.body.odometerReading || 0),
      req.body.nextMaintenanceDate,
      req.body.performedBy,
      req.body.status || 'scheduled',
      req.body.location,
      req.body.partsUsed,
      req.body.notes,
      req.body.createdBy
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to create maintenance schedule' });
  }
});

router.put('/maintenance/:id', async (req, res) => {
  try {
    const result = await query(`
      UPDATE maintenance
      SET vehicle_id = $1, maintenance_date = $2, maintenance_type = $3, description = $4,
          cost = $5, odometer_reading = $6, next_maintenance_date = $7, performed_by = $8,
          status = $9, location = $10, parts_used = $11, notes = $12, updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `, [
      req.body.vehicleId,
      req.body.maintenanceDate,
      req.body.maintenanceType,
      req.body.description,
      parseFloat(req.body.cost) || 0,
      parseInt(req.body.odometerReading || 0),
      req.body.nextMaintenanceDate,
      req.body.performedBy,
      req.body.status || 'scheduled',
      req.body.location,
      req.body.partsUsed,
      req.body.notes,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance schedule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to update maintenance schedule' });
  }
});

router.delete('/maintenance/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM maintenance WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Maintenance schedule not found' });
    }
    res.json({ message: 'Maintenance schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting maintenance schedule:', error);
    res.status(500).json({ error: 'Failed to delete maintenance schedule' });
  }
});

router.get('/maintenance/schedule/:vehicleId', async (req, res) => {
  try {
    const result = await query('SELECT * FROM maintenance WHERE vehicle_id = $1 ORDER BY maintenance_date DESC', [req.params.vehicleId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching vehicle documents:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle documents' });
  }
});

router.get('/maintenance/dashboard/summary', async (req, res) => {
  try {
    // Get maintenance counts by status
    const statusCount = await query(`
      SELECT status, COUNT(*) as count FROM maintenance
      GROUP BY status
    `);

    // Get upcoming maintenance (next 30 days)
    const upcomingResult = await query(`
      SELECT m.*, v.plate_number
      FROM maintenance m
      JOIN vehicles v ON m.vehicle_id = v.id
      WHERE m.next_maintenance_date IS NOT NULL
        AND m.next_maintenance_date <= DATE 'now()' + INTERVAL '30 days'
        AND m.status = 'completed'
      ORDER BY m.next_maintenance_date ASC
      LIMIT 10
    `);

    // Get overdue maintenance
    const overdueResult = await query(`
      SELECT m.*, v.plate_number
      FROM maintenance m
      JOIN vehicles v ON m.vehicle_id = v.id
      WHERE m.next_maintenance_date IS NOT NULL
        AND m.next_maintenance_date < DATE 'now()'
        AND m.status != 'completed'
    `);

    res.json({
      statusSummary: statusCount.rows,
      upcomingMaintenance: upcomingResult.rows,
      overdueMaintenance: overdueResult.rows
    });
  } catch (error) {
    console.error('Error fetching maintenance dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance dashboard' });
  }
});

router.get('/maintenance/notifications/all', async (req, res) => {
  try {
    const result = await query('SELECT * FROM maintenance_notifications ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

router.post('/maintenance/notifications', async (req, res) => {
  try {
    const result = await query(`
      INSERT INTO maintenance_notifications (maintenance_id, vehicle_id, message, priority, status, scheduled_date)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      req.body.maintenanceId,
      req.body.vehicleId,
      req.body.message,
      req.body.priority || 'medium',
      req.body.status || 'pending',
      req.body.scheduledDate
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating notification preference:', error);
    res.status(500).json({ error: 'Failed to create notification preference' });
  }
});

module.exports = router;
