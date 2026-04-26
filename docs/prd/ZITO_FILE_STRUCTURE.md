# ZITO Super App — Full File Structure (PRD v10 ULTIMATE)

---

## BACKEND — NestJS + Prisma + PostgreSQL

```
backend/
├── prisma/
│   ├── schema.prisma                          # PRD §2,3,6,10,11,14,15,16,40
│   └── migrations/
│
├── src/
│   ├── main.ts
│   ├── app.module.ts
│
│   ├── config/
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   ├── jwt.config.ts
│   │   └── app.config.ts
│
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts             # PRD §33 RBAC
│   │   │   ├── current-user.decorator.ts
│   │   │   └── idempotency.decorator.ts       # PRD §28
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts              # PRD §28
│   │   │   ├── roles.guard.ts                 # PRD §33
│   │   │   └── session.guard.ts               # PRD §44.15
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   ├── interceptors/
│   │   │   ├── audit.interceptor.ts           # PRD §40
│   │   │   └── idempotency.interceptor.ts     # PRD §28
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   └── constants/
│   │       ├── roles.constants.ts
│   │       └── status.constants.ts
│
│   ├── prisma/
│   │   └── prisma.service.ts
│
│   └── modules/
│
│       ├── auth/                              # PRD §3
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── strategies/
│       │   │   ├── jwt.strategy.ts
│       │   │   └── refresh-token.strategy.ts
│       │   ├── dto/
│       │   │   ├── login.dto.ts
│       │   │   ├── verify-otp.dto.ts
│       │   │   ├── send-otp.dto.ts
│       │   │   └── refresh-token.dto.ts
│       │   └── guards/
│       │       └── local-auth.guard.ts
│
│       ├── users/                             # PRD §2, §4
│       │   ├── users.module.ts
│       │   ├── users.controller.ts
│       │   ├── users.service.ts
│       │   └── dto/
│       │       ├── create-user.dto.ts
│       │       ├── update-user.dto.ts
│       │       └── kyc-upload.dto.ts
│
│       ├── agencies/                          # PRD §31
│       │   ├── agencies.module.ts
│       │   ├── agencies.controller.ts
│       │   ├── agencies.service.ts
│       │   └── dto/
│       │       ├── create-agency.dto.ts
│       │       └── update-agency.dto.ts
│
│       ├── staff/                             # PRD §32, §42
│       │   ├── staff.module.ts
│       │   ├── staff.controller.ts
│       │   ├── staff.service.ts
│       │   └── dto/
│       │       ├── create-staff.dto.ts
│       │       └── update-staff.dto.ts
│
│       ├── bookings/                          # PRD §6
│       │   ├── bookings.module.ts
│       │   ├── bookings.controller.ts
│       │   ├── bookings.service.ts
│       │   └── dto/
│       │       ├── create-booking.dto.ts
│       │       ├── update-booking.dto.ts
│       │       └── cancel-booking.dto.ts
│
│       ├── drivers/                           # PRD §7, §8, §44.1, §44.2
│       │   ├── drivers.module.ts
│       │   ├── drivers.controller.ts
│       │   ├── drivers.service.ts
│       │   ├── shift/
│       │   │   ├── shift.controller.ts        # PRD §44.1
│       │   │   ├── shift.service.ts
│       │   │   └── dto/
│       │   │       └── shift.dto.ts
│       │   ├── payroll/
│       │   │   ├── payroll.controller.ts      # PRD §44.2
│       │   │   ├── payroll.service.ts
│       │   │   └── dto/
│       │   │       └── payroll.dto.ts
│       │   ├── incentives/
│       │   │   ├── incentives.controller.ts   # PRD §44.9
│       │   │   └── incentives.service.ts
│       │   └── dto/
│       │       ├── create-driver.dto.ts
│       │       └── update-driver.dto.ts
│
│       ├── fleet/                             # PRD §9
│       │   ├── fleet.module.ts
│       │   ├── fleet.controller.ts
│       │   ├── fleet.service.ts
│       │   ├── fuel/
│       │   │   ├── fuel.controller.ts         # PRD §44.3
│       │   │   └── fuel.service.ts
│       │   ├── breakdown/
│       │   │   ├── breakdown.controller.ts    # PRD §44.4
│       │   │   └── breakdown.service.ts
│       │   └── dto/
│       │       ├── create-vehicle.dto.ts
│       │       └── update-vehicle.dto.ts
│
│       ├── warehouses/                        # PRD §10, §17
│       │   ├── warehouses.module.ts
│       │   ├── warehouses.controller.ts
│       │   ├── warehouses.service.ts
│       │   └── dto/
│       │       ├── create-warehouse.dto.ts
│       │       ├── create-zone.dto.ts
│       │       ├── create-rack.dto.ts
│       │       └── create-bin.dto.ts
│
│       ├── inventory/                         # PRD §11, §12
│       │   ├── inventory.module.ts
│       │   ├── inventory.controller.ts
│       │   ├── inventory.service.ts
│       │   └── dto/
│       │       ├── create-item.dto.ts
│       │       ├── scan-item.dto.ts
│       │       └── move-item.dto.ts
│
│       ├── scan/                              # PRD §12
│       │   ├── scan.module.ts
│       │   ├── scan.controller.ts
│       │   ├── scan.service.ts
│       │   └── dto/
│       │       └── scan-event.dto.ts
│
│       ├── loss-detection/                    # PRD §13, §44.6
│       │   ├── loss-detection.module.ts
│       │   ├── loss-detection.controller.ts
│       │   ├── loss-detection.service.ts
│       │   └── dto/
│       │       ├── create-loss-report.dto.ts
│       │       └── update-loss-status.dto.ts
│
│       ├── waybills/                          # PRD §14
│       │   ├── waybills.module.ts
│       │   ├── waybills.controller.ts
│       │   ├── waybills.service.ts
│       │   └── dto/
│       │       ├── create-waybill.dto.ts
│       │       └── update-waybill.dto.ts
│
│       ├── payments/                          # PRD §15
│       │   ├── payments.module.ts
│       │   ├── payments.controller.ts
│       │   ├── payments.service.ts
│       │   ├── mpesa/
│       │   │   ├── mpesa.service.ts
│       │   │   └── mpesa.controller.ts
│       │   ├── wallet/
│       │   │   ├── wallet.service.ts
│       │   │   └── wallet.controller.ts
│       │   ├── escrow/
│       │   │   ├── escrow.service.ts          # PRD §15 escrow
│       │   │   └── escrow.controller.ts
│       │   └── dto/
│       │       ├── initiate-payment.dto.ts
│       │       ├── verify-payment.dto.ts
│       │       └── refund.dto.ts
│
│       ├── invoices/                          # PRD §16, §44.13
│       │   ├── invoices.module.ts
│       │   ├── invoices.controller.ts
│       │   ├── invoices.service.ts
│       │   └── dto/
│       │       ├── create-invoice.dto.ts
│       │       └── approve-invoice.dto.ts
│
│       ├── billing/                           # PRD §17, §18
│       │   ├── billing.module.ts
│       │   ├── billing.controller.ts
│       │   ├── billing.service.ts
│       │   └── dto/
│       │       └── billing.dto.ts
│
│       ├── rate-cards/                        # PRD §19
│       │   ├── rate-cards.module.ts
│       │   ├── rate-cards.controller.ts
│       │   ├── rate-cards.service.ts
│       │   └── dto/
│       │       └── rate-card.dto.ts
│
│       ├── contracts/                         # PRD §20
│       │   ├── contracts.module.ts
│       │   ├── contracts.controller.ts
│       │   ├── contracts.service.ts
│       │   └── dto/
│       │       └── contract.dto.ts
│
│       ├── sla/                               # PRD §21, §44.10
│       │   ├── sla.module.ts
│       │   ├── sla.controller.ts
│       │   └── sla.service.ts
│
│       ├── notifications/                     # PRD §22
│       │   ├── notifications.module.ts
│       │   ├── notifications.controller.ts
│       │   ├── notifications.service.ts
│       │   ├── channels/
│       │   │   ├── sms.service.ts
│       │   │   ├── email.service.ts
│       │   │   ├── push.service.ts
│       │   │   └── whatsapp.service.ts
│       │   └── dto/
│       │       └── send-notification.dto.ts
│
│       ├── analytics/                         # PRD §27A
│       │   ├── analytics.module.ts
│       │   ├── analytics.controller.ts
│       │   └── analytics.service.ts
│
│       ├── retention/                         # PRD §27B
│       │   ├── retention.module.ts
│       │   ├── retention.controller.ts
│       │   └── retention.service.ts
│
│       ├── audit/                             # PRD §40
│       │   ├── audit.module.ts
│       │   ├── audit.controller.ts
│       │   └── audit.service.ts
│
│       ├── alerts/                            # PRD §39
│       │   ├── alerts.module.ts
│       │   ├── alerts.controller.ts
│       │   └── alerts.service.ts
│
│       ├── tracking/                          # PRD §26
│       │   ├── tracking.module.ts
│       │   ├── tracking.controller.ts
│       │   ├── tracking.service.ts
│       │   └── tracking.gateway.ts            # WebSocket
│
│       ├── support/                           # PRD §25, §36, §37
│       │   ├── support.module.ts
│       │   ├── support.controller.ts
│       │   ├── support.service.ts
│       │   └── dto/
│       │       ├── create-ticket.dto.ts
│       │       └── update-ticket.dto.ts
│
│       ├── fraud/                             # PRD §44.7
│       │   ├── fraud.module.ts
│       │   ├── fraud.controller.ts
│       │   └── fraud.service.ts
│
│       ├── surge-pricing/                     # PRD §44.8
│       │   ├── surge-pricing.module.ts
│       │   ├── surge-pricing.controller.ts
│       │   └── surge-pricing.service.ts
│
│       ├── rto/                               # PRD §44.5 Return System
│       │   ├── rto.module.ts
│       │   ├── rto.controller.ts
│       │   └── rto.service.ts
│
│       ├── route-optimization/                # PRD §44.17
│       │   ├── route-optimization.module.ts
│       │   ├── route-optimization.controller.ts
│       │   └── route-optimization.service.ts
│
│       ├── capacity-planning/                 # PRD §44.18
│       │   ├── capacity-planning.module.ts
│       │   ├── capacity-planning.controller.ts
│       │   └── capacity-planning.service.ts
│
│       ├── marketplace/                       # PRD §44.20
│       │   ├── marketplace.module.ts
│       │   ├── marketplace.controller.ts
│       │   └── marketplace.service.ts
│
│       ├── heatmap/                           # PRD §44.21
│       │   ├── heatmap.module.ts
│       │   ├── heatmap.controller.ts
│       │   └── heatmap.service.ts
│
│       ├── reconciliation/                    # PRD §44.12, §35
│       │   ├── reconciliation.module.ts
│       │   ├── reconciliation.controller.ts
│       │   └── reconciliation.service.ts
│
│       └── staff-performance/                 # PRD §44.16
│           ├── staff-performance.module.ts
│           ├── staff-performance.controller.ts
│           └── staff-performance.service.ts
│
├── .env
├── .env.example
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
└── package.json
```

---

## FRONTEND — Next.js 14 App Router + TypeScript

```
frontend/
├── public/
│
├── src/
│   ├── app/
│   │
│   │   ├── (auth)/                            # PRD §3, §4, §42
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx
│   │   │   ├── verify-otp/
│   │   │   │   └── page.tsx
│   │   │   └── pending-approval/
│   │   │       └── page.tsx
│   │   │
│   │   ├── select-role/                       # PRD §2 multi-role
│   │   │   └── page.tsx
│   │   │
│   │   ├── (customer)/                        # PRD §6, §15, §44.19
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── bookings/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── tracking/
│   │   │   │   └── [bookingId]/
│   │   │   │       └── page.tsx
│   │   │   ├── payments/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── invoices/
│   │   │   │   └── page.tsx
│   │   │   ├── support/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [ticketId]/
│   │   │   │       └── page.tsx
│   │   │   └── profile/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (driver)/                          # PRD §8, §44.1, §44.2
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── shift/
│   │   │   │   └── page.tsx
│   │   │   ├── earnings/
│   │   │   │   └── page.tsx
│   │   │   ├── heatmap/
│   │   │   │   └── page.tsx                  # PRD §44.21
│   │   │   └── profile/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (transporter)/                     # PRD §9
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── fleet/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [vehicleId]/
│   │   │   │       └── page.tsx
│   │   │   ├── drivers/
│   │   │   │   └── page.tsx
│   │   │   └── earnings/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (warehouse)/                       # PRD §10, §11, §12
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── inventory/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [itemId]/
│   │   │   │       └── page.tsx
│   │   │   ├── scan/
│   │   │   │   └── page.tsx
│   │   │   ├── bins/
│   │   │   │   └── page.tsx
│   │   │   └── billing/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (admin)/                           # PRD §24, §38
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── users/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [userId]/
│   │   │   │       └── page.tsx
│   │   │   ├── agencies/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [agencyId]/
│   │   │   │       └── page.tsx
│   │   │   ├── bookings/
│   │   │   │   └── page.tsx
│   │   │   ├── drivers/
│   │   │   │   └── page.tsx
│   │   │   ├── fleet/
│   │   │   │   └── page.tsx
│   │   │   ├── payments/
│   │   │   │   └── page.tsx
│   │   │   ├── invoices/
│   │   │   │   └── page.tsx
│   │   │   ├── rate-cards/
│   │   │   │   └── page.tsx                  # PRD §19
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx                  # PRD §27A
│   │   │   ├── alerts/
│   │   │   │   └── page.tsx                  # PRD §39
│   │   │   ├── audit/
│   │   │   │   └── page.tsx                  # PRD §40
│   │   │   ├── fraud/
│   │   │   │   └── page.tsx                  # PRD §44.7
│   │   │   ├── loss-detection/
│   │   │   │   └── page.tsx                  # PRD §13
│   │   │   ├── staff-performance/
│   │   │   │   └── page.tsx                  # PRD §44.16
│   │   │   ├── reconciliation/
│   │   │   │   └── page.tsx                  # PRD §44.12
│   │   │   └── system-health/
│   │   │       └── page.tsx                  # PRD §44.11
│   │   │
│   │   ├── (staff)/                           # PRD §32, §34, §36, §37
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── bookings/
│   │   │   │   └── page.tsx
│   │   │   ├── support/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [ticketId]/
│   │   │   │       └── page.tsx
│   │   │   ├── dispatch/
│   │   │   │   └── page.tsx
│   │   │   ├── accounts/
│   │   │   │   └── page.tsx
│   │   │   └── reports/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (corporate)/                       # PRD §20
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── bookings/
│   │   │   │   └── page.tsx
│   │   │   ├── invoices/
│   │   │   │   └── page.tsx
│   │   │   └── contracts/
│   │   │       └── page.tsx
│   │   │
│   │   ├── unauthorized/
│   │   │   └── page.tsx
│   │   │
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/                                # Shared UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── Alert.tsx
│   │   ├── maps/
│   │   │   ├── LocationPicker.tsx             # PRD §5
│   │   │   ├── LiveMap.tsx                    # PRD §26
│   │   │   └── HeatmapLayer.tsx               # PRD §44.21
│   │   ├── tracking/
│   │   │   └── TrackingTimeline.tsx
│   │   ├── scan/
│   │   │   └── BarcodeScanner.tsx             # PRD §12
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       ├── Navbar.tsx
│   │       └── RoleGuard.tsx                  # PRD §33
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSocket.ts                       # PRD §26
│   │   ├── useGeolocation.ts                  # PRD §5
│   │   └── useOfflineSync.ts                  # PRD §23
│   │
│   ├── lib/
│   │   ├── api.ts                             # Axios instance
│   │   ├── socket.ts                          # Socket.io client
│   │   └── utils.ts
│   │
│   ├── store/                                 # State management
│   │   ├── auth.store.ts
│   │   ├── booking.store.ts
│   │   └── notification.store.ts
│   │
│   └── types/
│       ├── user.types.ts
│       ├── booking.types.ts
│       ├── driver.types.ts
│       ├── warehouse.types.ts
│       └── payment.types.ts
│
├── .env.local
├── .env.example
├── next.config.ts
├── tsconfig.json
└── package.json
```
