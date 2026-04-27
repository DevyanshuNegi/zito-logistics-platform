const fs = require('fs');
const path = require('path');
const pages = [
  'app/(auth)/login.tsx',
  'app/(auth)/register.tsx',
  'app/(customer)/booking-history.tsx',
  'app/(customer)/track-trip.tsx',
  'app/(driver)/trips.tsx',
  'app/(driver)/earnings.tsx',
  'app/(driver)/sos.tsx',
  'app/(transporter)/dashboard.tsx',
  'app/(transporter)/fleet.tsx',
  'app/(transporter)/finance.tsx'
];
pages.forEach(p => {
  const full = path.join(__dirname, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const name = path.basename(p, '.tsx').replace(/[^a-zA-Z]/g, '');
  fs.writeFileSync(full, `import { View, Text } from 'react-native';\nexport default function ${name || 'Phase1'}Screen() {\n  return (\n    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>\n      <Text>${p}</Text>\n      <Text>Phase 1 Implementation</Text>\n    </View>\n  );\n}`);
});
console.log('Scaffolded successfully');
