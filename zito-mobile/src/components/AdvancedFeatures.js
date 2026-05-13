import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Feature #15: Predictive ETA
 */
export const PredictiveETACard = ({ eta, confidence, baseEta, traffic }) => {
  const etaDifference = eta - baseEta;
  const isDelayed = etaDifference > 0;

  return (
    <View style={s.etaCard}>
      <View style={s.mainRow}>
        <View>
          <Text style={s.label}>📍 Estimated Arrival</Text>
          <Text style={s.eta}>
            {Math.round(eta)} min
          </Text>
        </View>
        <View style={s.confidenceBox}>
          <Text style={s.confidenceLabel}>Confidence</Text>
          <Text style={s.confidenceValue}>{confidence}%</Text>
        </View>
      </View>

      {traffic && (
        <View style={s.trafficInfo}>
          <Text style={s.trafficEmoji}>{traffic === 'heavy' ? '🔴' : traffic === 'moderate' ? '🟡' : '🟢'}</Text>
          <Text style={s.trafficText}>{traffic} traffic detected</Text>
        </View>
      )}

      {isDelayed && (
        <Text style={s.delayWarning}>⚠️ +{etaDifference} min due to current conditions</Text>
      )}
    </View>
  );
};

/**
 * Feature #16: Demand Forecasting
 */
export const DemandForecast = ({ surge, recommendation, savings }) => {
  const getSurgeColor = (s) => {
    if (s > 1.5) return '#FF5252';
    if (s > 1.2) return '#FF9500';
    return '#4CAF50';
  };

  return (
    <View style={s.forecastCard}>
      <Text style={s.forecastTitle}>⚡ Smart Booking</Text>
      
      <View style={s.surgeRow}>
        <Text style={s.surgeLabel}>Current Surge</Text>
        <View style={[s.surgeBadge, { backgroundColor: getSurgeColor(surge) + '20' }]}>
          <Text style={[s.surgeValue, { color: getSurgeColor(surge) }]}>
            {surge}x
          </Text>
        </View>
      </View>

      {recommendation && (
        <View style={s.recommendationBox}>
          <Text style={s.recommendationText}>💡 {recommendation}</Text>
        </View>
      )}

      {savings && (
        <Text style={s.savingsText}>💰 Save ~KES {savings} by booking later</Text>
      )}
    </View>
  );
};

/**
 * Feature #17: Subscription Plans
 */
export const SubscriptionCard = ({ plan, price, benefits, currentPlan }) => {
  const isCurrentPlan = plan.id === currentPlan?.id;

  return (
    <View style={[s.planCard, isCurrentPlan && s.currentPlanCard]}>
      {isCurrentPlan && <Text style={s.currentBadge}>✓ Current Plan</Text>}
      
      <Text style={s.planName}>{plan.name}</Text>
      <Text style={s.planPrice}>KES {price}/month</Text>

      <View style={s.benefitsList}>
        {benefits.map((benefit, idx) => (
          <Text key={idx} style={s.benefit}>✓ {benefit}</Text>
        ))}
      </View>

      <TouchableOpacity style={[s.planBtn, isCurrentPlan && s.currentPlanBtn]}>
        <Text style={[s.planBtnText, isCurrentPlan && s.currentPlanBtnText]}>
          {isCurrentPlan ? 'Current' : 'Subscribe'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Feature #18: Carbon Tracking
 */
export const CarbonTrackingCard = ({ carbonToday, carbonMonth, offsetDonations }) => {
  return (
    <View style={s.carbonCard}>
      <Text style={s.carbonTitle}>🌍 Your Carbon Impact</Text>
      
      <View style={s.carbonStats}>
        <View style={s.carbonStat}>
          <Text style={s.carbonLabel}>Today</Text>
          <Text style={s.carbonValue}>{carbonToday} kg CO₂</Text>
        </View>
        <View style={s.carbonStat}>
          <Text style={s.carbonLabel}>This Month</Text>
          <Text style={s.carbonValue}>{carbonMonth} kg CO₂</Text>
        </View>
      </View>

      <TouchableOpacity style={s.offsetBtn}>
        <Text style={s.offsetBtnText}>🌱 Offset Carbon (+KES {offsetDonations})</Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Feature #19: BNPL (Buy Now Pay Later)
 */
export const BNPLOptions = ({ totalAmount, onSelect }) => {
  const installments = [
    { months: 2, rate: 0, name: '2 payments' },
    { months: 3, rate: 2.5, name: '3 payments' },
    { months: 4, rate: 3, name: '4 payments' },
  ];

  return (
    <View style={s.bnplContainer}>
      <Text style={s.bnplTitle}>💳 Pay in Installments</Text>
      
      {installments.map((opt) => {
        const perInstallment = totalAmount / opt.months;
        const total = opt.rate > 0 ? totalAmount * (1 + opt.rate / 100) : totalAmount;
        
        return (
          <TouchableOpacity
            key={opt.months}
            style={s.bnplOption}
            onPress={() => onSelect(opt)}>
            <View>
              <Text style={s.bnplOptionName}>{opt.name}</Text>
              <Text style={s.bnplOptionDetails}>
                KES {Math.round(perInstallment)} × {opt.months} {opt.rate > 0 ? `(+${opt.rate}%)` : '(Interest-free)'}
              </Text>
            </View>
            <Text style={s.bnplTotal}>KES {Math.round(total)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

/**
 * Feature #20: Enhanced Analytics
 */
export const AnalyticsSummary = ({ spendingTrend, topDestination, bestTime, recentAlerts }) => {
  return (
    <View style={s.analyticsContainer}>
      <Text style={s.analyticsTitle}>📊 Your Analytics</Text>

      <View style={s.analyticCard}>
        <Text style={s.analyticLabel}>Spending Trend</Text>
        <Text style={s.analyticValue}>{spendingTrend}</Text>
      </View>

      <View style={s.analyticCard}>
        <Text style={s.analyticLabel}>Top Destination</Text>
        <Text style={s.analyticValue} numberOfLines={1}>{topDestination}</Text>
      </View>

      <View style={s.analyticCard}>
        <Text style={s.analyticLabel}>Best Time to Book</Text>
        <Text style={s.analyticValue}>{bestTime}</Text>
      </View>

      {recentAlerts && recentAlerts.length > 0 && (
        <View style={s.alertsContainer}>
          {recentAlerts.map((alert, idx) => (
            <Text key={idx} style={s.alert}>💡 {alert}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  // ETA
  etaCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
  },
  eta: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
  },
  confidenceBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  confidenceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
  },
  trafficInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  trafficEmoji: {
    fontSize: 16,
  },
  trafficText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  delayWarning: {
    fontSize: 11,
    color: '#FF9500',
    fontWeight: '600',
  },

  // Demand Forecast
  forecastCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  forecastTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  surgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  surgeLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  surgeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  surgeValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  recommendationBox: {
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  recommendationText: {
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
  },
  savingsText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },

  // Subscriptions
  planCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentPlanCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  currentBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 8,
  },
  planName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    marginVertical: 8,
  },
  benefitsList: {
    marginBottom: 12,
  },
  benefit: {
    fontSize: 11,
    color: colors.text,
    marginBottom: 6,
  },
  planBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  planBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },
  currentPlanBtn: {
    backgroundColor: '#E0E0E0',
  },
  currentPlanBtnText: {
    color: colors.text,
  },

  // Carbon
  carbonCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  carbonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  carbonStats: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  carbonStat: {
    flex: 1,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  carbonLabel: {
    fontSize: 10,
    color: '#2E7D32',
  },
  carbonValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B5E20',
    marginTop: 4,
  },
  offsetBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  offsetBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 12,
  },

  // BNPL
  bnplContainer: {
    marginBottom: 16,
  },
  bnplTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  bnplOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bnplOptionName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  bnplOptionDetails: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  bnplTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },

  // Analytics
  analyticsContainer: {
    marginBottom: 16,
  },
  analyticsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  analyticCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  analyticLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  analyticValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  alertsContainer: {
    marginTop: 8,
  },
  alert: {
    fontSize: 11,
    color: colors.warning,
    marginBottom: 6,
  },
});
