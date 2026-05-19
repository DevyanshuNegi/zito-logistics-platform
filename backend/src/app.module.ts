import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AgenciesModule } from './modules/agencies/agencies.module';
import { StaffModule } from './modules/staff/staff.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { SupportModule } from './modules/support/support.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { WaybillModule } from './modules/waybill/waybill.module';
import { ScanModule } from './modules/scan/scan.module';
import { LossDetectionModule } from './modules/loss-detection/loss-detection.module';
import { RtoModule } from './modules/rto/rto.module';
import { RateCardsModule } from './modules/rate-cards/rate-cards.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { BillingModule } from './modules/billing/billing.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { SlaModule } from './modules/sla/sla.module';
import { StaffPerformanceModule } from './modules/staff-performance/staff-performance.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { RetentionModule } from './modules/retention/retention.module';
import { FraudModule } from './modules/fraud/fraud.module';
import { SurgePricingModule } from './modules/surge-pricing/surge-pricing.module';
import { RouteOptimizationModule } from './modules/route-optimization/route-optimization.module';
import { HeatmapModule } from './modules/heatmap/heatmap.module';
import { CapacityPlanningModule } from './modules/capacity-planning/capacity-planning.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { SystemHealthModule } from './modules/system-health/system-health.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { UssdModule } from './modules/ussd/ussd.module';
import { AiSupportModule } from './modules/ai-support/ai-support.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    PrismaModule, AuthModule, UsersModule, AgenciesModule, StaffModule, BookingsModule, DriversModule, FleetModule, PaymentsModule, NotificationsModule, TrackingModule, SupportModule, WarehouseModule, InventoryModule, WaybillModule, ScanModule, LossDetectionModule, RtoModule, RateCardsModule, InvoicesModule, BillingModule, ContractsModule, AuditModule, SlaModule, ReconciliationModule, StaffPerformanceModule, RetentionModule, AnalyticsModule, FraudModule, SurgePricingModule, RouteOptimizationModule, HeatmapModule, CapacityPlanningModule, AlertsModule, SystemHealthModule, MarketplaceModule, UssdModule, AiSupportModule
  ],
  providers: [GlobalExceptionFilter],
})
export class AppModule {}
