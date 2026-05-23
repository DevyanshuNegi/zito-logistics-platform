# Zito Business Process Flow

**Source PRD:** `docs/prd/ZITO_PRD_v10_ULTIMATE.txt`  
**Purpose:** Business-facing view of how Zito workflows operate across customers, partners, warehouses, finance, and internal operations.

## 1. Business Model

Zito is a logistics orchestration platform. It connects demand and supply without owning trucks, warehouses, or drivers.

Revenue sources:

- Platform commission per booking.
- B2B subscriptions for transporters, courier companies, warehouses, and corporate shippers.
- Value-added services such as routing, analytics, support, compliance, and finance workflows.

Primary marketplace loop:

```mermaid
flowchart LR
  Demand["More shippers and bookings"] --> Supply["More transporters, couriers, drivers, warehouses"]
  Supply --> Coverage["Better coverage and faster matching"]
  Coverage --> Service["Better fulfillment experience"]
  Service --> Demand
```

## 2. User Groups

| Group | Business Role |
|---|---|
| Individual Customer | Books courier, PTL, FTL, warehouse, and urgent services |
| Corporate Shipper | Manages recurring shipments, billing, invoices, multiple addresses |
| Driver | Executes trips, pickup, transit, delivery, proof, earnings |
| Agent | Sources loads/capacity and earns commission |
| Transporter | Supplies vehicles, drivers, dispatch capacity |
| Courier Company | Handles last-mile pickup/delivery operations |
| Warehouse Partner | Receives, stores, scans, picks, packs, dispatches goods |
| Internal Operations | Controls bookings, exceptions, support, compliance |
| Accounts Staff | Handles invoices, payments, refunds, reconciliation |
| Admin/Super Admin | Governance, provisioning, approvals, platform controls |

## 3. Customer Booking Flow

```mermaid
flowchart TD
  A["Customer logs in"] --> B["Select service type"]
  B --> C["Enter pickup, destination, package, schedule"]
  C --> D["Receive quote"]
  D --> E{"Confirm booking?"}
  E -- No --> X["Save or abandon quote"]
  E -- Yes --> F["Booking created"]
  F --> G["Capacity matching / ops approval"]
  G --> H["Driver or partner assigned"]
  H --> I["Pickup and tracking"]
  I --> J["Delivery verification"]
  J --> K["Payment pending / escrow release"]
  K --> L["Completed, invoice, rating, support closeout"]
```

## 4. Booking Operations Flow

| Stage | Owner | Business Decision |
|---|---|---|
| Created | Customer/corporate | Booking details are captured |
| Searching | System/ops | Find capacity and validate serviceability |
| Approved | Operations | Booking can enter assignment/marketplace |
| Assigned | Operations/system | Driver/partner selected |
| Accepted | Driver/partner | Capacity confirms work |
| Arrived/Picked | Driver | Pickup execution confirmed |
| In transit | Driver/system | Live tracking and SLA monitoring |
| Arrived at destination | Driver/customer | Ready for delivery verification |
| Delivery verification | Customer/driver | OTP/proof confirms delivery |
| Delivered | Driver/system | Service delivered |
| Payment pending | Finance/system | Settlement, escrow, invoice |
| Completed | Finance/system | Booking closed |

## 5. Partner Supply Flow

```mermaid
flowchart TD
  A["Partner registers or is provisioned"] --> B["KYC and compliance review"]
  B --> C{"Approved?"}
  C -- No --> D["Pending / rejected / resubmission"]
  C -- Yes --> E["Partner activated"]
  E --> F["Capacity listed or jobs received"]
  F --> G["Accept assignment or bid"]
  G --> H["Execute operational workflow"]
  H --> I["Proof, scan, or status completion"]
  I --> J["Earnings, commission, or settlement"]
```

## 6. Driver Delivery Flow

```mermaid
flowchart TD
  A["Driver starts shift"] --> B["Receives assigned trip"]
  B --> C["Accepts trip"]
  C --> D["Arrives at pickup"]
  D --> E["Marks picked"]
  E --> F["GPS tracking during transit"]
  F --> G["Arrives at destination"]
  G --> H["Delivery OTP / proof of delivery"]
  H --> I["Marks delivered"]
  I --> J["Earnings and payout pipeline"]
```

## 7. Warehouse Flow

Operational warehouse flow:

```mermaid
flowchart TD
  A["Inbound goods expected"] --> B["Scan receiving"]
  B --> C["GRN and discrepancy check"]
  C --> D{"Damage or mismatch?"}
  D -- Yes --> E["Quarantine / loss report / support case"]
  D -- No --> F["Putaway to zone/rack/bin"]
  F --> G["Inventory available"]
  G --> H["Pick list generated"]
  H --> I["Pick, pack, scan"]
  I --> J["Dispatch manifest / waybill"]
  J --> K["Outbound delivery or customer pickup"]
```

Warehouse marketplace listing and booking flow:

```mermaid
flowchart TD
  A["Warehouse Partner logs in"] --> B["Submit warehouse listing"]
  B --> C["Company, VAT, documents, photos, rates, capacity, area"]
  C --> D["Admin review queue"]
  D --> E{"Admin decision"}
  E -- "Approve" --> F["Listing visible to customers"]
  E -- "Request changes" --> B
  E -- "Reject / suspend" --> X["Listing hidden from customers"]
  F --> G["Customer searches approved warehouses"]
  G --> H["Customer selects listing and enters storage needs"]
  H --> I["System calculates rate + handling + VAT"]
  I --> J["Customer books online"]
  J --> K["Warehouse partner accepts / rejects / manages status"]
  K --> L["Goods received and stored"]
  L --> M["Booking completed"]
  M --> N["10% Zito commission recorded"]
  N --> O["Partner settlement / finance ledger"]
```

Warehouse listing business rules:

1. Warehouse partner profile approval and warehouse listing approval are separate controls.
2. A partner may list only warehouses they manage or are explicitly authorized to operate.
3. Customer discovery shows only approved listings.
4. Listings must include rates, capacity, location/area, photos, documents, company details, and VAT setup.
5. Customer booking captures storage type, goods description, dates, requested capacity, and notes.
6. Zito records 10% default commission from the warehouse partner booking value; customer screens do not show internal commission math.

## 8. Marketplace Flow

```mermaid
flowchart TD
  A["Admin / Super Admin onboards partner"] --> B["Partner profile pending review"]
  B --> C{"Approved?"}
  C -- No --> D["Rejected / suspended / changes required"]
  C -- Yes --> E["Partner eligible for marketplace"]
  E --> F["Admin publishes booking opportunity"]
  F --> G{"Pricing model"}
  G -- "Fixed price" --> H["Partner accepts"]
  G -- "Open bid" --> I["Partner submits bid"]
  G -- "Negotiation" --> J["Admin counters / accepts / rejects"]
  H --> K["Opportunity awarded"]
  I --> K
  J --> K
  K --> L["Commission, service fee, premium listing fee recorded"]
  L --> M["Partner net amount and audit trail"]
```

Marketplace controls:

| Control | Business Rule |
|---|---|
| Partner types | Agent, transporter, courier company, warehouse partner |
| Approval | Pending partners cannot accept or bid |
| Matching | Partner type, service area, radius, fleet/warehouse constraints |
| Pricing | Fixed price, open bid, negotiation |
| Admin actions | Publish opportunity, accept/reject/counter bids, suspend partner |
| Revenue | Commission, service fee, premium listing fee, partner net amount |

## 9. Finance Flow

```mermaid
flowchart TD
  A["Quote generated"] --> B["Booking confirmed"]
  B --> C["Payment collection or credit terms"]
  C --> D["Escrow hold / receivable"]
  D --> E["Service fulfilled"]
  E --> F["Escrow release / settlement"]
  F --> G["Invoice generation"]
  G --> H["Reconciliation"]
  H --> I{"Mismatch?"}
  I -- Yes --> J["Accounts follow-up / support ticket"]
  I -- No --> K["Finance closeout"]
```

Warehouse booking commercial path:

```mermaid
flowchart LR
  A["Warehouse booking total"] --> B["Storage rate x capacity x duration"]
  A --> C["Handling fee"]
  A --> D["VAT where applicable"]
  B --> E["Taxable booking value"]
  C --> E
  E --> F["10% Zito commission"]
  E --> G["Partner net amount"]
  D --> H["Customer total"]
  E --> H
```

## 10. Support Flow

```mermaid
flowchart TD
  A["User opens help from workflow"] --> B["Assistant receives context"]
  B --> C{"Resolved automatically?"}
  C -- Yes --> D["Conversation saved"]
  C -- No --> E["Human ticket created"]
  E --> F["Customer care owns ticket"]
  F --> G{"Needs operations/accounts?"}
  G -- Operations --> H["Escalate to operations"]
  G -- Accounts --> I["Escalate to accounts"]
  G -- No --> J["Resolve ticket"]
  H --> J
  I --> J
  J --> K["Close with audit trail"]
```

## 11. Internal Operations Flow

Internal users manage exceptions, approvals, support, compliance, and financial controls.

Daily control rhythm:

1. Review dashboard KPIs, pending approvals, and alerts.
2. Clear booking exceptions and capacity gaps.
3. Monitor SLA breaches, route deviations, and support tickets.
4. Review failed payments, refunds, and unmatched reconciliation items.
5. Approve KYC, partner activation, high-risk changes, and escalations.
6. Audit suspicious login, fraud flags, and operational overrides.

## 12. End-to-End Business Flow

```mermaid
flowchart LR
  Customer["Customer / Corporate Demand"] --> Booking["Booking and Quote"]
  Booking --> Matching["Capacity Matching"]
  Matching --> Partner["Driver / Transporter / Courier / Warehouse"]
  Partner --> Fulfillment["Pickup, Storage, Transit, Delivery"]
  Fulfillment --> Proof["OTP / POD / Scan Proof"]
  Proof --> Finance["Payment, Escrow, Invoice, Settlement"]
  Finance --> Support["Support, Rating, Retention"]
  Support --> Customer
```

## 13. Business Controls

| Control | Purpose |
|---|---|
| OTP login | Protect account access |
| Role-based workspaces | Prevent operational and data leakage |
| KYC approval | Control supply-side trust |
| Booking state machine | Prevent invalid fulfillment steps |
| Delivery verification | Confirm goods reached recipient |
| Escrow and reconciliation | Protect money movement |
| Audit logs | Support governance and investigation |
| SLA alerts | Protect service quality |
| Support escalation | Keep customer and partner issues accountable |
| Warehouse listing review | Prevent unverified warehouses from appearing to customers |
| Marketplace approval | Prevent unapproved partners from accepting paid work |
| Commission ledger | Preserve Zito revenue and partner settlement traceability |
