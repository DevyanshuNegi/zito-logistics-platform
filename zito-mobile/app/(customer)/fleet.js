import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { OwnedFleetScreen } from '../../src/components/OwnedFleetScreen';
import { CustomerAiSupportSheet } from '../../src/components/CustomerAiSupportSheet';
import { colors } from '../../src/constants/theme';

const FLEET_AI_QUICK_ACTIONS = [
  'Add my vehicle',
  'Link my driver',
  'Verification help',
  'Use fleet in booking',
];

export default function CustomerFleetScreen() {
  const [showAssistant, setShowAssistant] = useState(false);

  return (
    <>
      <OwnedFleetScreen
        title="Owned Fleet"
        subtitle="Register customer-owned vehicles, link existing driver accounts, and manage self-operated capacity inside Zito."
        feeNote="Any customer-facing account records connected to your owned-fleet activity will appear automatically in your invoice workspace when they are generated."
        emptyText="No customer-owned vehicles have been added yet."
      >
        <TouchableOpacity style={s.helperCard} onPress={() => setShowAssistant(true)}>
          <Text style={s.helperLabel}>Zito Assistant</Text>
          <Text style={s.helperTitle}>Ask how to add vehicles, link existing drivers, complete verification, or use your fleet in booking.</Text>
        </TouchableOpacity>
      </OwnedFleetScreen>

      <CustomerAiSupportSheet
        visible={showAssistant}
        onClose={() => setShowAssistant(false)}
        screenContext="CUSTOMER_FLEET"
        title="Owned fleet help"
        description="Get customer help for adding vehicles, linking drivers who already registered in Zito Partners, verification, and using your own fleet in bookings."
        quickActions={FLEET_AI_QUICK_ACTIONS}
        placeholder="Ask about owned-fleet setup, verification steps, or how to link a driver's existing account."
        helpText="Zito Assistant explains customer fleet procedures and when to contact support."
      />
    </>
  );
}

const s = StyleSheet.create({
  helperCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primarySoft,
    padding: 16,
  },
  helperLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 1,
  },
  helperTitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    marginTop: 6,
    fontWeight: '700',
  },
});
