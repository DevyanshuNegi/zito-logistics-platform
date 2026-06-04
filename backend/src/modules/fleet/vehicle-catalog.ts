import { VehicleType } from '@prisma/client';

export type KenyaVehicleModel = {
  make: string;
  model: string;
};

export type KenyaVehicleCatalogGroup = {
  vehicleType: VehicleType;
  label: string;
  models: KenyaVehicleModel[];
};

export const KENYA_VEHICLE_CATALOG: KenyaVehicleCatalogGroup[] = [
  {
    vehicleType: VehicleType.MOTORBIKE,
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
    vehicleType: VehicleType.VAN,
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
    vehicleType: VehicleType.TRUCK_3T,
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
    vehicleType: VehicleType.TRUCK_7T,
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
    vehicleType: VehicleType.TRUCK_14T,
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
    vehicleType: VehicleType.TRUCK_22T,
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
    vehicleType: VehicleType.CONTAINER_20FT,
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
    vehicleType: VehicleType.CONTAINER_40FT,
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
    vehicleType: VehicleType.REFRIGERATED,
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

export function getKenyaVehicleCatalog(vehicleType?: VehicleType) {
  if (!vehicleType) {
    return KENYA_VEHICLE_CATALOG;
  }

  return KENYA_VEHICLE_CATALOG.filter((group) => group.vehicleType === vehicleType);
}
