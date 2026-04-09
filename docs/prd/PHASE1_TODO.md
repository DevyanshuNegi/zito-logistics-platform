# ZITO Phase 1 TODO (from PRD v6 Final)

## P0 (must finish for Phase 1)
- M-Pesa: keep mock for now; prepare live Daraja STK/callback skeleton gated by env + integration settings (later once keys available).
- Marketplace UI: add Available Loads, My Bids, Submit Offer, Bid Status, Location Interest pages; wire to offer APIs.
- Document/POD system: driver POD upload + storage; vehicle/user compliance docs upload with expiry alerts; admin visibility.
- OTP hardening: persist login OTPs in DB with expiry/attempt limits (use login_otps table), ensure 2FA/reset flows use it. ✅ Done
- Reporting/Exports: admin/agency/transporter consolidated reports with CSV/PDF exports as per PRD (agency export currently placeholder).

## P1 (should follow immediately after P0)
- Invoice pipeline: real PDF invoices/receipts; download endpoints in Customer/Transporter/Admin portals; wire UI buttons.
- Transporter finance: enrich finance summary/invoices endpoints with PRD KPIs and exports.
- Agency portal frontend: build /portal/agency (dashboard, managed accounts, reports/export views) using existing backend data.
- Assignment engine controls: UI to switch Manual/Semi/Full auto; manage customer-specific whitelist/blacklist per PRD §4.2/23.2.
- Notifications delivery: implement SendGrid/FCM/Africa's Talking sending per saved channel toggles (non-blocking jobs).

## P2 (can trail post-launch)
- Settings polish: finish wiring all tabs to system settings, add toasts for save/maintenance actions.
- Ops jobs: scheduled document-expiry alerts; background notification jobs; confirm indexes/limits.
- View As UX: frontend control for super admin impersonation.

Artifacts
- PRD stored at docs/prd/Zito_PRD_v6_Final_document.xml (extracted) and docs/prd/Zito_PRD_v6_Final_docx.zip.
