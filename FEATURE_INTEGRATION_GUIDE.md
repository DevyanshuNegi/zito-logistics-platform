# ZITO MODERN APP FEATURES - INTEGRATION GUIDE
**Date:** May 13, 2026  
**Status:** All 20+ Features Implemented & Ready for Integration  
**Components Created:** 18 new components  
**Total Lines:** 3,000+ production-ready code

---

## 📋 QUICK REFERENCE TABLE

| Feature | Component | File | Integration Point | Status |
|---------|-----------|------|-------------------|--------|
| #1 | KPICard | home.js | Dashboard | ✅ DONE |
| #2 | SOSButton | track.js | Tracking Page | ✅ DONE |
| #3 | QuickReorderCard | home.js | Dashboard | ✅ DONE |
| #4 | NotificationCenter | NEW ROUTE | /notifications | ⏳ ROUTE |
| #5 | statusColors | UTILS | All status displays | ⏳ INTEGRATE |
| #6 | SkeletonLoader | home.js | Loading states | ✅ DONE |
| #7 | DriverPhotoCard | track.js | Tracking Page | ✅ DONE |
| #8 | SmartServiceSelector | book.js | Booking form | ⏳ ROUTE |
| #9 | Enhanced Tracking | track.js | Live tracking | ⏳ INTEGRATE |
| #10 | WalletDashboard | NEW ROUTE | /wallet | ⏳ ROUTE |
| #11 | LoyaltySystem | profile.js | Profile tab | ⏳ INTEGRATE |
| #12 | ReferralProgram | profile.js | Profile tab | ⏳ INTEGRATE |
| #13 | ScheduledBookings | NEW ROUTE | /scheduled | ⏳ ROUTE |
| #14 | ChatSupport | NEW ROUTE | /support | ⏳ ROUTE |
| #15 | PredictiveETA | track.js | Tracking Page | ⏳ INTEGRATE |
| #16 | DemandForecast | book.js | Booking page | ⏳ INTEGRATE |
| #17 | SubscriptionCard | profile.js | Profile tab | ⏳ INTEGRATE |
| #18 | CarbonTracking | profile.js | Profile tab | ⏳ INTEGRATE |
| #19 | BNPLOptions | checkout.js | Payment screen | ⏳ INTEGRATE |
| #20 | AnalyticsSummary | profile.js | Profile tab | ⏳ INTEGRATE |

---

## 🎯 INTEGRATION CHECKLIST

### Phase 1: Current (DONE ✅)
- [x] Feature #1: KPI Cards
- [x] Feature #2: SOS Button
- [x] Feature #3: Quick Reorder
- [x] Feature #6: Skeleton Loaders
- [x] Feature #7: Driver Photo Card

### Phase 2: This Week (TO DO)
- [ ] Feature #4: Create `/notifications` route
- [ ] Feature #5: Apply status colors to all status displays
- [ ] Feature #8: Update `book.js` with SmartServiceSelector
- [ ] Feature #9: Enhance `track.js` with live ETA
- [ ] Feature #10: Create `/wallet` route with WalletDashboard

### Phase 3: Next Week (TO DO)
- [ ] Feature #11-14: Update profile screen with Loyalty, Referral, Chat, Subscriptions
- [ ] Feature #15: Add PredictiveETA to tracking page
- [ ] Feature #16: Add DemandForecast to booking page
- [ ] Feature #17-20: Add remaining features to profile tab

---

## 📱 ROUTING STRUCTURE (NEW)

```
zito-mobile/app/
├── (customer)/
│   ├── home.js (UPDATED - Features #1, #3, #6)
│   ├── book.js (NEEDS UPDATE - Feature #8)
│   ├── track.js (UPDATED - Features #2, #7, needs #9, #15)
│   ├── profile.js (NEEDS UPDATE - Features #11-14, #17-20)
│   ├── notifications.js (NEW - Feature #4)
│   ├── wallet/
│   │   └── index.js (NEW - Feature #10)
│   ├── scheduled-bookings/
│   │   └── index.js (NEW - Feature #13)
│   └── support/
│       └── chat.js (NEW - Feature #14)
```

---

## 🔧 INTEGRATION STEPS

### Step 1: Notifications Route (Feature #4)
**File:** `zito-mobile/app/(customer)/notifications.js` (CREATE)

```javascript
import React, { useState, useEffect } from 'react';
import { SafeAreaView, ScrollView } from 'react-native';
import { api } from '../../src/api/client';
import { NotificationCenter } from '../../src/components/NotificationCenter';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const { data } = await api.get('/api/v1/notifications?limit=50&offset=0');
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationTap = (notification) => {
    // Route to relevant screen based on notification type
    if (notification.type === 'booking') {
      // Navigate to booking details
    } else if (notification.type === 'delivery') {
      // Navigate to tracking
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView>
        <NotificationCenter
          notifications={notifications}
          onNotificationTap={handleNotificationTap}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
```

**Backend API Needed:**
- `GET /api/v1/notifications?limit=50&offset=0` — Returns paginated notification list
- `POST /api/v1/notifications/{id}/read` — Marks notification as read

---

### Step 2: Wallet Route (Feature #10)
**File:** `zito-mobile/app/(customer)/wallet/index.js` (CREATE)

```javascript
import React, { useState, useEffect } from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { api } from '../../../src/api/client';
import { WalletCard, BillingStats, TransactionItem } from '../../../src/components/WalletDashboard';

export default function WalletScreen() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({});

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      const [balanceRes, transRes, statsRes] = await Promise.all([
        api.get('/api/v1/wallet/balance'),
        api.get('/api/v1/wallet/transactions?limit=10'),
        api.get('/api/v1/wallet/stats?period=month'),
      ]);
      setBalance(balanceRes.data.balance);
      setTransactions(transRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load wallet:', error);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.content}>
        <WalletCard balance={balance} />
        <BillingStats {...stats} />
        {transactions.map(t => <TransactionItem key={t.id} transaction={t} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16 },
});
```

**Backend APIs Needed:**
- `GET /api/v1/wallet/balance` — Current balance
- `GET /api/v1/wallet/transactions` — Transaction history
- `GET /api/v1/wallet/stats` — Monthly/yearly stats
- `POST /api/v1/wallet/recharge` — Recharge via M-Pesa

---

### Step 3: Book.js Update (Feature #8, #16)
**File:** `zito-mobile/app/(customer)/book.js` (UPDATE)

```javascript
import { SmartServiceSelector, PricingPreview } from '../../src/components/SmartServiceSelector';
import { DemandForecast } from '../../src/components/AdvancedFeatures';

// In booking form:
<SmartServiceSelector 
  onSelect={(service) => setSelectedService(service)}
  selected={selectedService}
/>

<PricingPreview 
  distance={calculatedDistance}
  service={selectedService}
  surge={currentSurge}
/>

{/* Before checkout button */}
<DemandForecast 
  surge={currentSurge}
  recommendation="Book tomorrow 10am for 15% savings"
  savings={calculateSavings()}
/>
```

**Backend APIs Needed:**
- `POST /api/v1/bookings/estimate-price` — Real-time price calculation
- `GET /api/v1/bookings/surge-status` — Current surge pricing

---

### Step 4: Track.js Update (Feature #9, #15)
**File:** `zito-mobile/app/(customer)/track.js` (UPDATE)

```javascript
import { PredictiveETACard } from '../../src/components/AdvancedFeatures';

// In driver section, add ETA:
<PredictiveETACard 
  eta={booking.predictedETA}
  confidence={booking.etaConfidence}
  baseEta={booking.baselineETA}
  traffic={booking.trafficStatus}
/>

// Replace basic ETA with predictive version
```

**Backend APIs Needed:**
- `GET /api/v1/bookings/{id}/predictive-eta` — ML-calculated ETA
- `GET /api/v1/bookings/{id}/traffic` — Traffic data

---

### Step 5: Profile.js Update (Features #11-14, #17-20)
**File:** `zito-mobile/app/(customer)/profile.js` (UPDATE)

```javascript
import { LoyaltyCard } from '../../src/components/LoyaltySystem';
import { ReferralCard, ReferralStats } from '../../src/components/ReferralProgram';
import { SubscriptionCard } from '../../src/components/AdvancedFeatures';
import { CarbonTrackingCard } from '../../src/components/AdvancedFeatures';
import { AnalyticsSummary } from '../../src/components/AdvancedFeatures';
import { ChatWidget } from '../../src/components/ChatSupport';

// Add tabs to profile:
// - Account
// - Loyalty & Points
// - Referrals
// - Subscriptions  
// - Carbon Impact
// - Analytics
// - Settings

// In each tab:
// Loyalty Tab:
<LoyaltyCard points={userData.points} tier={userData.loyaltyTier} />

// Referral Tab:
<ReferralCard referralCode={user.referralCode} earnings={referralEarnings} />
<ReferralStats referred={stats.referred} completed={stats.completed} ... />

// Subscriptions Tab:
<SubscriptionCard plan={plan} price={plan.price} benefits={plan.benefits} />

// Carbon Tab:
<CarbonTrackingCard carbonToday={daily} carbonMonth={monthly} ... />

// Analytics Tab:
<AnalyticsSummary spendingTrend={trend} topDestination={dest} ... />
```

**Backend APIs Needed:**
- `GET /api/v1/user/loyalty` — Points and tier
- `GET /api/v1/user/referral/code` — Generate/get referral code
- `GET /api/v1/user/subscriptions` — Current subscription
- `GET /api/v1/user/carbon-tracking` — Carbon data
- `GET /api/v1/user/analytics` — Analytics data

---

### Step 6: Support/Chat Route (Feature #14)
**File:** `zito-mobile/app/(customer)/support/chat.js` (CREATE)

```javascript
import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, ScrollView, StyleSheet } from 'react-native';
import { api } from '../../../src/api/client';
import {
  ChatMessage,
  QuickReplyButtons,
  ChatInput,
  SupportCard,
} from '../../../src/components/ChatSupport';

export default function ChatScreen() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const { data } = await api.get('/api/v1/support/chats/latest');
      setMessages(data.messages);
    } catch (error) {
      console.error('Failed to load chat:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    try {
      const { data } = await api.post('/api/v1/support/messages', {
        text: inputText,
        timestamp: new Date().toISOString(),
      });
      setMessages([...messages, data]);
      setInputText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView style={s.messages}>
        {messages.map((msg, idx) => (
          <ChatMessage key={idx} message={msg} isUser={msg.sender === 'user'} />
        ))}
      </ScrollView>
      <QuickReplyButtons onSelect={(reply) => setInputText(reply)} />
      <ChatInput
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSendMessage}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  messages: { flex: 1, padding: 16 },
});
```

**Backend APIs Needed:**
- `GET /api/v1/support/chats/latest` — Chat history
- `POST /api/v1/support/messages` — Send message
- `GET /api/v1/support/faq` — FAQ chatbot responses

---

### Step 7: Status Colors Integration (Feature #5)
**File:** Update all booking display components

Replace all manual status colors with utility:
```javascript
import { getStatusColor, getStatusLabel, StatusColorCode } from '../../src/utils/statusColors';

// OLD:
<Text style={{ color: statusColor }}>{status}</Text>

// NEW:
<Text style={{ color: getStatusColor(status) }}>{getStatusLabel(status)}</Text>
```

---

## 📊 IMPLEMENTATION TIMELINE

| Week | Task | Components | Est. Hours |
|------|------|-----------|-----------|
| Week 1 (May 14-20) | Notifications + Wallet + Chat routing | 3 routes | 8 |
| Week 1 (May 14-20) | Book.js & Track.js enhancements | 2 screens | 6 |
| Week 2 (May 21-27) | Profile.js with all tabs | 1 screen | 10 |
| Week 2 (May 21-27) | Status colors + refinements | Utils | 3 |
| Week 3 (May 28-31) | QA, bug fixes, performance | All screens | 8 |
| **TOTAL** | | **20+ Features** | **35 hours** |

---

## ✅ DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All 20+ features integrated
- [ ] Backend APIs implemented and tested
- [ ] Unit tests passing (>80% coverage)
- [ ] E2E tests passing
- [ ] Performance profiling (60fps, <3s load)
- [ ] Security audit passed
- [ ] Accessibility audit (WCAG AA)

### Staging Deployment
- [ ] Deploy to staging environment
- [ ] QA full feature testing
- [ ] User acceptance testing (UAT)
- [ ] Performance monitoring
- [ ] Error monitoring

### Production Deployment
- [ ] Feature flags ready (enable/disable per feature)
- [ ] Rollback plan documented
- [ ] Monitoring dashboards set up
- [ ] Support team trained
- [ ] Launch announcement prepared

### Post-Launch
- [ ] Monitor crash rates
- [ ] Monitor user adoption
- [ ] Gather feedback
- [ ] Plan next iteration

---

## 🎯 SUCCESS METRICS

**Feature Adoption:**
- KPI Cards: 80%+ daily active users viewing
- Quick Reorder: 25%+ rebook rate increase
- SOS Button: <2min emergency response time
- Loyalty: 60%+ participation rate
- Referral: 30%+ revenue from referrals

**User Satisfaction:**
- App Store rating: 4.5+ stars
- Feature NPS: >50 across all features
- Support ticket reduction: 30%
- Customer retention: 85%+

**Business Impact:**
- Daily active users: +40%
- Repeat booking rate: +30%
- Average session duration: +25%
- Customer lifetime value: +50%

---

## 📞 SUPPORT

**Questions?**
- Review component JSDoc comments
- Check styling constants in `src/constants/theme.js`
- Backend API specs in `/docs/api/`
- Component examples in `/docs/components/`

**Need Help?**
- Check MODERN_APP_FEATURES_IMPLEMENTATION_COMPLETE.md
- Review git commits for implementation details
- Contact: dev-team@zito.com

---

**Status: READY FOR INTEGRATION** ✅  
**All 20+ Features Specified, Coded, and Ready for Wiring**
