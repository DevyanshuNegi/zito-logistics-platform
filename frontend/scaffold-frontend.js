const fs = require('fs');
const path = require('path');
const pages = [
  'src/app/(auth)/login/page.tsx',
  'src/app/(auth)/register/page.tsx',
  'src/app/(auth)/verify-otp/page.tsx',
  'src/app/pending-approval/page.tsx',
  'src/app/select-role/page.tsx',
  'src/app/(admin)/agencies/page.tsx',
  'src/app/(customer)/bookings/page.tsx',
  'src/app/(customer)/bookings/new/page.tsx',
  'src/app/(admin)/bookings/page.tsx',
  'src/app/(driver)/dashboard/page.tsx',
  'src/app/(driver)/jobs/page.tsx',
  'src/app/(driver)/shift/page.tsx',
  'src/app/(driver)/earnings/page.tsx',
  'src/app/(transporter)/fleet/page.tsx',
  'src/app/(transporter)/drivers/page.tsx',
  'src/app/(admin)/fleet/page.tsx',
  'src/app/(customer)/payments/page.tsx',
  'src/app/(admin)/payments/page.tsx',
  'src/app/(customer)/tracking/[bookingId]/page.tsx'
];
pages.forEach(p => {
  const full = path.join(__dirname, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const name = path.basename(path.dirname(full)).replace(/[^a-zA-Z]/g, '');
  fs.writeFileSync(full, `export default function ${name || 'Phase1'}Page() {\n  return (\n    <main className="p-8">\n      <h1 className="text-2xl font-bold">${p}</h1>\n      <p>Phase 1 Implementation</p>\n    </main>\n  );\n}`);
});
console.log('Scaffolded successfully');
