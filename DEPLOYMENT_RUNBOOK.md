# ZITO DEPLOYMENT RUNBOOK
**Version 1.0** | May 13, 2026  
**Classification:** OPERATIONAL | Internal Use Only  
**Target Launch Window:** June 1-7, 2026

---

## EXECUTIVE SUMMARY

This runbook provides step-by-step procedures for deploying ZITO to production. All code is production-ready as of May 13, 2026. APK builds will be available June 1, 2026 after EAS quota reset.

**Current Status:**
- ✅ Backend: READY
- ✅ Frontend: READY
- ✅ Mobile Code: READY
- ⏳ Mobile APKs: Available June 1, 2026
- ✅ Database: READY
- ✅ Infrastructure: READY

**Key Dates:**
- May 13: All code fixes finalized and pushed
- May 14-31: Pre-launch preparation window
- June 1: EAS build quota resets; APKs available
- June 1-7: Launch window (flexible)

---

## SECTION 1: PRE-DEPLOYMENT CHECKLIST (May 14-31)

### 1.1 Infrastructure Verification

**Database:**
- [ ] Production database created and tested
- [ ] All migrations applied
- [ ] Backup verified and restorable
- [ ] Connection pooling configured
- [ ] Monitoring enabled

**Server/API Hosting:**
- [ ] Production API environment configured
- [ ] Environment variables set (.env files secured)
- [ ] SSL certificates installed and valid
- [ ] Firewall rules configured
- [ ] Load balancer tested with mock traffic
- [ ] Auto-scaling policies defined

**Frontend/Web:**
- [ ] CDN configured
- [ ] Static asset caching enabled
- [ ] Domain DNS pointing to production
- [ ] HTTPS enforced
- [ ] Cache headers optimized

**Mobile:**
- [ ] Firebase credentials configured (Android)
- [ ] Apple push certificate installed (iOS)
- [ ] App signing keys secured and backed up
- [ ] Deep linking configured for all 3 apps
- [ ] API endpoint URLs configured for production

### 1.2 Security Verification

**API Security:**
- [ ] Rate limiting configured
- [ ] CORS policies set correctly
- [ ] Authentication tokens expire appropriately
- [ ] Sensitive data encrypted at rest
- [ ] PII fields masked in logs
- [ ] SQL injection protections verified
- [ ] CSRF tokens implemented

**Payment Integration:**
- [ ] M-Pesa production credentials configured
- [ ] Payment webhook endpoints secured
- [ ] Escrow logic tested end-to-end
- [ ] Refund procedures verified
- [ ] PCI compliance checklist completed

**User Data:**
- [ ] Password hashing algorithm (bcrypt) verified
- [ ] OTP generation and validation secure
- [ ] Session tokens rotating correctly
- [ ] Multi-factor auth working if enabled
- [ ] Data retention policy enforced

### 1.3 Performance Verification

**Load Testing:**
- [ ] Backend handles 1000+ concurrent users
- [ ] API response time < 2 seconds (95th percentile)
- [ ] Database queries optimized
- [ ] No N+1 query problems
- [ ] Memory leaks checked

**Frontend:**
- [ ] Page load time < 3 seconds
- [ ] Lighthouse score > 90
- [ ] Mobile First Core Web Vitals green
- [ ] Image optimization complete
- [ ] Bundle size acceptable

**Mobile:**
- [ ] App launch time < 3 seconds
- [ ] Scrolling/animations smooth (60fps)
- [ ] Memory usage < 200MB (typical)
- [ ] Battery drain minimal
- [ ] Offline caching working

### 1.4 Compliance & Legal

**Data Privacy:**
- [ ] Privacy policy reviewed and published
- [ ] Terms of service reviewed and published
- [ ] GDPR/data localization rules understood
- [ ] Data deletion procedures documented
- [ ] User consent flows implemented

**Regulatory:**
- [ ] Payment compliance verified (PCI-DSS)
- [ ] Insurance requirements documented
- [ ] Tax registration completed in all markets
- [ ] License requirements met
- [ ] Compliance audit schedule set

**Business:**
- [ ] Insurance policies active
- [ ] Liability coverage adequate
- [ ] Support SLA defined and staffed
- [ ] Legal review completed
- [ ] Stakeholder sign-offs obtained

---

## SECTION 2: APK BUILD & QA (June 1-3)

### 2.1 APK Build Procedure (June 1)

**Timeline:** ~30 minutes for all 3 APKs

```bash
# Prerequisites: 
# - EAS quota reset on June 1
# - Environment variables verified
# - All code changes pulled from main branch

# Step 1: Navigate to mobile directory
cd zito-mobile

# Step 2: Build all 3 APKs
npm run build:all-preview

# Expected output:
# ✓ Customer APK: com.aurenza.zito.customer (Android)
# ✓ Partner APK: com.aurenza.zito.partner (Android)
# ✓ Admin APK: com.aurenza.zito.admin (Android)

# Step 3: Download APKs from EAS
# - Visit https://expo.dev/accounts/zitoapp/builds
# - Download customer, partner, and admin APKs
# - Verify file sizes match expectations (~85 MB each)

# Step 4: Generate QR codes (auto-generated on EAS)
# - Accessible from EAS dashboard
# - Share with QA team via secure channel
```

**Deliverables:**
- `Zito-Customer-v1.0.0.apk` (in APK_DOWNLOADS/)
- `Zito-Partner-v1.0.0.apk` (in APK_DOWNLOADS/)
- `Zito-Admin-v1.0.0.apk` (in APK_DOWNLOADS/)
- QR codes for each app (in QR_CODES/)

### 2.2 QA Testing (June 1-3)

**Test Device Setup:**
- [ ] Android devices (minimum 2): API 28+
- [ ] iPhone devices (if applicable): iOS 14+
- [ ] Test SIM cards with numbers
- [ ] Test payment accounts created

**Functional Testing:**

Customer App:
- [ ] Login with phone (OTP flow)
- [ ] Create booking (all vehicle types)
- [ ] View tracking in real-time
- [ ] Make payment (dev STK)
- [ ] Upload proof of delivery
- [ ] View invoice/receipt
- [ ] Multi-language switching works
- [ ] Offline mode accessible

Partner App:
- [ ] Login with phone
- [ ] View available jobs
- [ ] Accept job
- [ ] Real-time tracking updates
- [ ] Complete delivery with OTP
- [ ] View earnings
- [ ] Fleet management accessible
- [ ] Support tickets work

Admin App:
- [ ] Login with email
- [ ] Dashboard displays metrics
- [ ] View all bookings
- [ ] Live map shows drivers
- [ ] Create test user accounts
- [ ] Manage disputes
- [ ] Generate reports

**Branding Verification:**
- [ ] ✅ No "Aurenza Limited" in customer/partner apps
- [ ] ✅ Clean "ZITO" logo displayed
- [ ] ✅ Correct app names (Zito Logistics, Zito Partners, Zito Operations)
- [ ] ✅ Correct theme colors (Blue/Orange/Purple)
- [ ] ✅ Phone login as default option
- [ ] ✅ Material Design 3 compliance

**Performance Testing:**
- [ ] App launch < 3 seconds
- [ ] Booking creation < 5 seconds
- [ ] Map load < 2 seconds
- [ ] Payment processing < 10 seconds
- [ ] No crashes or freezes

**Bug Tracking:**
- [ ] All bugs logged with: Device | Version | Reproduction Steps | Screenshot | Severity
- [ ] P0 (Critical): Fix before launch
- [ ] P1 (High): Fix before launch or plan hotfix
- [ ] P2 (Medium): Track for next release
- [ ] P3 (Low): Nice to have

---

## SECTION 3: PRODUCTION DEPLOYMENT (June 3-5)

### 3.1 Pre-Deployment Final Checks (June 3, Evening)

**24 hours before launch:**

```
Daily Checklist:
☐ Backend health check: All services running
☐ Database backup: Fresh backup created
☐ Frontend: Latest code deployed to staging
☐ Mobile APKs: QA sign-off completed
☐ Team: All hands meeting completed
☐ Communications: Stakeholders notified
☐ Support: Escalation procedures distributed
☐ Monitoring: Alerts configured and tested
☐ Rollback: Procedures documented and tested
☐ Leadership: Final GO/NO-GO approval obtained
```

### 3.2 Deployment Steps (June 4, Morning)

**Timeline: 2-4 hours total (off-peak hours recommended)**

#### Step 1: Backend Deployment (30 min)

```bash
# 1. SSH to production server
ssh production-api-server

# 2. Pull latest code
cd /app/zito-backend
git pull origin main

# 3. Install dependencies
npm install

# 4. Run database migrations
npm run migrate:prod

# 5. Build production bundle
npm run build:prod

# 6. Health check
curl http://localhost:3000/api/v1/health

# Expected response: { "status": "ok", "timestamp": "..." }
```

**Success Criteria:**
- ✅ Build completes without errors
- ✅ Health endpoint responds with 200
- ✅ Database migrations successful
- ✅ No error logs in application

#### Step 2: Frontend Deployment (20 min)

```bash
# 1. SSH to web server / CDN
ssh production-web-server

# 2. Pull latest code
cd /app/zito-frontend
git pull origin main

# 3. Install dependencies
npm install

# 4. Build production
npm run build

# 5. Deploy to CDN
npm run deploy:cdn

# 6. Verify deployment
curl https://zito-platform.com

# Expected: Home page loads, no console errors
```

**Success Criteria:**
- ✅ Production build completes
- ✅ Homepage loads in browser
- ✅ All assets served from CDN
- ✅ No 404 or 500 errors

#### Step 3: Smoke Testing (30 min)

**Immediately after deployment:**

```
Web Portal:
☐ Home page loads
☐ Login page accessible
☐ Can create test booking (web)
☐ Dashboard displays data
☐ API responses < 1 second

Backend API:
☐ Health endpoint: 200 OK
☐ Auth endpoint: Working
☐ Booking endpoint: Creating records
☐ Payment endpoint: Connected
☐ No error spikes in logs

Database:
☐ Can read/write data
☐ Backup jobs running
☐ Query performance acceptable
☐ No locked tables
```

#### Step 4: Google Play Store Update (15 min)

**For Android APKs:**

```
1. Log in to Google Play Console
2. For each app (customer, partner, admin):
   ☐ Navigate to Release > Production
   ☐ Upload signed APK
   ☐ Add release notes:
     "ZITO v1.0.0 Launch - Unified Logistics Platform"
   ☐ Review and confirm changes
   ☐ Start rollout at 10% for 24 hours
   ☐ Monitor crash rates
   ☐ If stable, increase to 50%, then 100%

3. Timeline: 
   - 10% rollout: Immediate
   - 50% rollout: After 12 hours (if no issues)
   - 100% rollout: After 24 hours (if no issues)
```

**Success Criteria:**
- ✅ APKs published to Play Store
- ✅ Store listings show correct names and icons
- ✅ Download link works
- ✅ Crash rate < 0.1%

#### Step 5: Apple App Store Update (20 min)

**For iOS Apps:**

```
1. Use Transporter app or App Store Connect
2. For each app (customer, partner, admin):
   ☐ Build signed IPA from Xcode
   ☐ Upload to App Store Connect via Transporter
   ☐ Fill out version info:
     - Version: 1.0.0
     - Build: 1
     - Release notes: "ZITO v1.0.0 Launch"
   ☐ Add app preview screenshots
   ☐ Add app icon (should auto-detect)
   ☐ Submit for review

3. Review timeline: 24-48 hours
   - Will receive notification when approved
   - Can schedule release date or release immediately
```

**Success Criteria:**
- ✅ Apps submitted for review
- ✅ No rejection issues
- ✅ Approved within 48 hours
- ✅ Available on App Store

### 3.3 Launch Communication (June 4, AM)

**Send to all stakeholders:**

```
Subject: ZITO Platform Live - June 4, 2026

Hi Team,

ZITO Logistics Platform is now LIVE! 🚀

📱 Download the apps:
- Customers: "Zito Logistics" on Play Store / App Store
- Partners: "Zito Partners" on Play Store / App Store
- Admin: "Zito Operations" (internal deployment)

🔗 Web Platform: https://zito-platform.com

📞 Support:
- Customer: support@zito.com | +256 XXX XXX XXX
- Partner: partners@zito.com | +256 XXX XXX XXX
- Internal: ops@zito.com | +256 XXX XXX XXX

⚡ Known Limitations:
- [List any known issues]
- Test environment credentials: demo@zito.com / demo123

Thank you for your support!
```

---

## SECTION 4: MONITORING & SUPPORT (First 7 Days)

### 4.1 Real-Time Monitoring

**Dashboards to watch:**

1. **Infrastructure Dashboard:**
   - Server CPU: Target < 70%
   - Memory: Target < 80%
   - Disk: Target < 85%
   - Network latency: < 50ms (p95)

2. **Application Dashboard:**
   - API response time: < 500ms (p95)
   - Error rate: < 0.1%
   - Active users (real-time)
   - Transactions per minute

3. **Payment Dashboard:**
   - M-Pesa success rate: > 99%
   - Failed transactions: Immediate alert if > 1%
   - Refund processing: All completed within SLA

4. **Mobile Dashboard:**
   - Crash rate: < 0.1%
   - ANR (frozen app): < 0.05%
   - User ratings: > 4.0 stars
   - Uninstall rate: < 2% daily

### 4.2 Incident Response

**Severity Levels:**

| Level | Definition | Response Time | Resolution Time |
|-------|-----------|---|---|
| P0 | Production down | 5 min | 30 min |
| P1 | Critical feature broken | 15 min | 2 hours |
| P2 | Degraded performance | 30 min | 4 hours |
| P3 | Minor issue | 2 hours | Next day |

**Escalation Chain:**
1. First-line support (30 min)
2. Engineering team lead (1 hour)
3. CTO/Director (2 hours)
4. CEO notification (if customer impacting)

### 4.3 Daily Health Checks (First 7 Days)

**Each morning, 9 AM:**

```
☐ Overnight error logs reviewed
☐ Database backup status verified
☐ Server resource usage normal
☐ Payment processing working
☐ User signups/activity normal
☐ Any customer complaints reviewed
☐ Mobile app crash rate acceptable
☐ API uptime 99.9%+
```

### 4.4 Support Procedures

**Customer Issues:**

1. Acknowledge within 15 minutes
2. Categorize: Bug | UX | Feature Request | Billing
3. If bug: Assign priority, create ticket
4. If UX: Document feedback, add to backlog
5. If billing: Escalate to accounts team
6. Follow up daily until resolved

**Partner Issues:**

1. Priority: Earnings problems > Delivery > Technical
2. Immediate: If earnings at risk
3. Same-day: If affecting active deliveries
4. Next-day: For non-critical issues

**Internal Staff Issues:**

1. Immediate attention if operational
2. Document for Q2 improvements
3. Provide workarounds if needed
4. Plan fixes in next sprint

---

## SECTION 5: ROLLBACK PROCEDURES

### 5.1 When to Rollback

Rollback to previous version if:
- [ ] Critical bug preventing normal operation
- [ ] Payment processing consistently failing
- [ ] Data corruption detected
- [ ] Security breach identified
- [ ] Server down for > 15 minutes unexpectedly

### 5.2 How to Rollback (Backend)

```bash
# 1. Stop current deployment
ssh production-api-server
systemctl stop zito-api

# 2. Revert to previous commit
cd /app/zito-backend
git revert HEAD
git pull origin main

# 3. Run migrations (reverse)
npm run migrate:prod -- --revert

# 4. Restart service
npm run build:prod
systemctl start zito-api

# 5. Verify
curl http://localhost:3000/api/v1/health

# 6. Notify stakeholders
echo "Rolled back to previous version. Investigating issue..."
```

### 5.3 How to Rollback (Frontend)

```bash
# 1. Stop current deployment
ssh production-web-server

# 2. Revert CDN cache
# Clear cache for current deployment
# Redeploy previous version

# 3. Verify
curl https://zito-platform.com
# Should load previous UI

# 4. Communicate
echo "Frontend rolled back. Investigating issue..."
```

### 5.4 How to Rollback (Mobile APKs)

**Google Play Store:**
- Navigate to Release > Production
- Click "Manage releases"
- Select "Previous release"
- Click "Rollback to this release"
- Confirm

**Apple App Store:**
- Navigate to App Store Connect
- Select app > TestFlight
- Under Builds, select previous version
- Click "Release to App Store"
- Confirm and wait for approval

---

## SECTION 6: POST-LAUNCH SUCCESS METRICS

### 6.1 Week 1 Goals

**User Acquisition:**
- [ ] 100+ customer signups
- [ ] 50+ partner signups
- [ ] 25+ bookings created
- [ ] 10+ successful deliveries

**System Health:**
- [ ] 99.9%+ uptime
- [ ] API response time < 500ms (p95)
- [ ] Zero P0 incidents
- [ ] Error rate < 0.1%

**Business Metrics:**
- [ ] Customer NPS > 40
- [ ] Partner NPS > 50
- [ ] Payment success > 99%
- [ ] Support ticket volume < 10/day

### 6.2 Week 2-4 Goals

**User Growth:**
- [ ] 500+ active customers
- [ ] 200+ active partners
- [ ] 200+ bookings/day
- [ ] 50+ deliveries/day

**Engagement:**
- [ ] 40%+ daily active users
- [ ] 80%+ of customers complete first booking
- [ ] 60%+ repeat bookings within 30 days
- [ ] 90%+ partner acceptance rate

**Operations:**
- [ ] Avg delivery time < 2 hours
- [ ] Customer satisfaction > 4.5/5
- [ ] Partner earnings > expected
- [ ] Zero payment disputes

---

## SECTION 7: DOCUMENTATION & KNOWLEDGE TRANSFER

### 7.1 Required Documentation

- [ ] Architecture overview (system design)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Database schema diagram
- [ ] Deployment guide (this runbook)
- [ ] Troubleshooting guide
- [ ] Operations manual for support team
- [ ] Disaster recovery plan
- [ ] Security checklist

### 7.2 Team Training

- [ ] Backend team: Production debugging
- [ ] Frontend team: Production performance monitoring
- [ ] Mobile team: APK release procedures
- [ ] Support team: Ticket triage and escalation
- [ ] Finance team: Payment reconciliation

### 7.3 Stakeholder Notifications

- [ ] CEO: Launch approval + go-live date
- [ ] Board: Post-launch metrics
- [ ] Investors: First week results
- [ ] Partners: Launch communication + onboarding
- [ ] Customers: Platform availability + onboarding

---

## SECTION 8: QUICK REFERENCE

### Emergency Contacts

```
Production Issues: ops@zito.com | +256 XXX XXX XXX
Lead Engineer: [Name] | [Phone]
CTO: [Name] | [Phone]
CEO: [Name] | [Phone]
```

### Important URLs

```
Production API: https://api.zito.com
Production Web: https://zito-platform.com
Admin Panel: https://admin.zito-platform.com
Mobile Download: https://play.google.com/store/apps/details?id=com.aurenza.zito.customer
EAS Dashboard: https://expo.dev/accounts/zitoapp/builds
Datadog: https://datadoghq.com/...
Sentry: https://sentry.io/...
```

### Important Files

```
Backend Config: /app/zito-backend/.env.production
Frontend Config: /app/zito-frontend/.env.production
Database Backups: /backups/
Logs: /var/log/zito/
```

---

## SIGN-OFF

| Role | Name | Signature | Date |
|------|------|-----------|------|
| CTO | | | |
| Head of Operations | | | |
| Lead Engineer | | | |
| QA Lead | | | |
| Product Manager | | | |
| CEO/Founder | | | |

---

**Document Version:** 1.0  
**Last Updated:** May 13, 2026  
**Next Review:** After first launch (June 5, 2026)
