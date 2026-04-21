// src/controllers/contract.controller.js
// PRD §7 — Custom pricing via contracts
// PRD §5.4 — Transporter contract management

const { success, error } = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/helpers');

exports.getContracts = async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const where = {};
    if (req.scope && !req.scope.isAdmin && req.scope.transporter_id) where.transporter_id = req.scope.transporter_id;
    const { count, rows } = await Contract.findAndCountAll({ where, limit, offset, order: [['created_at', 'DESC']] });
    return success(res, rows, 'Contracts retrieved', paginatedResponse(rows, count, page, limit).meta);
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getContractById = async (req, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id, { include: [{ model: ContractRate, as: 'rates' }] });
    if (!contract) return error(res, 'NOT_FOUND', 'Contract not found', 404);
    return success(res, { contract });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.createContract = async (req, res) => {
  try {
    const contract = await Contract.create({ ...req.body, created_by: req.user.id });
    if (req.auditLog) await req.auditLog('CONTRACT_CREATED', { contract_id: contract.id, by: req.user.id });
    return success(res, contract, 'Contract created');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateContract = async (req, res) => {
  try {
    const contract = await Contract.findByPk(req.params.id);
    if (!contract) return error(res, 'NOT_FOUND', 'Contract not found', 404);
    await contract.update(req.body);
    return success(res, { contract });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.getContractRates = async (req, res) => {
  try {
    const rates = await ContractRate.findAll({ where: { contract_id: req.params.id } });
    return success(res, { rates });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.addContractRate = async (req, res) => {
  try {
    const rate = await ContractRate.create({ ...req.body, contract_id: req.params.id });
    return success(res, rate, 'Contract rate added');
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.updateContractRate = async (req, res) => {
  try {
    const rate = await ContractRate.findOne({ where: { id: req.params.rateId, contract_id: req.params.id } });
    if (!rate) return error(res, 'NOT_FOUND', 'Rate not found', 404);
    await rate.update(req.body);
    return success(res, { rate });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};

exports.deleteContractRate = async (req, res) => {
  try {
    const rate = await ContractRate.findOne({ where: { id: req.params.rateId, contract_id: req.params.id } });
    if (!rate) return error(res, 'NOT_FOUND', 'Rate not found', 404);
    await rate.destroy();
    return success(res, { message: 'Rate deleted' });
  } catch (err) {
    return error(res, 'SERVER_ERROR', err.message, 500);
  }
};