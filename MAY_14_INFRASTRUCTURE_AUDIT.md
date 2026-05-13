# MAY 14, 2026 - INFRASTRUCTURE AUDIT DAY
**Monday, May 14 - Day 1 of Pre-Launch Preparation**

**Status:** TODAY'S EXECUTION GUIDE  
**Time Block:** 9:00 AM - 5:00 PM UTC+3  
**Team Lead:** [Ops Manager]  
**Goal:** Verify all infrastructure is production-ready

---

## ✅ MORNING SESSION: 9:00 AM - 12:00 PM

### Section 1: Pre-Audit Team Sync (9:00 AM - 9:15 AM)

```
STEP 1: Team Meeting
[ ] Time: 9:00 AM sharp
[ ] Attendees: DevOps, Database Admin, Backend Lead, Ops Manager
[ ] Duration: 15 minutes
[ ] Agenda:
    - Brief overview of May 14 tasks
    - Role assignments for each section
    - Any questions before starting

CHECKLIST:
[ ] DevOps assigned to: Server Infrastructure section
[ ] Database Admin assigned to: Database Setup section
[ ] Backend Lead assigned to: Monitoring Setup section
[ ] Ops Manager assigned to: Documentation & sign-off
```

---

### Section 2: DATABASE SETUP VERIFICATION (9:15 AM - 10:30 AM)
**Owner: Database Admin**

#### Task 2.1: Verify Production Database Server Provisioned

```bash
# TEST 1: Check database server is accessible
COMMAND: ping prod-db.neon.tech
EXPECTED: Server responds (not timed out)
RESULT: __________ ✓ / ✗

# TEST 2: Check network connectivity
COMMAND: curl -I https://prod-db.neon.tech:5432
EXPECTED: Connection established (may show 404, but connection works)
RESULT: __________ ✓ / ✗

# TEST 3: Verify from application server
LOGIN TO: backend server (ssh ops@prod-backend.internal)
COMMAND: psql -h prod-db.neon.tech -U postgres -d template1 -c "SELECT 1;"
EXPECTED: Output: 1 (proves database connection works)
RESULT: __________ ✓ / ✗
```

**If all tests pass:** Continue to 2.2  
**If any test fails:** Escalate to DevOps Lead immediately

---

#### Task 2.2: Verify SSL/TLS Certificates

```bash
# TEST 1: Check certificate validity
COMMAND: openssl s_client -connect prod-db.neon.tech:5432 -showcerts
EXPECTED: 
  - Certificate chain shown
  - Verification: OK
  - Not expired

RECORD:
Certificate Subject: _____________________
Valid Until: _________________ (should be > June 2026)
Status: [ ] VALID ✓ / [ ] EXPIRED ✗

# TEST 2: Verify certificate in database connection string
LOCATION: .env.production (or vault)
CHECK: Connection string includes: ?sslmode=require
RECORD: sslmode=require [ ] YES / [ ] NO
```

**If certificates expired:** ESCALATE - This blocks production  
**If all valid:** Continue to 2.3

---

#### Task 2.3: Test Database Port Accessibility

```bash
# TEST 1: Port 5432 accessible from backend
COMMAND: nc -zv prod-db.neon.tech 5432
EXPECTED: Connection successful
RESULT: __________ ✓ / ✗

# TEST 2: Firewall rules configured
LOCATION: AWS/GCP/Cloud Console → Network Security
CHECK ITEMS:
[ ] Inbound rule: Port 5432 from backend server IP
[ ] Inbound rule: Port 5432 from app server IP
[ ] Outbound: Backend servers can reach database

RECORD:
Firewall rules exist: [ ] YES ✓ / [ ] NO ✗
Rule source IPs: ________________________________
```

**If port not accessible:** Check firewall rules first, then contact cloud provider

---

#### Task 2.4: Verify Backup System Operational

```bash
# TEST 1: Check last backup
COMMAND: (in database console)
SELECT current_setting('archive_command');
SELECT * FROM pg_stat_archiver;

RECORD:
Last archival time: _________________________
Backup status: [ ] ACTIVE ✓ / [ ] FAILED ✗

# TEST 2: Check backup storage
LOCATION: AWS S3 / GCP Storage bucket
COMMAND: List latest backups
EXPECTED: Daily backup files from last 7 days

RECORD:
Latest backup date: ___________________
Number of recent backups: _______________
Backup size (each): ~___________ MB
```

**If no backups found:** ESCALATE - This is critical

---

#### Task 2.5: Check Replication Lag (if applicable)

```bash
# Only if database replication configured

# TEST 1: Check replication status
COMMAND: SELECT slot_name, active FROM pg_replication_slots;

RECORD:
Replication slots: [ ] ACTIVE / [ ] INACTIVE
Lag (bytes): ________ (target: < 1MB)

# TEST 2: Check write-ahead log (WAL)
COMMAND: SELECT pg_current_wal_lsn();

RECORD:
Current WAL position: _____________________
Replication lag: ________ ms (target: < 100ms)
```

**Target:** Replication lag < 100ms  
**If lag > 500ms:** Investigate network/database performance

---

#### Task 2.6: Document Database Connection String

```
DATABASE CONNECTION INFO:
[ ] Connection string location: _____________________
[ ] Example (with redacted credentials):
    postgresql://user:***@prod-db.neon.tech:5432/zito?sslmode=require
    
[ ] Credentials secured in: [ ] Vault / [ ] AWS Secrets Manager / [ ] Other: ____
[ ] Access permissions: [ ] CTO / [ ] Ops / [ ] Backend team
[ ] Rotation schedule: Every ________ days
[ ] Last rotation: _________________________
```

**End of Database Audit:**
Time: ________  
Database Admin Signature: _____________________  
Status: [ ] ALL PASS ✓ / [ ] ISSUES FOUND (list below)

Issues found: ___________________________________________________________

---

### Section 3: SERVER INFRASTRUCTURE VERIFICATION (10:30 AM - 12:00 PM)
**Owner: DevOps Lead**

#### Task 3.1: Production Servers Provisioned

```bash
# PRODUCTION SERVERS INVENTORY:

SERVER 1: prod-backend-1
[ ] Hostname: prod-backend-1
[ ] IP Address: ____________________
[ ] Region/Zone: ____________________
[ ] Instance Type: (e.g., t3.large)
[ ] Status: [ ] RUNNING ✓ / [ ] STOPPED ✗

SERVER 2: prod-backend-2 (HA backup)
[ ] Hostname: prod-backend-2
[ ] IP Address: ____________________
[ ] Region/Zone: ____________________
[ ] Instance Type: (e.g., t3.large)
[ ] Status: [ ] RUNNING ✓ / [ ] STOPPED ✗

SERVER 3: prod-frontend-1
[ ] Hostname: prod-frontend-1
[ ] IP Address: ____________________
[ ] Region/Zone: ____________________
[ ] Instance Type: (e.g., t3.medium)
[ ] Status: [ ] RUNNING ✓ / [ ] STOPPED ✗

VERIFICATION COMMAND (from jump box):
for server in prod-backend-1 prod-backend-2 prod-frontend-1; do
  echo "Checking $server..."
  ssh ops@$server "uptime"
done

Expected: All servers respond with uptime
Result: __________ ✓
```

---

#### Task 3.2: Load Balancer Configuration

```bash
# TEST 1: Load balancer status
LOCATION: Cloud Console → Load Balancing
CHECK:
[ ] Load balancer: ACTIVE
[ ] Backend pool 1: prod-backend-1 [ ] HEALTHY / [ ] UNHEALTHY
[ ] Backend pool 2: prod-backend-2 [ ] HEALTHY / [ ] UNHEALTHY
[ ] Health check: ENABLED
[ ] Health check interval: __________ seconds (typical: 10s)

# TEST 2: Test load balancer endpoint
COMMAND: curl -I https://api.zito-production.com/api/v1/health
EXPECTED: 200 OK
RESULT: __________ ✓ / ✗

# TEST 3: Verify load balancing working
COMMAND: for i in {1..10}; do 
  curl -s https://api.zito-production.com/api/v1/health | grep hostname; 
done
EXPECTED: Mix of backend-1 and backend-2 hostnames
RESULT: __________ ✓ / ✗
```

**If load balancer not working:** ESCALATE immediately

---

#### Task 3.3: Firewall Rules Configuration

```bash
# FIREWALL RULES CHECKLIST:

[ ] Inbound HTTP (80) from internet? [ ] YES / [ ] NO (should be NO - redirect to 443)
[ ] Inbound HTTPS (443) from internet? [ ] YES ✓
[ ] Inbound SSH (22) from admin IPs only? [ ] YES ✓
[ ] Inbound Database (5432) from backend servers? [ ] YES ✓
[ ] Outbound to internet (443) for external APIs? [ ] YES ✓
[ ] Outbound to payment gateway (M-Pesa)? [ ] YES ✓
[ ] All other ports: [ ] BLOCKED ✓

COMMAND: (review in cloud console)
Location: Cloud Console → VPC → Firewall Rules
Expected: All rules documented above are visible

Rules verified: [ ] YES ✓ / [ ] NO (list missing rules):
_________________________________________________________________
```

---

#### Task 3.4: VPN Access for Operations Team

```bash
# VPN ACCESS VERIFICATION:

[ ] VPN endpoint configured: _____________________
[ ] VPN certificates installed: [ ] YES ✓ / [ ] NO ✗
[ ] VPN access list updated:
    [ ] DevOps Lead: [email/ID]
    [ ] Backend Lead: [email/ID]
    [ ] Database Admin: [email/ID]
    [ ] Ops Manager: [email/ID]
    [ ] CTO: [email/ID]

# TEST: Each team member should be able to:
COMMAND: ssh ops@prod-backend-1 "echo VPN access works"

TEST RESULTS:
- DevOps: __________ ✓ / ✗
- Backend Lead: __________ ✓ / ✗
- Database Admin: __________ ✓ / ✗
- Ops Manager: __________ ✓ / ✗
- CTO: __________ ✓ / ✗
```

**If any access fails:** Regenerate VPN certificate for that user

---

#### Task 3.5: SSL/TLS Certificates for API

```bash
# TEST 1: Certificate validity
COMMAND: openssl s_client -connect api.zito-production.com:443 -showcerts
EXPECTED:
- Verify return code: 0 (ok)
- Not before: [past date]
- Not after: [future date > Dec 2026]

RECORD:
Certificate for: api.zito-production.com
Issued by: Let's Encrypt (or your CA)
Valid until: _________________________
Status: [ ] VALID ✓ / [ ] EXPIRED ✗ / [ ] EXPIRING SOON

# TEST 2: Certificate chain complete
COMMAND: curl -I https://api.zito-production.com/api/v1/health
EXPECTED: 200 OK (certificate valid)
RESULT: __________ ✓ / ✗

# TEST 3: Certificate renewal scheduled
CHECK: Auto-renewal configured
Location: [cert renewal service]
Next renewal date: _________________________
Status: [ ] AUTOMATIC ✓ / [ ] MANUAL (risky!)
```

**If certificate expires within 30 days:** Schedule renewal immediately

---

#### Task 3.6: Server Resource Verification

```bash
# CHECK EACH PRODUCTION SERVER:

FOR: prod-backend-1
COMMAND: ssh ops@prod-backend-1 "df -h && free -h && nproc"

Results:
Disk space available: __________ GB (target: > 100GB free)
Memory available: __________ GB (target: > 4GB free)
CPU cores: __________
Disk usage: _________% (target: < 70%)

FOR: prod-backend-2
(repeat above)

FOR: prod-frontend-1
(repeat above)

RECORDING TABLE:
| Server | Disk Free | Memory Free | CPU Cores | Status |
|--------|-----------|-------------|-----------|--------|
| prod-backend-1 | ___ GB | ___ GB | ___ | [ ] OK |
| prod-backend-2 | ___ GB | ___ GB | ___ | [ ] OK |
| prod-frontend-1 | ___ GB | ___ GB | ___ | [ ] OK |

Target: All servers have > 50% free disk, > 4GB free memory
Status: [ ] ALL PASS ✓ / [ ] ISSUES (list):
```

---

**End of Server Infrastructure Audit:**
Time: ________  
DevOps Lead Signature: _____________________  
Status: [ ] ALL PASS ✓ / [ ] ISSUES FOUND (list below)

Issues found: ___________________________________________________________

---

## ☕ LUNCH BREAK: 12:00 PM - 1:00 PM

**Team Lunch Review (informal, 15 min):**
- [ ] Database audit: All pass ✓
- [ ] Server audit: All pass ✓
- [ ] Any blockers so far? [List or "None"]
- [ ] Afternoon confidence: High / Medium / Low

---

## ✅ AFTERNOON SESSION: 1:00 PM - 5:00 PM

### Section 4: MONITORING & ALERTING SETUP (1:00 PM - 4:00 PM)
**Owner: Backend Lead + Ops Manager**

#### Task 4.1: Monitoring Platform Access

```bash
# DATADOG / MONITORING DASHBOARD:

[ ] Datadog account created: [ ] YES ✓ / [ ] NO ✗
[ ] Datadog agents installed on all servers:
    [ ] prod-backend-1: [ ] YES ✓ / [ ] NO ✗
    [ ] prod-backend-2: [ ] YES ✓ / [ ] NO ✗
    [ ] prod-frontend-1: [ ] YES ✓ / [ ] NO ✗

VERIFICATION COMMAND:
ssh ops@prod-backend-1 "systemctl status datadog-agent"
Expected: active (running)
Result: __________ ✓ / ✗

# DASHBOARD VERIFICATION:
[ ] Login to Datadog: https://app.datadoghq.com
[ ] Verify: All 3 servers showing in Infrastructure list
[ ] Verify: Metrics being collected (CPU, Memory, Disk, Network)
```

**If agents not installed:** Install now using Datadog installer script

---

#### Task 4.2: Create Key Metrics Dashboard

```bash
# CREATE DASHBOARD ITEMS:

DASHBOARD NAME: "ZITO Production - Launch Monitoring"

METRIC 1: API Response Time
[ ] Metric name: http.request.duration
[ ] Aggregation: 99th percentile
[ ] Alert threshold: > 2000ms (2 seconds)
[ ] Widget added to dashboard: [ ] YES ✓

METRIC 2: Error Rate
[ ] Metric name: http.requests.errors / http.requests.total
[ ] Calculation: Percentage
[ ] Alert threshold: > 1%
[ ] Widget added to dashboard: [ ] YES ✓

METRIC 3: Database CPU
[ ] Metric name: system.cpu.user (on db server)
[ ] Aggregation: Average
[ ] Alert threshold: > 80%
[ ] Widget added to dashboard: [ ] YES ✓

METRIC 4: Database Memory
[ ] Metric name: system.mem.used_pct
[ ] Alert threshold: > 85%
[ ] Widget added to dashboard: [ ] YES ✓

METRIC 5: Server CPU (all backends)
[ ] Metric: system.cpu.user
[ ] Group by: hostname
[ ] Alert threshold: > 80% on any server
[ ] Widget added to dashboard: [ ] YES ✓

METRIC 6: Network Bandwidth
[ ] Metric: system.net.bytes_sent + system.net.bytes_rcvd
[ ] Aggregation: per server
[ ] Alert threshold: > 100 Mbps sustained
[ ] Widget added to dashboard: [ ] YES ✓

METRIC 7: Disk Space Usage
[ ] Metric: system.disk.used_pct
[ ] Group by: device
[ ] Alert threshold: > 80% on any disk
[ ] Widget added to dashboard: [ ] YES ✓

METRIC 8: Application Uptime
[ ] Metric: http.requests
[ ] Service: zito-api
[ ] Display: green (up) / red (down)
[ ] Widget added to dashboard: [ ] YES ✓

Dashboard complete: [ ] YES ✓ / [ ] NO (complete items above)
```

---

#### Task 4.3: Configure Alert Channels

```bash
# ALERT NOTIFICATION CHANNELS:

CHANNEL 1: Email Alerts
[ ] Recipients configured:
    [ ] ops@zito.com (primary)
    [ ] cto@zito.com (CTO)
    [ ] devops-on-call@zito.com (on-call)

CHANNEL 2: Slack Alerts
[ ] Slack workspace connected: [ ] YES ✓
[ ] Slack channel: #production-alerts
[ ] Test alert sent: [ ] YES ✓ / [ ] NO ✗

CHANNEL 3: SMS/PagerDuty (for critical)
[ ] PagerDuty integrated: [ ] YES ✓ / [ ] NO (skip if cost concern)
[ ] On-call rotation configured

VERIFICATION:
[ ] Send test alert to each channel
[ ] Confirm receipt:
    - [ ] Email received: Time: __________
    - [ ] Slack received: Time: __________
    - [ ] SMS received: Time: __________ (if configured)
```

---

#### Task 4.4: Create Alert Rules

```bash
# ALERT RULE CONFIGURATION:

ALERT 1: High Error Rate
[ ] Condition: Error rate > 1% for 5 minutes
[ ] Severity: CRITICAL
[ ] Notification: All channels
[ ] Status: [ ] CREATED ✓

ALERT 2: High API Latency
[ ] Condition: API p99 latency > 2000ms for 10 minutes
[ ] Severity: WARNING
[ ] Notification: Email + Slack
[ ] Status: [ ] CREATED ✓

ALERT 3: High Database CPU
[ ] Condition: Database CPU > 80% for 5 minutes
[ ] Severity: CRITICAL
[ ] Notification: All channels + escalate to CTO
[ ] Status: [ ] CREATED ✓

ALERT 4: High Database Memory
[ ] Condition: Memory > 85% for 5 minutes
[ ] Severity: WARNING
[ ] Notification: Email + Slack
[ ] Status: [ ] CREATED ✓

ALERT 5: Server Disk Space Low
[ ] Condition: Disk used > 80% for any server
[ ] Severity: CRITICAL
[ ] Notification: All channels
[ ] Status: [ ] CREATED ✓

ALERT 6: Backend Server Down
[ ] Condition: Server down (no heartbeat) for 1 minute
[ ] Severity: CRITICAL
[ ] Notification: All channels + page on-call
[ ] Status: [ ] CREATED ✓

ALERT 7: Payment Gateway Unavailable
[ ] Condition: M-Pesa API fails for 2+ requests
[ ] Severity: CRITICAL
[ ] Notification: All channels + escalate
[ ] Status: [ ] CREATED ✓

All alerts configured: [ ] YES ✓ (all checked above)
```

---

#### Task 4.5: Test Monitoring System

```bash
# TEST 1: Verify all metrics collecting
COMMAND: (in Datadog UI)
1. Go to: Metrics → Summary
2. Search: "system" and "http"
3. Verify: All metrics listed and collecting

Result:
[ ] System metrics collecting: YES ✓
[ ] HTTP metrics collecting: YES ✓
[ ] Timestamp: (should be current)

# TEST 2: Send test alert
COMMAND: (trigger test alert in Datadog)
1. Go to: Alerts → Alert Rules
2. Find: One alert
3. Click: "Test Notification"
4. Wait: 30 seconds

Result:
[ ] Email alert received: YES ✓ Time: __________
[ ] Slack alert received: YES ✓ Time: __________

# TEST 3: Verify dashboard displays data
COMMAND: (in Datadog UI)
Open: Monitoring dashboard created above
Verify: All 8 widgets showing data (not empty)

Result:
[ ] All widgets populated: YES ✓
[ ] Data is current: YES ✓
```

**If metrics not collecting:** Check agent installation on servers

---

#### Task 4.6: Create Baseline Metrics Spreadsheet

```
Create file: c:\Users\Abcom\Desktop\Zito\INFRASTRUCTURE_BASELINE_MAY14.csv

Headers:
Date, Time, Metric, Value, Unit, Status, Notes

Example rows:
2026-05-14, 14:30, Database CPU, 35%, %, NORMAL, Baseline captured
2026-05-14, 14:30, Backend Memory, 42%, %, NORMAL, Good headroom
2026-05-14, 14:30, API Latency p95, 450ms, ms, GOOD, Within target
2026-05-14, 14:30, Error Rate, 0.02%, %, EXCELLENT, Very low
2026-05-14, 14:30, Disk Space, 65% used, %, NORMAL, > 50% free

Instructions:
1. Record current values for all key metrics
2. These will be compared during launch
3. Keep this file for reference
```

**Spreadsheet created:** [ ] YES ✓

---

**End of Monitoring Setup:**
Time: ________  
Backend Lead Signature: _____________________  
Status: [ ] ALL PASS ✓ / [ ] ISSUES FOUND (list below)

Issues found: ___________________________________________________________

---

## ✅ END OF DAY: 4:00 PM - 5:00 PM

### Section 5: DOCUMENTATION & TEAM SYNC

#### Task 5.1: Document Infrastructure Readiness

```
INFRASTRUCTURE AUDIT SUMMARY - May 14, 2026

DATABASE:
✓ Server provisioned and accessible
✓ SSL/TLS certificates valid
✓ Port 5432 accessible
✓ Backup system operational
✓ Connection string secured
Status: [ ] READY FOR PRODUCTION

SERVERS:
✓ Production servers running (prod-backend-1, prod-backend-2, prod-frontend-1)
✓ Load balancer configured and healthy
✓ Firewall rules in place
✓ VPN access verified
✓ SSL certificates valid (expires: __________)
✓ Resource utilization normal
Status: [ ] READY FOR PRODUCTION

MONITORING:
✓ Datadog agents installed on all servers
✓ Key metrics dashboard created
✓ Alert channels configured (Email, Slack)
✓ Alert rules created (7 critical alerts)
✓ Test alerts verified working
Status: [ ] READY FOR PRODUCTION

ISSUES FOUND TODAY:
[List any issues or "NONE - ALL SYSTEMS GO"]
_________________________________________________________________

NEXT STEPS (May 15):
1. Code verification (Backend, Frontend, Mobile)
2. Execute deployment dry run
3. Review results

OVERALL ASSESSMENT: [ ] READY TO PROCEED / [ ] HOLD FOR ISSUES
```

---

#### Task 5.2: Team End-of-Day Sync (4:30 PM - 5:00 PM)

```
ATTENDEES: DevOps, DB Admin, Backend Lead, Ops Manager

AGENDA (30 minutes):
[ ] Database audit results: PASS ✓
[ ] Server infrastructure: PASS ✓
[ ] Monitoring setup: PASS ✓
[ ] Any blockers: [List or NONE]
[ ] Tomorrow's focus: Code verification

CONFIDENCE CHECK:
Rate team confidence (1-10): _____
- 9-10: All systems go, no concerns
- 7-8: Minor issues, easily resolved
- 5-6: Some concerns, needs review
- 1-4: Major issues, escalate

SIGN-OFF:
DevOps Lead: _____________________ ✓
DB Admin: _____________________ ✓
Backend Lead: _____________________ ✓
Ops Manager: _____________________ ✓

ALL SYSTEMS GO FOR MAY 15: [ ] YES ✓ / [ ] NO (list issues)
```

---

### Task 5.3: Document & Commit to Git

```bash
COMMAND: Create summary document
File: MAY_14_AUDIT_SUMMARY.md

Content: Copy the Infrastructure Audit Summary from above
Include: All sign-offs and verification results

COMMAND: Commit to git
git add MAY_14_AUDIT_SUMMARY.md INFRASTRUCTURE_BASELINE_MAY14.csv
git commit -m "docs: May 14 infrastructure audit - All systems verified ready"
git push origin main

Expected: Commit successful
Result: Commit hash: _________________________
```

---

## 📊 MAY 14 CHECKLIST - FINAL VERIFICATION

```
MORNING TASKS:
[✓] Team sync (9:00 AM)
[_] Database setup verification (9:15 - 10:30 AM)
[_] Server infrastructure verification (10:30 AM - 12:00 PM)

AFTERNOON TASKS:
[_] Monitoring & alerting setup (1:00 - 4:00 PM)

END OF DAY:
[_] Documentation & summary (4:00 - 5:00 PM)
[_] Team sync & sign-off (4:30 - 5:00 PM)
[_] Git commit (before 5:30 PM)

FINAL STATUS: ALL TASKS COMPLETE: [ ] YES ✓

Next Day: May 15 - Code Verification Day
```

---

## 🎯 SUCCESS CRITERIA FOR MAY 14

**Must Complete:**
✓ All database checks passed
✓ All servers operational
✓ Load balancer working
✓ Monitoring active
✓ Alerts configured
✓ Team confidence: 8+/10
✓ All documentation complete
✓ Code committed and pushed

**If All Complete:** Proceed to May 15  
**If Any Fail:** Escalate and remediate before moving forward

---

**End of May 14 Execution Guide**

**Prepared by:** GitHub Copilot  
**Date Created:** May 13, 2026  
**Status:** READY FOR EXECUTION  

**Next:** Start at 9:00 AM tomorrow with Team Sync

