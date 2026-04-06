// src/controllers/tripCharges.controller.js
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

/* -------------------------------------------------------------------------- */
/* ADD TRIP CHARGE                                                            */
/* -------------------------------------------------------------------------- */

const addCharge = async (req, res, next) => {
  try {

    const {
      trip_id,
      charge_type,
      amount,
      description,
      driver_id,
    } = req.body;

    if (!trip_id || !charge_type || !amount) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'trip_id, charge_type and amount are required',
        },
      });
    }

    const result = await sequelize.query(
      `
      INSERT INTO trip_charges
        (trip_id, charge_type, amount, description, driver_id)
      VALUES
        (:trip_id, :charge_type, :amount, :description, :driver_id)
      RETURNING *;
      `,
      {
        replacements: {
          trip_id,
          charge_type,
          amount,
          description: description || null,
          driver_id: driver_id || null,
        },
        type: QueryTypes.INSERT,
      }
    );

    const inserted = result[0][0];

    return res.status(201).json({
      success: true,
      data: inserted,
    });

  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* GET TRIP CHARGES                                                           */
/* -------------------------------------------------------------------------- */

const getTripCharges = async (req, res, next) => {
  try {

    const { tripId } = req.params;

    const charges = await sequelize.query(
      `
      SELECT *
      FROM trip_charges
      WHERE trip_id = :tripId
      ORDER BY created_at ASC;
      `,
      {
        replacements: { tripId },
        type: QueryTypes.SELECT,
      }
    );

    return res.json({
      success: true,
      data: charges,
    });

  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* GET DRIVER EXPENSES                                                        */
/* -------------------------------------------------------------------------- */

const getDriverExpenses = async (req, res, next) => {
  try {

    const { driverId } = req.params;

    const expenses = await sequelize.query(
      `
      SELECT *
      FROM trip_charges
      WHERE driver_id = :driverId
      ORDER BY created_at ASC;
      `,
      {
        replacements: { driverId },
        type: QueryTypes.SELECT,
      }
    );

    return res.json({
      success: true,
      data: expenses,
    });

  } catch (err) {
    next(err);
  }
};

/* -------------------------------------------------------------------------- */
/* GET TRIP FINANCIAL SUMMARY                                                 */
/* -------------------------------------------------------------------------- */

const getTripFinancials = async (req, res, next) => {
  try {

    const { tripId } = req.params;

    const result = await sequelize.query(
      `
      SELECT 
        b.id AS trip_id,
        b.customer_rate,
        b.hire_rate,
        COALESCE(SUM(tc.amount),0) AS total_expenses,
        (b.customer_rate - b.hire_rate - COALESCE(SUM(tc.amount),0)) AS profit
      FROM bookings b
      LEFT JOIN trip_charges tc ON tc.trip_id = b.id
      WHERE b.id = :tripId
      GROUP BY b.id;
      `,
      {
        replacements: { tripId },
        type: QueryTypes.SELECT,
      }
    );

    return res.json({
      success: true,
      data: result[0] || null,
    });

  } catch (err) {
    next(err);
  }
};

module.exports = {
  addCharge,
  getTripCharges,
  getDriverExpenses,
  getTripFinancials
};