import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

/**
 * ProcessPipeline - Visual representation of delivery status flow
 * Shows: Pending > In Transit > Out for Delivery > Delivered
 */
export const ProcessPipeline = ({ status }) => {
  const steps = [
    { key: 'pending', label: 'Pending', emoji: '📝' },
    { key: 'in_transit', label: 'In Transit', emoji: '🚛' },
    { key: 'out_for_delivery', label: 'Out for Delivery', emoji: '🚗' },
    { key: 'delivered', label: 'Delivered', emoji: '✅' },
  ];

  // Map booking status to pipeline status
  const statusToPipeline = {
    'pending': 'pending',
    'approved': 'pending',
    'assigned': 'pending',
    'accepted': 'in_transit',
    'picked_up': 'in_transit',
    'in_transit': 'in_transit',
    'delivered': 'out_for_delivery',
    'completed': 'delivered',
  };

  const currentStep = statusToPipeline[status] || 'pending';
  const currentIdx = steps.findIndex(s => s.key === currentStep);

  // Calculate progress percentage
  const progress = Math.min(100, ((currentIdx + 1) / steps.length) * 100);

  return (
    <View style={s.container}>
      {/* Progress Bar */}
      <View style={s.progressBarContainer}>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={s.progressText}>{Math.round(progress)}% Complete</Text>
      </View>

      {/* Steps */}
      <View style={s.stepsContainer}>
        {steps.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture = idx > currentIdx;

          return (
            <View key={step.key} style={s.stepWrapper}>
              <View style={s.step}>
                <View
                  style={[
                    s.stepDot,
                    isCompleted && s.dotCompleted,
                    isCurrent && s.dotCurrent,
                    isFuture && s.dotFuture,
                  ]}>
                  <Text style={s.stepEmoji}>{step.emoji}</Text>
                </View>
                <Text style={[s.stepLabel, isFuture && s.labelFuture]}>
                  {step.label}
                </Text>
              </View>

              {/* Arrow between steps */}
              {idx < steps.length - 1 && (
                <View
                  style={[
                    s.arrow,
                    isCompleted && s.arrowCompleted,
                  ]}>
                  <Text style={s.arrowText}>→</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  progressBarContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  step: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dotCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  dotCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderWidth: 3,
  },
  dotFuture: {
    opacity: 0.4,
  },
  stepEmoji: {
    fontSize: 18,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  labelFuture: {
    color: colors.textFaint,
  },
  arrow: {
    fontSize: 12,
    marginHorizontal: -2,
    color: colors.border,
  },
  arrowCompleted: {
    color: colors.success,
  },
  arrowText: {
    fontSize: 14,
    color: 'inherit',
  },
});
