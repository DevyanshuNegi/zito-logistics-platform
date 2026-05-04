# Local Test Users

Last verified against the local Postgres test database on `2026-05-03`.

## How To Use These Accounts

- `Zito Logistics` app login: `http://127.0.0.1:3001/login`
- `Zito Partners` app login: `http://127.0.0.1:3001/partners/login`
- `Zito Internal` login: `http://127.0.0.1:3001/internal/login`
- Current local OTP codes are written to:
  - `C:\Users\Abcom\Desktop\Zito\backend\backend-prod.log`
- Phone login uses `OTP only`.
- Email login uses `OTP first`, then password for email-based completion.
- Confirmed passwords currently documented for manual testing:
  - `customer.demo@zito.local` -> `Customer@123`
  - `vishalgolatkar@yahoo.com` -> `VishalAdmin@2026`
- For the other accounts below, the safest manual path is `phone OTP login`.

## Active Accounts

| App | Role | Name | Email | Phone | Status | Notes |
|---|---|---|---|---|---|---|
| Zito Logistics | CUSTOMER | Demo Individual Customer | `customer.demo@zito.local` | `+919870000101` | ACTIVE | Confirmed password: `Customer@123` |
| Zito Logistics | CUSTOMER | QA Customer | `qa.customer@zito.local` | `+254711000101` | ACTIVE | Use phone OTP |
| Zito Logistics | CORPORATE | QA Corporate | `qa.corporate@zito.local` | `+254711000102` | ACTIVE | Use phone OTP |
| Zito Partners | DRIVER | QA Driver | `qa.driver@zito.local` | `+254711000104` | ACTIVE | Use phone OTP |
| Zito Partners | TRANSPORTER | QA Transporter | `qa.transporter@zito.local` | `+254711000105` | ACTIVE | Use phone OTP |
| Zito Partners | COURIER_COMPANY | QA Courier | `qa.courier@zito.local` | `+254711000103` | ACTIVE | Use phone OTP |
| Zito Partners | WAREHOUSE_PARTNER | QA Warehouse | `qa.warehouse@zito.local` | `+254711000107` | ACTIVE | Use phone OTP |
| Zito Internal | SUPER_ADMIN | QA Super Admin | `qa.superadmin@zito.local` | `+254711000001` | ACTIVE | Use phone OTP |
| Zito Internal | ADMIN | QA Admin | `qa.admin@zito.local` | `+254711000002` | ACTIVE | Use phone OTP |
| Zito Internal | ADMIN | Vishal Golatkar | `vishalgolatkar@yahoo.com` | `+254745759921` | ACTIVE | Confirmed password: `VishalAdmin@2026` |
| Zito Internal | AGENCY_STAFF | QA Staff | `qa.staff@zito.local` | `+254711000106` | ACTIVE | Use phone OTP |
| Zito Internal | ADMIN | Smoke Admin | `smoke.admin@example.com` | `+254700000001` | ACTIVE | Use phone OTP |

## Pending Accounts

These are useful if you want to test the approval / blocked-login flow.

| App | Role | Name | Email | Phone | Status |
|---|---|---|---|---|---|
| Zito Logistics | CUSTOMER | Smoke Customer | `smoke.customer.20260429183259@example.com` | `+254713488616` | PENDING |
| Zito Logistics | CUSTOMER | Devyanshu Negi | `devyanshunegi@gmail.com` | `+918899209614` | PENDING |
| Zito Logistics | CUSTOMER | Vishal Golatkar | `vishal31121987@gmail.com` | `+919768353573` | PENDING |

## Quick Test Paths

- Customer / corporate:
  - open `http://127.0.0.1:3001/login`
- Driver / transporter / courier / warehouse:
  - open `http://127.0.0.1:3001/partners/login`
- Super admin / admin / agency staff:
  - open `http://127.0.0.1:3001/internal/login`

## Important Notes

- `AGENCY_STAFF` is internal, not public partner login.
- `WAREHOUSE_PARTNER` is now part of the partner app path.
- If you want, the next step can be a second file with:
  - ready-made testing checklist by role
  - which screens to verify for each account
  - which accounts are best for `service`, `partners`, and `internal` smoke tests
