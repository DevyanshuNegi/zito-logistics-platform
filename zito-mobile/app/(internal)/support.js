import React from 'react';
import OperatorSupportDesk from '../../src/components/OperatorSupportDesk';

export default function InternalSupportScreen() {
  return (
    <OperatorSupportDesk
      title="Internal Support Desk"
      subtitle="Head-office teams can assign, escalate, and close support work from the mobile internal workspace."
      audienceLabel="Visible Queue"
    />
  );
}
