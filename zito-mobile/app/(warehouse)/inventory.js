import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import SectionCard from '../../src/components/SectionCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { colors } from '../../src/constants/theme';
import { readArray } from '../../src/utils/mobile-data';

export default function WarehouseInventoryScreen() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const payload = await api.get('/inventory');
      setInventory(readArray(payload, 'items'));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const damagedCount = useMemo(
    () => inventory.filter((item) => String(item.status || '').toUpperCase() === 'DAMAGED').length,
    [inventory],
  );
  const missingCount = useMemo(
    () => inventory.filter((item) => String(item.status || '').toUpperCase() === 'MISSING').length,
    [inventory],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.title}>Inventory Flow</Text>
        <Text style={styles.subtitle}>
          Track parcels, storage state, and exception inventory from the warehouse partner workspace.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <SectionCard
          title="Inventory queue"
          subtitle={`Damaged: ${damagedCount} · Missing: ${missingCount} · Total items: ${inventory.length}`}
        >
          {inventory.length === 0 ? (
            <Text style={styles.emptyText}>No inventory items are visible for this account yet.</Text>
          ) : (
            inventory.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.parcelId || item.id}</Text>
                    <Text style={styles.meta}>
                      Weight {Number(item.weight || 0).toLocaleString()} kg · Warehouse {item.warehouseId || 'Unassigned'}
                    </Text>
                  </View>
                  <StatusBadge status={String(item.status || '').toLowerCase()} />
                </View>
                <Text style={styles.copy}>
                  Bin {item.binId || 'Pending'} · Booking {item.bookingId || 'N/A'} · {item.remarks || 'No remarks'}
                </Text>
              </View>
            ))
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  itemCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  itemTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  meta: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
  copy: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
