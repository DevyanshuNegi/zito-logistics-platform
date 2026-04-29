export const ROLE_PICKER_OPTIONS = [
  {
    role: 'CUSTOMER',
    label: 'Customer',
    description: 'Book trips, pay, track drivers, and raise support tickets.',
  },
  {
    role: 'DRIVER',
    label: 'Driver',
    description: 'Start shifts, receive jobs, move trips, and review earnings.',
  },
  {
    role: 'TRANSPORTER',
    label: 'Transporter',
    description: 'Manage fleet readiness, driver assignments, and breakdowns.',
  },
  {
    role: 'AGENCY_STAFF',
    label: 'Agency Staff',
    description: 'Handle operational support, tickets, and day-to-day coordination.',
  },
  {
    role: 'CORPORATE',
    label: 'Corporate',
    description: 'Book on contract credit, manage invoices, and review commercial terms.',
  },
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
