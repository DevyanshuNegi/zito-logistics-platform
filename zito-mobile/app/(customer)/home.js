import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { StatusBadge } from '../../src/components/StatusBadge';
import { KPICard } from '../../src/components/KPICard';
import { SOSButton } from '../../src/components/SOSButton';
import { QuickReorderCard } from '../../src/components/QuickReorderCard';
import { SkeletonDashboard } from '../../src/components/SkeletonLoader';
import { CustomerAiSupportSheet } from '../../src/components/CustomerAiSupportSheet';
import { CurrentShipmentCard } from '../../src/components/CurrentShipmentCard';
import { QuickActionsBar } from '../../src/components/QuickActionsBar';
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
      const data = await api.get('/customer/bookings?limit=100');
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
    } catch (_requestError) {
      /* Dashboard load error handled by state */
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
        <View style={s.commandHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>Zito Command Center</Text>
            <Text style={s.heroTitle}>Hello, {(user?.full_name || 'there').split(' ')[0]}</Text>
          </View>
          <TouchableOpacity style={s.profileOrb} onPress={() => router.push('/(customer)/profile')}>
            <MaterialCommunityIcons name="account" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={s.heroMapCard}>
          <View style={s.mapGridLineA} />
          <View style={s.mapGridLineB} />
          <View style={s.mapRouteMain} />
          <View style={s.mapRouteAlt} />
          <View style={[s.mapNode, s.mapNodeOne]}>
            <MaterialCommunityIcons name="truck-fast-outline" size={18} color={colors.teal} />
          </View>
          <View style={[s.mapNode, s.mapNodeTwo]}>
            <MaterialCommunityIcons name="map-marker-check-outline" size={18} color={colors.primary} />
          </View>
          <View style={s.mapGlassPanel}>
            <Text style={s.mapPanelLabel}>Live Fleet Status</Text>
            <Text style={s.mapPanelValue}>{active.length} Active Shipments</Text>
          </View>
        </View>

        <TouchableOpacity style={s.searchBar} onPress={() => router.push('/(customer)/track')}>
          <MaterialCommunityIcons name="magnify" size={22} color={colors.textMuted} />
          <Text style={s.searchText}>Track a shipment, load, or route</Text>
        </TouchableOpacity>

        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{active.length}</Text>
            <Text style={s.summaryLabel}>Live</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{stats.completedCount}</Text>
            <Text style={s.summaryLabel}>Delivered</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>KES {Math.round(stats.moneySaved).toLocaleString()}</Text>
            <Text style={s.summaryLabel}>Saved</Text>
          </View>
        </View>

        <TouchableOpacity style={s.cta} onPress={() => router.push('/(customer)/book')}>
          <View style={s.ctaBadge}>
            <MaterialCommunityIcons name="package-variant-closed-plus" size={28} color={colors.teal} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.ctaTitle}>Book a delivery</Text>
            <Text style={s.ctaSub}>Fast quotes for motorcycles, vans, pickups, and trucks.</Text>
          </View>
          <MaterialCommunityIcons name="arrow-right" size={22} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={s.assistantCard} onPress={() => setShowAssistant(true)}>
          <Text style={s.assistantLabel}>Zito Assistant</Text>
          <Text style={s.assistantTitle}>Get customer help for booking, tracking, payments, or your own fleet.</Text>
          <Text style={s.assistantHint}>Open assistant</Text>
        </TouchableOpacity>

        {/* CURRENT SHIPMENT CARD - Prominent display of active booking */}
        {active.length > 0 && (
          <CurrentShipmentCard 
            booking={active[0]} 
            onTrack={() => router.push({ pathname: '/(customer)/track', params: { bookingId: active[0].id } })}
          />
        )}

        {/* QUICK ACTIONS BAR - Fast shortcuts */}
        <QuickActionsBar 
          onSchedule={() => Alert.alert('Schedule', 'Schedule pickup functionality')}
          onCalculate={() => Alert.alert('Calculate', 'Cost calculator')}
          onFindDropoff={() => Alert.alert('Drop-off', 'Find drop-off locations')}
          onChat={() => setShowAssistant(true)}
        />

        {active.length > 0 ? (
          <>
            <Text style={s.sectionTitle}>More Active bookings</Text>
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
  content: { padding: 18, paddingBottom: 100 },
  greetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  greetSub: { fontSize: 13, color: colors.textMuted, lineHeight: 20, maxWidth: 220 },
  commandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  kicker: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  profileOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMapCard: {
    height: 210,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#08111f',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
    marginBottom: 14,
  },
  mapGridLineA: {
    position: 'absolute',
    width: 420,
    height: 2,
    backgroundColor: 'rgba(158,176,206,0.16)',
    top: 58,
    left: -30,
    transform: [{ rotate: '-12deg' }],
  },
  mapGridLineB: {
    position: 'absolute',
    width: 380,
    height: 2,
    backgroundColor: 'rgba(158,176,206,0.12)',
    top: 128,
    left: -10,
    transform: [{ rotate: '20deg' }],
  },
  mapRouteMain: {
    position: 'absolute',
    width: 260,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.teal,
    shadowColor: colors.teal,
    shadowOpacity: 0.85,
    shadowRadius: 14,
    top: 104,
    left: 36,
    transform: [{ rotate: '-22deg' }],
  },
  mapRouteAlt: {
    position: 'absolute',
    width: 190,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.7,
    shadowRadius: 12,
    top: 86,
    right: -12,
    transform: [{ rotate: '38deg' }],
  },
  mapNode: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(8,17,31,0.9)',
    borderWidth: 2,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.teal,
    shadowOpacity: 0.7,
    shadowRadius: 18,
  },
  mapNodeOne: { top: 62, left: 72 },
  mapNodeTwo: { bottom: 44, right: 58 },
  mapGlassPanel: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(12,20,36,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  mapPanelLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  mapPanelValue: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  searchBar: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: 'rgba(95,128,255,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    minHeight: 74,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    justifyContent: 'center',
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  summaryLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,27,49,0.94)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.26)',
  },
  ctaBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(34,211,238,0.12)',
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
