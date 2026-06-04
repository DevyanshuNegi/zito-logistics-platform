export const ENTERPRISE_EVENT_TYPES = [
  'BookingCreated',
  'BookingAssigned',
  'BookingCancelled',
  'BookingCompleted',
  'PaymentInitiated',
  'PaymentVerified',
  'EscrowReleased',
  'RefundProcessed',
  'DriverOnline',
  'DriverArrived',
  'DriverNoShow',
  'TripStarted',
  'GPSUpdated',
  'TripDelayed',
  'PODUploaded',
  'WarehouseListingSubmitted',
  'WarehouseListingReviewed',
  'WarehouseBookingCreated',
  'WarehouseBookingStatusChanged',
  'InventoryReceived',
  'InventoryMoved',
  'InventoryDispatched',
] as const;

export type EnterpriseEventType = (typeof ENTERPRISE_EVENT_TYPES)[number];

export type EnterpriseEventPayload = {
  eventId?: string;
  eventType: EnterpriseEventType;
  aggregateType:
    | 'BOOKING'
    | 'PAYMENT'
    | 'DRIVER'
    | 'TRIP'
    | 'WAREHOUSE'
    | 'INVENTORY'
    | 'SYSTEM';
  aggregateId: string;
  tenantId?: string;
  actorId?: string;
  correlationId?: string;
  idempotencyKey?: string;
  occurredAt?: string;
  data?: Record<string, unknown>;
};

export type EnterpriseEventEnvelope = Required<
  Pick<
    EnterpriseEventPayload,
    'eventId' | 'eventType' | 'aggregateType' | 'aggregateId' | 'correlationId' | 'occurredAt'
  >
> &
  Omit<
    EnterpriseEventPayload,
    'eventId' | 'eventType' | 'aggregateType' | 'aggregateId' | 'correlationId' | 'occurredAt'
  > & {
    deliveryMode: 'in-process' | 'external-adapter';
  };
