import React from 'react';
import OperatorSupportDesk from '../../src/components/OperatorSupportDesk';

export default function AgencySupportScreen() {
  return (
    <OperatorSupportDesk
      title="Agency Support Desk"
      subtitle="Branch and station teams can assign, escalate, and close visible support work from mobile."
      audienceLabel="Agency Queue"
    />
  );
}
