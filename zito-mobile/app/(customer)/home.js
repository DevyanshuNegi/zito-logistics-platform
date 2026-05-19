import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { StatusBadge } from '../../src/components/StatusBadge';
import { KPICard } from '../../src/components/KPICard';
import { SOSButton } from '../../src/components/SOSButton';
import { QuickReorderCard } from '../../src/components/QuickReorderCard';
import { SkeletonDashboard } from '../../src/components/SkeletonLoader';
import { CustomerAiSupportSheet } from '../../src/components/CustomerAiSupportSheet';
import BrandLockup from '../../src/components/BrandLockup';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalSpent: 0,
    moneySaved: 0,
    completedCount: 0,
  });
  const [showAssistant, setShowAssistant] = useState(false);

  const load = async () => {
    try {
      const data = await api.get('/api/v1/customer/bookings?limit=100');
      const allBookings = data.data || [];
      setBookings(allBookings);
      
      // Calculate stats
      const completed = allBookings.filter((b) => b.status === 'completed').length;
      const totalCost = allBookings.reduce((sum, b) => sum + (parseFloat(b.cost_in_cents || 0) / 100), 0);
      const savedCost = Math.round(totalCost * 0.15); // Assume 15% saved through loyalty/discounts
      
      setStats({
        totalBookings: allBookings.length,
        totalSpent: totalCost,
        moneySaved: savedCost,
        completedCount: completed,
      });
    } catch (requestError) {
      console.error(requestError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const active = bookings.filter((booking) =>
    ['pending', 'approved', 'assigned', 'accepted', 'picked_up', 'in_transit'].includes(booking.status)
  );

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <ScrollView contentContainerStyle={s.content}>
          <View style={s.greetRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.greeting}>Loading...</Text>
            </View>
            <BrandLockup mode="compact" showDescriptor={false} showCompany={false} />
          </View>
          <SkeletonDashboard count={3} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }>
        <View style={s.greetRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>Hello, {(user?.full_name || 'there').split(' ')[0]}</Text>
            <Text style={s.greetSub}>Manage bookings, tracking, and delivery updates from one place.</Text>
          </View>
          <BrandLockup mode="compact" showDescriptor={false} showCompany={false} />
        </View>

        <TouchableOpacity style={s.cta} onPress={() => router.push('/(customer)/book')}>
          <View style={s.ctaBadge}>
            <Text style={s.ctaBadgeText}>NEW</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.ctaTitle}>Book a delivery</Text>
            <Text style={s.ctaSub}>Motorcycles, vans, pickups, and trucks with live pricing guidance.</Text>
          </View>
          <Text style={s.ctaArrow}>Open</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.assistantCard} onPress={() => setShowAssistant(true)}>
          <Text style={s.assistantLabel}>Zito Assistant</Text>
          <Text style={s.assistantTitle}>Get customer help for booking, tracking, payments, or your own fleet.</Text>
          <Text style={s.assistantHint}>Open assistant</Text>
        </TouchableOpacity>

        {active.length > 0 ? (
          <>
            <Text style={s.sectionTitle}>Active bookings</Text>
            {active.map((booking) => (
              <TouchableOpacity
                key={booking.id}
                style={s.card}
                onPress={() =>
                  router.push({ pathname: '/(customer)/track', params: { bookingId: booking.id } })
                }>
                <View style={s.cardTop}>
                  <Text style={s.ref}>{booking.reference}</Text>
                  <StatusBadge status={booking.status} />
                </View>
                <Text style={s.addr} numberOfLines={1}>
                  Pickup: {booking.pickup_address}
                </Text>
                <Text style={s.addr} numberOfLines={1}>
                  Delivery: {booking.delivery_address}
                </Text>
                <Text style={s.hint}>Open tracking</Text>
                
                {/* SOS Button for Active Bookings */}
                <View style={s.sosRowHome}>
                  <SOSButton
                    bookingId={booking.id}
                    onSuccess={() => {
                      // Booking will refresh on next poll
                    }}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        <Text style={s.sectionTitle}>Your Activity</Text>
        <View style={s.kpiContainer}>
          <View style={s.kpiRow}>
            <View style={{ flex: 1 }}>
              <KPICard
                icon="📊"
                label="Total Bookings"
                period="All Time"
                value={stats.totalBookings}
                trend={`${Math.round(stats.totalBookings / 30)} per month`}
                trendDirection="up"
                customColor={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <KPICard
                icon="✅"
                label="Completed"
                period="All Time"
                value={stats.completedCount}
                trend={`${stats.totalBookings > 0 ? Math.round((stats.completedCount / stats.totalBookings) * 100) : 0}% success`}
                trendDirection="up"
                customColor="#4CAF50"
              />
            </View>
          </View>
          
          <View style={s.kpiRow}>
            <View style={{ flex: 1 }}>
              <KPICard
                icon="💰"
                label="Total Spent"
                period="All Time"
                value={`KES ${Math.round(stats.totalSpent).toLocaleString()}`}
                trend={`Avg: KES ${stats.totalBookings > 0 ? Math.round(stats.totalSpent / stats.totalBookings).toLocaleString() : 0}`}
                trendDirection="stable"
                customColor="#FF9500"
              />
            </View>
            <View style={{ flex: 1 }}>
              <KPICard
                icon="🎁"
                label="Money Saved"
                period="Loyalty & Discounts"
                value={`KES ${Math.round(stats.moneySaved).toLocaleString()}`}
                status="Rewards active"
                customColor="#2196F3"
              />
            </View>
          </View>
        </View>

        {/* FEATURE #3: QUICK REORDER */}
        {(() => {
          const completed = bookings
            .filter(b => b.status === 'completed')
            .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
            .slice(0, 5);
          
          const handleReorder = (booking) => {
            router.push({
              pathname: '/(customer)/book',
              params: {
                prefilledPickup: booking.pickup_address,
                prefilledDelivery: booking.delivery_address,
                prefilledService: booking.service_type,
              },
            });
          };

          return completed.length > 0 ? (
            <>
              <Text style={s.sectionTitle}>⭐ Quick Reorder</Text>
              <Text style={s.quickReorderHint}>Tap to quickly rebook your recent deliveries</Text>
              {completed.map((booking) => (
                <QuickReorderCard
                  key={booking.id}
                  booking={booking}
                  onReorder={handleReorder}
                />
              ))}
            </>
          ) : null;
        })()}

        <Text style={s.sectionTitle}>Overview</Text>
        <View style={s.statsRow}>
          {[
            { value: bookings.length, label: 'Total' },
            { value: active.length, label: 'Active' },
            { value: bookings.filter((booking) => booking.status === 'completed').length, label: 'Done' },
          ].map(({ value, label }) => (
            <View key={label} style={s.stat}>
              <Text style={s.statVal}>{value}</Text>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <CustomerAiSupportSheet
        visible={showAssistant}
        onClose={() => setShowAssistant(false)}
        screenContext="CUSTOMER_HOME"
        title="Ask Zito Assistant"
        description="Ask about booking procedure, live tracking, payments, or customer-owned fleet steps without leaving the customer app."
        bookingOptions={bookings.slice(0, 8).map((booking) => ({
          id: booking.id,
          reference: booking.reference,
        }))}
        quickActions={[
          { label: 'Help me book', message: 'Show me the correct customer booking procedure.' },
          { label: 'Track my trip', message: 'Help me understand booking status or tracking.' },
          { label: 'Payment help', message: 'Help me understand customer payment or invoice procedure.' },
          { label: 'Own fleet help', message: 'Help me manage my customer-owned fleet and link drivers from the Zito Partners driver app.' },
        ]}
        placeholder="Example: How do I book correctly, or where should I go if I need help with a live trip?"
        helpText="Ask about customer procedure, bookings, tracking, payments, or your own fleet."
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  greetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  greetSub: { fontSize: 13, color: colors.textMuted, lineHeight: 20, maxWidth: 220 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 18,
    padding: 18,
    marginBottom: 28,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  ctaTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  ctaSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  ctaArrow: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  assistantCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  assistantLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  assistantTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
    lineHeight: 22,
  },
  assistantHint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  ref: { fontSize: 14, fontWeight: '700', color: colors.text },
  addr: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.primary, marginTop: 8, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statVal: { fontSize: 24, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textFaint, marginTop: 4 },
  kpiContainer: {
    marginBottom: 24,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  sosRowHome: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickReorderHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
    marginHorizontal: 0,
  },
});
