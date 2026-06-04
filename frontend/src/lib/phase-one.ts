import { PARTNER_ROLE_OPTIONS, SERVICE_ROLE_OPTIONS } from './auth-portals';

export const ROLE_PICKER_OPTIONS = [
  ...SERVICE_ROLE_OPTIONS,
  ...PARTNER_ROLE_OPTIONS,
] as const;

export const SERVICE_TYPES = ['FTL', 'PTL', 'COURIER', 'WAREHOUSE', 'RAIL'] as const;
export const VEHICLE_TYPES = [
  'MOTORBIKE',
  'VAN',
  'TRUCK_3T',
  'TRUCK_7T',
  'TRUCK_14T',
  'TRUCK_22T',
  'CONTAINER_20FT',
  'CONTAINER_40FT',
  'REFRIGERATED',
] as const;

export type KenyaVehicleCatalogGroup = {
  vehicleType: (typeof VEHICLE_TYPES)[number];
  label: string;
  models: Array<{ make: string; model: string }>;
};

export const KENYA_VEHICLE_CATALOG: KenyaVehicleCatalogGroup[] = [
  {
    vehicleType: 'MOTORBIKE',
    label: 'Motorbike / boda boda',
    models: [
      { make: 'Bajaj', model: 'Boxer 100' },
      { make: 'Bajaj', model: 'Boxer 125' },
      { make: 'Bajaj', model: 'Boxer 150' },
      { make: 'TVS', model: 'HLX 125' },
      { make: 'TVS', model: 'HLX 150' },
      { make: 'Honda', model: 'Ace CB125' },
      { make: 'Yamaha', model: 'Crux' },
      { make: 'Haojue', model: 'HJ125' },
      { make: 'Suzuki', model: 'GN125' },
      { make: 'Kibo', model: 'K150' },
    ],
  },
  {
    vehicleType: 'VAN',
    label: 'Van / light commercial',
    models: [
      { make: 'Toyota', model: 'HiAce' },
      { make: 'Toyota', model: 'Probox' },
      { make: 'Toyota', model: 'TownAce' },
      { make: 'Nissan', model: 'NV350 Caravan' },
      { make: 'Nissan', model: 'Caravan' },
      { make: 'Mazda', model: 'Bongo' },
      { make: 'Mitsubishi', model: 'Delica' },
      { make: 'Hyundai', model: 'H-1' },
      { make: 'Ford', model: 'Transit' },
      { make: 'Peugeot', model: 'Boxer' },
    ],
  },
  {
    vehicleType: 'TRUCK_3T',
    label: '3T truck',
    models: [
      { make: 'Isuzu', model: 'NLR' },
      { make: 'Isuzu', model: 'NMR' },
      { make: 'Mitsubishi Fuso', model: 'Canter' },
      { make: 'Toyota', model: 'Dyna' },
      { make: 'Hino', model: '300 Series' },
      { make: 'Nissan', model: 'Atlas' },
      { make: 'Tata', model: 'LPT 407' },
    ],
  },
  {
    vehicleType: 'TRUCK_7T',
    label: '7T truck',
    models: [
      { make: 'Isuzu', model: 'FRR' },
      { make: 'Isuzu', model: 'FVR' },
      { make: 'Mitsubishi Fuso', model: 'Fighter' },
      { make: 'Hino', model: '500 Series' },
      { make: 'UD Trucks', model: 'Croner' },
      { make: 'Tata', model: 'LPT 909' },
      { make: 'Hyundai', model: 'Mighty' },
    ],
  },
  {
    vehicleType: 'TRUCK_14T',
    label: '14T truck',
    models: [
      { make: 'Isuzu', model: 'FVM' },
      { make: 'Isuzu', model: 'FVR' },
      { make: 'Hino', model: '500 GH' },
      { make: 'Hino', model: '500 FM' },
      { make: 'Mercedes-Benz', model: 'Atego' },
      { make: 'Mercedes-Benz', model: 'Axor' },
      { make: 'UD Trucks', model: 'Quester' },
      { make: 'MAN', model: 'TGM' },
      { make: 'Foton', model: 'Auman' },
    ],
  },
  {
    vehicleType: 'TRUCK_22T',
    label: '22T rigid / heavy truck',
    models: [
      { make: 'Isuzu', model: 'FVZ' },
      { make: 'Mercedes-Benz', model: 'Actros' },
      { make: 'Mercedes-Benz', model: 'Axor' },
      { make: 'MAN', model: 'TGS' },
      { make: 'Scania', model: 'P-Series' },
      { make: 'Scania', model: 'G-Series' },
      { make: 'Volvo', model: 'FM' },
      { make: 'Mitsubishi Fuso', model: 'FJ' },
      { make: 'FAW', model: 'JH6' },
    ],
  },
  {
    vehicleType: 'CONTAINER_20FT',
    label: '20ft container prime mover',
    models: [
      { make: 'Scania', model: 'R-Series' },
      { make: 'Scania', model: 'P-Series' },
      { make: 'Mercedes-Benz', model: 'Actros' },
      { make: 'MAN', model: 'TGS' },
      { make: 'Volvo', model: 'FH' },
      { make: 'Volvo', model: 'FM' },
      { make: 'Sinotruk', model: 'HOWO' },
      { make: 'FAW', model: 'JH6' },
      { make: 'Shacman', model: 'F3000' },
      { make: 'UD Trucks', model: 'Quester' },
    ],
  },
  {
    vehicleType: 'CONTAINER_40FT',
    label: '40ft container prime mover',
    models: [
      { make: 'Scania', model: 'R-Series' },
      { make: 'Mercedes-Benz', model: 'Actros' },
      { make: 'MAN', model: 'TGS' },
      { make: 'Volvo', model: 'FH' },
      { make: 'Sinotruk', model: 'HOWO' },
      { make: 'FAW', model: 'JH6' },
      { make: 'Shacman', model: 'F3000' },
      { make: 'Beiben', model: 'NG80' },
      { make: 'UD Trucks', model: 'Quester' },
    ],
  },
  {
    vehicleType: 'REFRIGERATED',
    label: 'Refrigerated / cold chain',
    models: [
      { make: 'Isuzu', model: 'NPR Refrigerated' },
      { make: 'Isuzu', model: 'FRR Refrigerated' },
      { make: 'Mitsubishi Fuso', model: 'Canter Refrigerated' },
      { make: 'Hino', model: '300 Refrigerated' },
      { make: 'Hino', model: '500 Refrigerated' },
      { make: 'Toyota', model: 'HiAce Refrigerated' },
      { make: 'Nissan', model: 'NV350 Refrigerated' },
    ],
  },
];
export const VEHICLE_STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'SUSPENDED'] as const;
export const FLEET_VERIFICATION_UPLOAD_CATEGORIES = [
  'PLATE',
  'FRONT',
  'RIGHT',
  'LEFT',
  'REAR',
  'CHASSIS',
  'INSURANCE',
  'LOGBOOK',
  'NTSA_INSPECTION',
  'GOODS_TRANSPORT_LICENSE',
  'ROAD_SERVICE_LICENSE',
  'AXLE_LOAD_CERTIFICATE',
] as const;
export const PAYMENT_METHODS = ['MPESA', 'CARD', 'CASH', 'WALLET', 'BANK_TRANSFER'] as const;
export const PAYMENT_STATUSES = ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'REFUNDED'] as const;
export const TICKET_CATEGORIES = ['BOOKING', 'PAYMENT', 'DRIVER', 'GENERAL'] as const;
export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'] as const;

const driverNextStatusMap: Record<string, string[]> = {
  ASSIGNED: ['ACCEPTED'],
  ACCEPTED: ['ARRIVED'],
  ARRIVED: ['PICKED'],
  PICKED: ['IN_TRANSIT'],
  IN_TRANSIT: ['ARRIVED_AT_DESTINATION'],
  ARRIVED_AT_DESTINATION: ['DELIVERY_VERIFICATION'],
  DELIVERY_VERIFICATION: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
};

export function getDriverNextStatuses(status?: string | null) {
  return driverNextStatusMap[status ?? ''] ?? [];
}
