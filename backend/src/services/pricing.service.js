// src/services/pricing.service.js
// PRD §7 — Pricing Engine with surcharges (heavy load, night, holiday, waiting, multi-stop)

const { calculateProfit, roundMoney, isNightSurcharge } = require('../utils/helpers');
const prisma = require('../utils/prisma');

const DEFAULT_RATES = {
  motorcycle:  { base: 200,  per_km: 15,  capacityKg: 30 },
  pickup:      { base: 1000, per_km: 50,  capacityKg: 1500 },
  van:         { base: 1500, per_km: 60,  capacityKg: 1200 },
  truck:       { base: 3000, per_km: 80,  capacityKg: 4000 },
  heavy_truck: { base: 8000, per_km: 150, capacityKg: 20000 },
};

const getDefaultRate = (vehicleType) => {
  return DEFAULT_RATES[vehicleType] || DEFAULT_RATES.pickup;
};

const loadContractRate = async (customerId, vehicleType) => {
  if (!customerId) return null;
  const contract = await Contract.findOne({
    where: { customer_id: customerId, status: 'active' },
    order: [['created_at', 'DESC']],
  });
  if (!contract) return null;

  const rate = await ContractRate.findOne({
    where: { contract_id: contract.id, vehicle_type: vehicleType },
  });
  if (!rate) return null;

  return {
    base: Number(rate.base_rate || 0),
    per_km: Number(rate.per_km_rate || 0),
    min_fare: Number(rate.min_fare || 0),
  };
};

const applySurcharges = ({ fare, isHeavy, isNight, isHoliday, extraStops = 0, waitingMinutes = 0 }) => {
  const breakdown = {};
  let total = fare;

  if (isHeavy) {
    const add = total * 0.20;
    breakdown.heavy_load = roundMoney(add);
    total += add;
  }

  if (isNight) {
    const add = total * 0.15;
    breakdown.night = roundMoney(add);
    total += add;
  }

  if (isHoliday) {
    const add = total * 0.10;
    breakdown.holiday = roundMoney(add);
    total += add;
  }

  if (extraStops > 0) {
    const add = 200 * extraStops; // configurable later
    breakdown.multi_stop = roundMoney(add);
    total += add;
  }

  if (waitingMinutes > 15) {
    const billable = Math.max(0, waitingMinutes - 15);
    const slots = Math.ceil(billable / 15);
    const add = 50 * slots;
    breakdown.waiting = roundMoney(add);
    total += add;
  }

  return { total: roundMoney(total), surcharges: breakdown };
};

const isPublicHoliday = (date = new Date()) => {
  try {
    const list = JSON.parse(process.env.PUBLIC_HOLIDAYS || '[]');
    const iso = new Date(date).toISOString().slice(0, 10);
    return list.includes(iso);
  } catch {
    return false;
  }
};

const quoteFare = async (params) => {
  const {
    vehicle_type,
    distance_km = 0,
    customer_id = null,
    is_heavy = false,
    is_night = null,
    is_holiday = null,
    extra_stops = 0,
    waiting_minutes = 0,
  } = params;

  const distance = Number(distance_km) || 0;
  const contractRate = await loadContractRate(customer_id, vehicle_type);
  const rate = contractRate || getDefaultRate(vehicle_type);

  let fare = Number(rate.base || 0) + distance * Number(rate.per_km || 0);
  if (rate.min_fare) {
    fare = Math.max(fare, Number(rate.min_fare));
  }

  const { total, surcharges } = applySurcharges({
    fare,
    isHeavy: is_heavy === true || is_heavy === 'true',
    isNight: is_night === true || is_night === 'true' || isNightSurcharge(),
    isHoliday: is_holiday === true || is_holiday === 'true' || isPublicHoliday(),
    extraStops: Number(extra_stops) || 0,
    waitingMinutes: Number(waiting_minutes) || 0,
  });

  // PRD §7.0 — Fetch Transporter contract if applicable for the hire_rate
  let hire_rate;
  const customer_rate = roundMoney(total);
  
  // Logic to find a contracted hire rate based on the transporter/vehicle
  if (params.transporter_id) {
    const tContract = await prisma.contract.findFirst({
      where: { transporterId: params.transporter_id, status: 'active' },
      include: { rates: { where: { vehicleType: vehicle_type } } }
    });
    
    if (tContract && tContract.rates.length > 0) {
      const tRate = tContract.rates[0];
      hire_rate = roundMoney(Number(tRate.baseRate) + (distance * Number(tRate.perKmRate)));
    }
  }

  // Fallback to default margin if no specific contract is found
  if (!hire_rate) {
    hire_rate = roundMoney(customer_rate * 0.8); 
  }

  const profit = calculateProfit(customer_rate, hire_rate, 0);

  return {
    vehicle_type,
    distance_km: distance,
    base_rate: Number(rate.base || 0),
    per_km_rate: Number(rate.per_km || 0),
    min_fare: Number(rate.min_fare || 0),
    customer_rate,
    hire_rate,
    profit,
    surcharges,
    pricing_mode: contractRate ? 'contract' : 'default',
  };
};

module.exports = { quoteFare };
