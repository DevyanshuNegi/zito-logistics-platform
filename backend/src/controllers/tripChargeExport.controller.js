// src/controllers/tripChargeExport.controller.js
// Export trip charges (expenses) with booking context

const { TripCharge, Booking, Driver, User } = require('../models');
const { error } = require('../utils/response');
const { Op } = require('sequelize');

exports.exportTripCharges = async (req, res) => {
  try {
    const { from, to, format = 'csv', limit = 50000 } = req.query;
    const where = {};
    if (from && to) where.created_at = { [Op.between]: [new Date(from), new Date(to)] };
    if (req.query.driver_id) where.driver_id = req.query.driver_id;
    if (req.query.charge_type) where.charge_type = req.query.charge_type;

    const charges = await TripCharge.findAll({
      where,
      include: [
        { model: Booking, as: 'booking', attributes: ['reference', 'customer_rate', 'hire_rate', 'customer_id'] },
        { model: Driver, as: 'driver', attributes: ['id', 'avg_rating'], include: [{ model: User, as: 'user', attributes: ['full_name','email','phone'] }] },
      ],
      order: [['created_at', 'DESC']],
      limit: Math.min(Number(limit) || 50000, 1048576),
    });

    const header = ['charge_id','trip_id','booking_ref','charge_type','amount','description','driver_name','driver_email','driver_phone','created_at'];

    if (format === 'xlsx') {
      const Excel = require('exceljs');
      const wb = new Excel.Workbook();
      const ws = wb.addWorksheet('TripCharges');
      ws.addRow(header);
      charges.forEach(c => {
        ws.addRow([
          c.id,
          c.trip_id,
          c.booking?.reference || '',
          c.charge_type,
          c.amount,
          c.description || '',
          c.driver?.user?.full_name || '',
          c.driver?.user?.email || '',
          c.driver?.user?.phone || '',
          c.created_at?.toISOString() || '',
        ]);
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="trip-charges-${Date.now()}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    // CSV
    const rows = charges.map(c => ([
      c.id,
      c.trip_id,
      c.booking?.reference || '',
      c.charge_type,
      c.amount,
      c.description || '',
      c.driver?.user?.full_name || '',
      c.driver?.user?.email || '',
      c.driver?.user?.phone || '',
      c.created_at?.toISOString() || '',
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')));

    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="trip-charges-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
