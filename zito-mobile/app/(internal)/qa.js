import React, { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLockup from '../../src/components/BrandLockup';
import KpiTile from '../../src/components/KpiTile';
import SectionCard from '../../src/components/SectionCard';
import { APP_ENV, API_URL, colors } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

async function fetchHealth() {
  const response = await fetch(`${API_URL}/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

function booleanLabel(value) {
  return value ? 'Yes' : 'No';
}

export default function InternalQaScreen() {
  const { user, token } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState(null);
  const [storage, setStorage] = useState({
    accessToken: false,
    userRecord: false,
  });
  const [error, setError] = useState('');

  const loadDiagnostics = useCallback(async () => {
    setError('');

    try {
      const [tokenValue, userValue, healthResult] = await Promise.all([
        AsyncStorage.getItem('accessToken'),
        AsyncStorage.getItem('user'),
        fetchHealth(),
      ]);

      setStorage({
        accessToken: Boolean(tokenValue),
        userRecord: Boolean(userValue),
      });
      setHealth(healthResult);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load QA diagnostics.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadDiagnostics();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Mobile QA Diagnostics</Text>
            <Text style={styles.subtitle}>
              Confirm the active API host, auth state, and backend health from the real mobile runtime before release.
            </Text>
          </View>
          <BrandLockup mode="compact" showDescriptor={false} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.kpiGrid}>
          <KpiTile label="API host" value={API_URL.replace(/^https?:\/\//, '')} tone={colors.primary} />
          <KpiTile label="App env" value={APP_ENV.toUpperCase()} tone={colors.info} />
          <KpiTile label="Token in context" value={booleanLabel(Boolean(token))} tone={colors.success} />
          <KpiTile label="Health status" value={health ? String(health.status) : '...'} tone={health?.ok ? colors.success : colors.warning} />
        </View>

        <SectionCard title="Runtime summary" subtitle="Current mobile app routing and auth state from this device session.">
          <View style={styles.rowCard}>
            <Text style={styles.rowTitle}>Signed-in role</Text>
            <Text style={styles.copy}>{user?.role || 'No active user'}</Text>
          </View>
          <View style={styles.rowCard}>
            <Text style={styles.rowTitle}>Staff scope</Text>
            <Text style={styles.copy}>{user?.staffScope || 'Not applicable'}</Text>
          </View>
          <View style={styles.rowCard}>
            <Text style={styles.rowTitle}>Stored session records</Text>
            <Text style={styles.copy}>
              AsyncStorage access token: {booleanLabel(storage.accessToken)} | user record: {booleanLabel(storage.userRecord)}
            </Text>
          </View>
        </SectionCard>

        <SectionCard title="Backend health" subtitle="Live probe against the deployed backend origin used by the mobile runtime.">
          <View style={styles.rowCard}>
            <Text style={styles.rowTitle}>Request URL</Text>
            <Text style={styles.copy}>{`${API_URL}/health`}</Text>
          </View>
          <View style={styles.rowCard}>
            <Text style={styles.rowTitle}>Response</Text>
            <Text style={styles.copy}>
              {health
                ? typeof health.payload === 'string'
                  ? health.payload
                  : JSON.stringify(health.payload, null, 2)
                : 'Waiting for response...'}
            </Text>
          </View>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rowCard: {
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
  },
  rowTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  copy: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 6 },
});
