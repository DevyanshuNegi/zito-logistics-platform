import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/client';
import BrandLockup from '../../src/components/BrandLockup';
import KpiTile from '../../src/components/KpiTile';
import SectionCard from '../../src/components/SectionCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { colors } from '../../src/constants/theme';
import { readArray } from '../../src/utils/mobile-data';

export default function WarehouseDashboardScreen() {
  const [warehouses, setWarehouses] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const [warehousePayload, inventoryPayload] = await Promise.all([
        api.get('/warehouse'),
        api.get('/inventory'),
      ]);
      setWarehouses(readArray(warehousePayload, 'warehouses'));
      setInventory(readArray(inventoryPayload, 'items'));
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

  const storedCount = useMemo(
    () => inventory.filter((item) => String(item.status || '').toUpperCase() === 'STORED').length,
    [inventory],
  );
  const dispatchCount = useMemo(
    () => inventory.filter((item) => String(item.status || '').toUpperCase() === 'DISPATCHED').length,
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
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Warehouse Partner</Text>
            <Text style={styles.subtitle}>
              Track managed facilities, inventory posture, and operational readiness from the warehouse mobile desk.
            </Text>
          </View>
          <BrandLockup mode="compact" showDescriptor={false} showCompany={false} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.kpiGrid}>
          <KpiTile label="Warehouses" value={String(warehouses.length)} tone={colors.primary} />
          <KpiTile label="Inventory" value={String(inventory.length)} tone={colors.info} />
          <KpiTile label="Stored" value={String(storedCount)} tone={colors.success} />
          <KpiTile label="Dispatching" value={String(dispatchCount)} tone={colors.warning} />
        </View>

        <SectionCard title="Managed locations" subtitle="Active warehouse facilities linked to this partner account.">
          {warehouses.length === 0 ? (
            <Text style={styles.copy}>No warehouse sites are linked to this account yet.</Text>
          ) : (
            warehouses.map((warehouse) => (
              <View key={warehouse.id} style={styles.siteCard}>
                <View style={styles.siteHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.siteTitle}>{warehouse.name}</Text>
                    <Text style={styles.meta}>{warehouse.code} · {warehouse.address || 'Address pending'}</Text>
                  </View>
                  <StatusBadge status={String(warehouse.status || 'active').toLowerCase()} />
                </View>
                <Text style={styles.copy}>
                  Items: {warehouse._count?.items || 0} · Manager:{' '}
                  {warehouse.manager?.fullName || warehouse.manager?.phone || 'Unassigned'}
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
  headRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  copy: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  siteCard: {
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
  },
  siteHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  siteTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
});
