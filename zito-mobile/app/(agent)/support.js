import React from 'react';
import PartnerSupportInbox from '../../src/components/PartnerSupportInbox';

export default function AgentSupportScreen() {
  return (
    <PartnerSupportInbox
      title="Agent Support"
      subtitle="Raise dispatch, commission, onboarding, or capacity issues from the partner mobile workspace."
      sourceContextType="AGENT_MOBILE"
    />
  );
}
