# ZITO Revenue Streams: Module Impact Matrix
**Date:** May 28, 2026  
**Purpose:** Visual reference showing which modules are impacted by each revenue stream  
**Format:** At-a-glance tables for sprint planning

---

## Module Impact Summary: Which Module Gets What Work?

### 🟢 GREEN (Minor changes required)
### 🟡 YELLOW (Moderate changes required)
### 🔴 RED (Major new features required)
### ⚪ GRAY (No changes needed)

---

## 1. BILLING & PAYMENTS Module

| Revenue Stream | Impact | Priority | Effort | Q Planned |
|---|---|---|---|---|
| Escrow Transaction Fees | 🟡 Add fee tracking & breakdown UI | HIGH | 2 wks | Q2 |
| Recurring Billing Framework | 🔴 NEW - Core dependency | CRITICAL | 4 wks | Q1 |
| SMS/WhatsApp Metering | 🟡 Add notification charges | MEDIUM | 2 wks | Q1 |
| Verification Fees | 🟡 Add fee deduction flow | HIGH | 1.5 wks | Q2 |
| Driver Subscription (auto-deduct) | 🟡 Monthly charge processing | HIGH | 1 wk | Q2 |
| Pickup & Drop Subscriptions | 🟡 Monthly invoice generation | HIGH | 1 wk | Q2 |
| Fast Payout / Advance Payout | 🔴 Fintech integration | HIGH | 3 wks | Q3 |
| Driver Microfinance | 🔴 Loan origination + repayment | HIGH | 4 wks | Q4 |
| Invoice Financing | 🔴 Fintech partner integration | MEDIUM | 2 wks | Q4 |

**Total Effort:** 22 weeks (can parallelize)  
**Key Dependencies:** Fintech partner selection by Q2

**Action:** Create `RecurringBillingService` in Q1; all fintech integrations depend on it

---

## 2. SUBSCRIPTIONS Module (NEW)

| Revenue Stream | Impact | Priority | Effort | Q Planned |
|---|---|---|---|---|
| Driver Subscription Tiers | 🔴 NEW MODULE CORE | CRITICAL | 6 wks | Q2 |
| Fleet Owner SaaS Tiers | 🟡 Codify existing tiers | HIGH | 2 wks | Q2 |
| Pickup & Drop Contracts | 🔴 NEW - recurring templates | HIGH | 4 wks | Q2 |
| Route Optimization Premium | 🟡 Feature gate existing module | MEDIUM | 2 wks | Q3 |
| Predictive Maintenance Alerts | 🟡 Feature gate new feature | MEDIUM | 1 wk | Q3 |

**Total Effort:** 15 weeks  
**Key Dependencies:** Recurring billing framework

**Action:** Create new `subscriptions` module in Q1; all subscription features depend on it

---

## 3. MARKETPLACE Module (Enhancements)

| Revenue Stream | Impact | Priority | Effort | Q Planned |
|---|---|---|---|---|
| Featured Listings | ✅ LIVE | — | — | — |
| Fuel Partner System | 🔴 Add partner type + dashboard | HIGH | 4 wks | Q3 |
| Clearing Agent Referral | 🔴 Add agent type + request flow | MEDIUM | 3 wks | Q3 |
| Agent Franchise Model | 🟡 Add franchise tier tracking | MEDIUM | 2 wks | Q3 |
| Spare Parts Marketplace | 🔴 NEW - e-commerce sub-system | MEDIUM | 6 wks | Q4 |
| Vehicle Service Booking | 🔴 NEW - service network | MEDIUM | 4 wks | Q4 |
| Featured Premium Loads | 🟡 Enhance existing premium feature | LOW | 1.5 wks | Q2 |
| Advertisement Space | 🔴 NEW - ad serving system | MEDIUM | 5 wks | Q3 |

**Total Effort:** 25.5 weeks  
**Key Dependencies:** Marketplace v1 already exists; these are extensions

**Action:** Start fuel partners in Q2 while planning Q4 new sub-systems

---

## 4. LOYALTY Module

| Revenue Stream | Impact | Priority | Effort | Q Planned |
|---|---|---|---|---|
| Referral Program | ✅ LIVE | — | — | — |
| Loyalty Points | ✅ LIVE | — | — | — |

**Total Effort:** 0 (no changes, ensure revenue tracking)

**Action:** Verify in financial reports; no dev work needed

---

## 5. WAREHOUSE Module (Enhancements)

| Revenue Stream | Impact | Priority | Effort | Q Planned |
|---|---|---|---|---|
| Warehouse Booking Commission | ✅ LIVE | — | — | — |
| Cross-Border Logistics Fees | 🟡 Add border fees + agency mgmt | HIGH | 3 wks | Q3 |
| Spare Parts Marketplace | 🟡 Add parts category to warehouse | MEDIUM | 2 wks | Q4 |

**Total Effort:** 5 weeks  
**Key Dependencies:** Multi-country infrastructure (already exists)

**Action:** Q3 focus on cross-border fees; Q4 integrate with parts system

---

## 6. ANALYTICS Module (Dashboards)

| Revenue Stream | Impact | Priority | Effort | Q Planned |
|---|---|---|---|---|
| Revenue Tracking Dashboard | 🟡 NEW - comprehensive dashboard | HIGH | 3 wks | Q1 |
| Subscription Analytics | 🟡 Churn, LTV, cohort analysis | MEDIUM | 2 wks | Q2 |
| Marketplace Analytics | 🟡 Performance by stream | MEDIUM | 2 wks | Q2 |
| All Features (Tracking) | ⚪ Ensure all tracked | LOW | 1 wk | Ongoing |

**Total Effort:** 8 weeks  
**Key Dependencies:** All other modules feed data to analytics

**Action:** Start Q1 with basic dashboard; enhance each quarter

---

## 7. ROUTE OPTIMIZATION Module

| Revenue Stream | Impact | Priority | Effort | Q Planned |
|---|---|---|---|---|
| Route Optimization Premium | 🟡 Feature gate existing features | MEDIUM | 2 wks | Q3 |
| AI Pricing Engine | 🟡 Add ML pricing model | MEDIUM | 4 wks | Q2-Q3 |

**Total Effort:** 6 weeks  
**Key Dependencies:** ML data pipeline needed for pricing model

**Action:** Q3 feature gating; Q2-Q3 ML model development in parallel

---

## 8. FUEL & FLEET Module

| Revenue Stream | Impact | Priority | Effort | Q Planned |
|---|---|---|---|---|
| Fuel Partner Commissions | 🟡 Add partner & discount tracking | HIGH | 2 wks | Q3 |
| Predictive Maintenance Alerts | 🔴 NEW - ML-based maintenance | MEDIUM | 5 wks | Q3 |

**Total Effort:** 7 weeks  
**Key Dependencies:** Fuel module v1 exists; ML pipeline for predictions

**Action:** Q2 plan maintenance model; Q3 implement

---

## 9. DRIVERS Module (App)

| Revenue Stream | Impact | Priority | Effort | Q Planned |
|---|---|---|---|---|
| Driver Subscription UI | 🔴 Subscription tier selection | HIGH | 3 wks | Q2 |
| Fast Payout UI | 🟡 "Quick Cash" tab | HIGH | 2 wks | Q3 |
| Microfinance UI | 🔴 Loan application + tracking | HIGH | 3 wks | Q4 |

**Total Effort:** 8 weeks  
**Key Dependencies:** Backend subscription/fintech APIs

**Action:** Q2 subscription UI; Q3 payout UI; Q4 loan UI

---

## 10. CUSTOMERS Module (App)

| Revenue Stream | Impact | Priority | Effort | Q Planned |
|---|---|---|---|---|
| Verification Fee Purchase | 🟡 Add verification shop | HIGH | 2 wks | Q2 |
| Escrow Transparency | 🟡 Show fee breakdown in booking | MEDIUM | 1.5 wks | Q2 |

**Total Effort:** 3.5 weeks

**Action:** Q2 both features (combined with booking UX work)

---

## 11. ADMIN & OPERATIONS Module

| Revenue Stream | Impact | Priority | Effort | Q Planned |
|---|---|---|---|---|
| Recurring Billing Management | 🟡 Subscription admin dashboard | HIGH | 2 wks | Q2 |
| Verification Management | 🟡 Approval + fee processing | MEDIUM | 1.5 wks | Q2 |
| Fuel Partner Management | 🔴 Partner onboarding + dashboard | HIGH | 3 wks | Q3 |
| Clearing Agent Management | 🔴 Agent network + commission | MEDIUM | 2 wks | Q3 |
| Franchise Management | 🟡 Franchise tier tracking | MEDIUM | 2 wks | Q3 |
| Route Optimization Admin | 🟡 Model management + analytics | MEDIUM | 1.5 wks | Q3 |
| Fintech Admin | 🔴 Loan + payout management | HIGH | 3 wks | Q3-Q4 |
| Advertising Admin | 🔴 Campaign + analytics platform | MEDIUM | 4 wks | Q3 |

**Total Effort:** 19 weeks  
**Key Dependencies:** Each feature's backend APIs

**Action:** Q2 core dashboards; Q3-Q4 partnership dashboards

---

## 12. BACKEND INFRASTRUCTURE

| Component | Impact | Priority | Effort | Q Planned |
|---|---|---|---|---|
| Recurring Billing Service | 🔴 NEW - Critical dependency | CRITICAL | 4 wks | Q1 |
| ML/Data Pipeline | 🔴 NEW - For AI features | HIGH | 3 wks | Q2 |
| Fintech Partner Adapter | 🔴 NEW - Multi-partner pattern | HIGH | 3 wks | Q2-Q3 |
| Ad Serving Infrastructure | 🟡 NEW - Ad network | MEDIUM | 3 wks | Q3 |

**Total Effort:** 13 weeks  
**Key Dependencies:** None (can start immediately)

**Action:** Q1 focus on billing; Q2 on ML & fintech; Q3 on ad infrastructure

---

## Summary: Total Implementation Effort

### By Module:
```
Billing & Payments:         22 weeks
Subscriptions (NEW):        15 weeks
Marketplace:                25.5 weeks
Loyalty:                    0 weeks ✅
Warehouse:                  5 weeks
Analytics:                  8 weeks
Route Optimization:         6 weeks
Fuel & Fleet:               7 weeks
Drivers (App):              8 weeks
Customers (App):            3.5 weeks
Admin & Operations:         19 weeks
Backend Infrastructure:     13 weeks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:                      132 weeks
```

### By Parallelization (Realistic):
- **Sequential Q1-Q2:** 26 weeks (foundation + early features)
- **Parallelize Q2-Q4:** 106 weeks → ~35 weeks with 3-4 parallel workstreams
- **Realistic Total:** 26 + 35 = **61 weeks** (with good team coordination)

### By Team Size:
- **Conservative (2-3 devs):** 61 weeks = **15 months** (Jan-Mar 2027)
- **Moderate (4-5 devs):** 61 weeks ÷ 2 = **8 months** (Jan-Sep 2026) ✅ RECOMMENDED
- **Aggressive (8-10 devs):** 61 weeks ÷ 4 = **4 months** (Jan-May 2026) - Risks quality

**Recommendation:** 4-5 dedicated engineers for 8-month aggressive schedule (Q1-Q4 2026)

---

## Critical Path: Dependency Chain

```
Q1 FOUNDATION (BLOCKING EVERYTHING):
├─ Recurring Billing Service (4 wks)
│  ├─ Required by: Driver tiers, pickup-drop, fleet SaaS
│  └─ Fintech partner RFP issued
│
├─ SMS/WhatsApp Metering (2 wks)
│  └─ Quick revenue
│
└─ Verification Fees (1.5 wks)
   └─ Quick revenue + partnership setup

Q2 SUBSCRIPTION ROLLOUT (FOUNDATION):
├─ Subscriptions Module (6 wks)
│  ├─ Driver tiers (blocks load matching)
│  ├─ Pickup-drop subscriptions
│  └─ Route optimization feature gating
│
├─ Fintech Partner Integration (starts)
│  └─ Needed for Q3 fast payout
│
└─ ML Data Pipeline (3 wks)
   └─ Needed for Q3 AI features

Q3 PARTNERSHIP EXPLOSION:
├─ Fuel Partner System (4 wks)
│  └─ 50+ partners onboarded
├─ Clearing Agent Network (3 wks)
├─ Franchises (2 wks)
├─ Fast Payout (3 wks) - needs fintech partner from Q2
├─ AI Features (pricing, maintenance) - needs ML pipeline from Q2
└─ Ad Platform (5 wks)

Q4 ADVANCED FEATURES:
├─ Microfinance (4 wks) - needs fintech from Q2-Q3
├─ Parts Marketplace (6 wks)
├─ Service Booking (4 wks)
├─ Invoice Financing (2 wks)
└─ Training Platform (3 wks)
```

**Critical Bottlenecks:**
1. **Recurring Billing (Q1)** - Blocks 35% of Year 1 revenue
2. **Fintech Partner Contract (Q1-Q2)** - Blocks 15% of Year 1 revenue
3. **ML Data Pipeline (Q2)** - Blocks 5% but enables future growth

---

## Milestone Gates: Go/No-Go Decisions

### ✅ Q1 Gate (Complete by March 31)
**Requirements for Q2 launch:**
- [ ] Recurring billing framework tested & live
- [ ] SMS metering revenue generating
- [ ] Verification fees revenue generating
- [ ] Fintech partner contract signed OR RFP responses analyzed
- [ ] 25+ fuel partners pre-signed LOI

**Success Criteria:**
- +KES 50M MRR from new features
- Zero P1 bugs in recurring billing
- Fintech partner roadmap finalized

### ✅ Q2 Gate (Complete by June 30)
**Requirements for Q3 launch:**
- [ ] Driver subscriptions: 50K+ drivers on tiers
- [ ] Pickup-drop subscriptions: 1,000+ active contracts
- [ ] Fintech partner integration: Fast payout live
- [ ] ML pricing model: Training complete, A/B test started
- [ ] 50+ fuel partners live

**Success Criteria:**
- +KES 150-250M MRR from all sources
- Driver tier adoption: 30%+ of active driver base
- Fintech fast payout: 1,000+ transactions/month
- Fuel partner revenue: KES 50M+ MRR

### ✅ Q3 Gate (Complete by September 30)
**Requirements for Q4 launch:**
- [ ] All Q3 features generating 80%+ of projected revenue
- [ ] 50+ fuel partners live
- [ ] 10+ clearing agents live
- [ ] Cross-border shipments: 1,000+ bookings/month
- [ ] Franchises: 5+ franchisees onboarded

**Success Criteria:**
- +KES 300-400M MRR from new features
- Total MRR: KES 600M+
- Fuel partners: KES 200M+ MRR
- Less than 20% engineering bug escape rate

### ✅ Q4 Gate (Complete by December 31)
**Final Year-End Review:**
- [ ] All 30 revenue streams live
- [ ] Year 1 revenue: KES 3.6B+ (conservative scenario)
- [ ] MRR run-rate: KES 700M+
- [ ] Gross margin: 57%+
- [ ] Plan finalized for Year 2 expansion (Uganda, Tanzania)

**Success Criteria:**
- Achieved KES 3-5B Year 1 revenue
- Board approval for Series B fundraising
- Partner ecosystem established (50+ fuel, 10+ clearing, 20+ mechanics)

---

## Monthly Tracking Dashboard

### Template for Each Month (Update 1st of month):

```
MONTH: [January 2026]

REVENUE TRACKING:
├─ Total MRR: KES ___ M (target: KES 100M)
├─ By Stream:
│  ├─ Booking Commission: KES __ M
│  ├─ SaaS Subscriptions: KES __ M
│  ├─ Marketplace: KES __ M
│  └─ Fintech: KES __ M
└─ MoM Growth: +__% (target: +25-30%)

FEATURE PROGRESS:
├─ SMS Metering: __% complete
├─ Verification Fees: __% complete
├─ Recurring Billing: __% complete
└─ Action Items: [list]

DEPENDENCY STATUS:
├─ Fintech Partner: [Status - Not Selected / RFP / Negotiating / Signed]
├─ Partner Recruitment: 
│  ├─ Fuel Partners: ___ / 50 target
│  ├─ Clearing Agents: ___ / 10 target
│  └─ Mechanics: ___ / 20 target
└─ Blockers: [list]

TEAM STATUS:
├─ Engineering: ___ FTE (target: ___ FTE)
├─ Product: ___ FTE (target: ___ FTE)
├─ BD: ___ FTE (target: ___ FTE)
└─ Attrition: [any changes]

RISKS & MITIGATIONS:
├─ Risk 1: [Mitigation]
├─ Risk 2: [Mitigation]
└─ Action Items: [list]
```

---

## Quick Action Items: This Week

### For Engineering Lead:
- [ ] Review PHASE_6_IMPLEMENTATION_CHECKLIST.md
- [ ] Identify critical path (recurring billing = top priority)
- [ ] Estimate team size needed (recommend 4-5 engineers Q1-Q4)
- [ ] Schedule sprint 0 planning (Jan 8-12)

### For Product Manager:
- [ ] Review PRD_SECTION_55_REVENUE_MODEL_30_STREAMS.md
- [ ] Create detailed specs for Q1 features (SMS, verification, recurring billing)
- [ ] Design UX mockups for new subscription tiers
- [ ] Align with engineering on dependencies

### For Business Development:
- [ ] Review fuel partner recruitment target (50 by Q3)
- [ ] Create fuel station pitch deck
- [ ] Begin partner outreach (target: 5 LOI by end of January)
- [ ] Initiate fintech partner RFP

### For Finance:
- [ ] Set up revenue tracking by stream
- [ ] Create monthly tracking dashboard (template above)
- [ ] Model financial projections (conservative + optimistic scenarios)
- [ ] Budget allocation for Phase 6 (KES 85M over 12 months)

---

## Final Checklist: Before Q1 Kickoff

- [ ] All 5 documents read by leadership
- [ ] Board/founder approval obtained
- [ ] Phase 6 funding allocated (KES 85M)
- [ ] Engineering team hired / allocated
- [ ] Product team aligned on specs
- [ ] Fintech partner RFP issued
- [ ] Partner recruitment begins
- [ ] Sprint 0 completed (goals, OKRs, schedule)
- [ ] Weekly syncs scheduled (Mon, Wed, Fri)
- [ ] Monthly revenue dashboard live
- [ ] This document printed + visible in war room

---

**Last Updated:** May 28, 2026  
**Status:** Ready for Sprint Planning  
**Next Review:** January 5, 2026 (Q1 Kickoff + Sprint Planning)
