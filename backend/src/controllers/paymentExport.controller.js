// src/controllers/paymentExport.controller.js
// CSV/XLSX export for payments with linked booking info

const { Payment, Booking, User } = require('../models');
const { error } = require('../utils/response');

exports.exportPayments = async (req, res) => {
  try {
    const { from, to, format = 'csv', limit = 50000 } = req.query;
    const where = {};
    if (from && to) where.created_at = { [require('sequelize').Op.between]: [new Date(from), new Date(to)] };

    const payments = await Payment.findAll({
      where,
      include: [
        { model: Booking, as: 'booking', attributes: ['reference', 'customer_rate', 'hire_rate', 'payment_status', 'pickup_address', 'delivery_address', 'customer_id'] },
      ],
      order: [['created_at', 'DESC']],
      limit: Math.min(Number(limit) || 50000, 1048576),
    });

    const header = ['payment_id','provider','status','amount','currency','booking_ref','payment_status','customer_rate','hire_rate','customer_name','customer_email','customer_phone','created_at'];

    if (format === 'xlsx') {
      const Excel = require('exceljs');
      const wb = new Excel.Workbook();
      const ws = wb.addWorksheet('Payments');
      ws.addRow(header);
      for (const p of payments) {
        const customer = p.booking?.customer_id ? await User.findByPk(p.booking.customer_id) : null; // lazy load to avoid join bloat
        ws.addRow([
          p.id,
          p.provider,
          p.status,
          p.amount,
          p.currency,
          p.booking?.reference || '',
          p.booking?.payment_status || '',
          p.booking?.customer_rate || '',
          p.booking?.hire_rate || '',
          customer?.full_name || '',
          customer?.email || '',
          customer?.phone || '',
          p.created_at?.toISOString() || '',
        ]);
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="payments-${Date.now()}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    // default CSV
    const rows = [];
    for (const p of payments) {
      const customer = p.booking?.customer_id ? await User.findByPk(p.booking.customer_id) : null;
      const row = [
        p.id,
        p.provider,
        p.status,
        p.amount,
        p.currency,
        p.booking?.reference || '',
        p.booking?.payment_status || '',
        p.booking?.customer_rate || '',
        p.booking?.hire_rate || '',
        customer?.full_name || '',
        customer?.email || '',
        customer?.phone || '',
        p.created_at?.toISOString() || '',
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
      rows.push(row);
    }

    const csv = [header.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="payments-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};
