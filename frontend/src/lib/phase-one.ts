import { PARTNER_ROLE_OPTIONS, SERVICE_ROLE_OPTIONS } from './auth-portals';

export const ROLE_PICKER_OPTIONS = [
  ...SERVICE_ROLE_OPTIONS,
  ...PARTNER_ROLE_OPTIONS,
] as const;

export const SERVICE_TYPES = ['FTL', 'PTL', 'COURIER', 'WAREHOUSE'] as const;
export const VEHICLE_TYPES = [
  'MOTORBIKE',
  'VAN',
  'TRUCK_3T',
  'TRUCK_7T',
  'TRUCK_14T',
  'TRUCK_22T',
  'REFRIGERATED',
] as const;
export const VEHICLE_STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'SUSPENDED'] as const;
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
