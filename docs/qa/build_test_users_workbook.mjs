import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const require = createRequire(import.meta.url);
const { USERS, AGENCIES } = require('../../backend/scripts/test-users.config.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUTPUT_DIR = path.join(ROOT, 'outputs', 'qa-logins');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'Zito_Test_Login_Matrix.xlsx');
const PREVIEW_DIR = path.join(OUTPUT_DIR, 'previews');

function resolvePortal(user) {
  if (user.role === 'CUSTOMER' || user.role === 'CORPORATE') {
    return {
      portal: 'Zito Logistics',
      loginUrl: 'http://127.0.0.1:3001/login',
      homeRoute: user.role === 'CORPORATE' ? '/corporate/bookings' : '/customer/bookings',
    };
  }

  if (
    ['DRIVER', 'AGENT', 'TRANSPORTER', 'COURIER_COMPANY', 'WAREHOUSE_PARTNER'].includes(user.role)
  ) {
    return {
      portal: 'Zito Partners',
      loginUrl: 'http://127.0.0.1:3001/partners/login',
      homeRoute:
        user.role === 'DRIVER'
          ? '/driver/dashboard'
          : user.role === 'AGENT'
            ? '/agent/dashboard'
            : user.role === 'TRANSPORTER'
              ? '/transporter/fleet'
              : user.role === 'COURIER_COMPANY'
                ? '/courier-company/dispatch'
                : '/warehouse/dashboard',
    };
  }

  if (user.role === 'AGENCY_STAFF' && user.staffScope === 'AGENCY') {
    return {
      portal: 'Zito Agency',
      loginUrl: 'http://127.0.0.1:3001/agency/login',
      homeRoute: '/agency/operations',
    };
  }

  return {
    portal: 'Zito Internal',
    loginUrl: 'http://127.0.0.1:3001/internal/login',
    homeRoute: user.role === 'AGENCY_STAFF' ? '/staff/operations' : '/admin',
  };
}

function summarizeByRole(users) {
  const counts = new Map();
  for (const user of users) {
    counts.set(user.role, (counts.get(user.role) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function agencyRows() {
  return AGENCIES.map((agency) => {
    const staff = USERS.filter((user) => user.agencyName === agency.name);
    return [
      agency.name,
      agency.status,
      agency.address ?? '',
      staff.length,
      staff
        .map((member) => `${member.fullName} (${member.staffRole ?? member.role})`)
        .join('; '),
    ];
  });
}

async function buildWorkbook() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(PREVIEW_DIR, { recursive: true });

  const workbook = Workbook.create();
  const summary = workbook.worksheets.add('Summary');
  const matrix = workbook.worksheets.add('Login Matrix');
  const agencies = workbook.worksheets.add('Agencies');

  summary.getRange('A1:M1').merge();
  summary.getRange('A1').values = [['Zito Test Login Matrix']];
  summary.getRange('A2:M2').merge();
  summary.getRange('A2').values = [[
    'Dummy QA users for customer, partner, admin, head office, and agency testing on 127.0.0.1:3001.',
  ]];
  summary.getRange('A1:M2').format = {
    fill: '#0B1730',
    font: { color: '#FFFFFF', bold: true },
    wrapText: true,
    horizontalAlignment: 'left',
    verticalAlignment: 'center',
  };
  summary.getRange('A1').format.rowHeightPx = 34;
  summary.getRange('A2').format.rowHeightPx = 34;

  summary.getRange('A4:B9').values = [
    ['Metric', 'Value'],
    ['Total test users', USERS.length],
    ['Customer-facing portals', 2],
    ['Internal access portals', 2],
    ['Agency records seeded', AGENCIES.length],
    ['Primary test admin', 'vishalgolatkar@yahoo.com'],
  ];
  summary.getRange('A4:B4').format = {
    fill: '#1B3F72',
    font: { color: '#FFFFFF', bold: true },
  };
  summary.getRange('A4:B9').format.borders = {
    top: { color: '#D7E0EC', style: 'Continuous' },
    bottom: { color: '#D7E0EC', style: 'Continuous' },
    left: { color: '#D7E0EC', style: 'Continuous' },
    right: { color: '#D7E0EC', style: 'Continuous' },
  };

  summary.getRange('D4:F8').values = [
    ['Portal', 'Login URL', 'Use for'],
    ['Zito Logistics', 'http://127.0.0.1:3001/login', 'Customer and Corporate'],
    ['Zito Partners', 'http://127.0.0.1:3001/partners/login', 'Driver, Agent, Transporter, Courier, Warehouse'],
    ['Zito Internal', 'http://127.0.0.1:3001/internal/login', 'Super Admin, Admin, Head Office Staff'],
    ['Zito Agency', 'http://127.0.0.1:3001/agency/login', 'Agency Staff'],
  ];
  summary.getRange('D4:F4').format = {
    fill: '#1B3F72',
    font: { color: '#FFFFFF', bold: true },
  };

  const roleSummary = summarizeByRole(USERS);
  summary.getRange(`H4:I${4 + roleSummary.length}`).values = [
    ['Role', 'Count'],
    ...roleSummary.map(([role, count]) => [role, count]),
  ];
  summary.getRange('H4:I4').format = {
    fill: '#1B3F72',
    font: { color: '#FFFFFF', bold: true },
  };

  const roleChart = summary.charts.add('bar', summary.getRange(`H4:I${4 + roleSummary.length}`));
  roleChart.title = 'Accounts by role';
  roleChart.hasLegend = false;
  roleChart.xAxis = { axisType: 'textAxis' };
  roleChart.setPosition('K4', 'N18');

  summary.getRange('A11:M13').merge();
  summary.getRange('A11').values = [[
    'Testing note: phone OTP requests are redirected to the configured test mobile number in development. Email sign-in still completes with password after OTP verification.',
  ]];
  summary.getRange('A11').format = {
    fill: '#EEF4FF',
    font: { color: '#1B3F72', bold: true },
    wrapText: true,
  };

  const matrixRows = USERS.map((user) => {
    const portal = resolvePortal(user);
    return [
      portal.portal,
      user.role,
      user.staffScope ?? '',
      user.staffRole ?? '',
      user.agencyName ?? user.companyName ?? '',
      user.fullName,
      user.email,
      user.phone,
      user.password,
      user.status,
      portal.loginUrl,
      portal.homeRoute,
      user.notes ?? '',
    ];
  });

  matrix.getRange(`A1:M${matrixRows.length + 1}`).values = [
    [
      'Portal',
      'Role',
      'Staff Scope',
      'Department',
      'Agency or Company',
      'Full Name',
      'Email',
      'Phone',
      'Password',
      'Status',
      'Login URL',
      'Home Route',
      'Notes',
    ],
    ...matrixRows,
  ];
  matrix.getRange('A1:M1').format = {
    fill: '#1B3F72',
    font: { color: '#FFFFFF', bold: true },
  };
  matrix.getRange(`A2:M${matrixRows.length + 1}`).format = {
    wrapText: true,
  };
  matrix.freezePanes.freezeRows(1);

  agencies.getRange(`A1:E${AGENCIES.length + 1}`).values = [
    ['Agency', 'Status', 'Address', 'Seeded Staff Count', 'Assigned Staff'],
    ...agencyRows(),
  ];
  agencies.getRange('A1:E1').format = {
    fill: '#1B3F72',
    font: { color: '#FFFFFF', bold: true },
  };
  agencies.getRange(`A2:E${AGENCIES.length + 1}`).format = {
    wrapText: true,
  };
  agencies.freezePanes.freezeRows(1);

  for (const column of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']) {
    matrix.getRange(`${column}:${column}`).format.autofitColumns();
  }
  for (const column of ['A', 'B', 'D', 'E', 'F', 'H', 'I']) {
    summary.getRange(`${column}:${column}`).format.autofitColumns();
  }
  for (const column of ['A', 'B', 'C', 'D', 'E']) {
    agencies.getRange(`${column}:${column}`).format.autofitColumns();
  }

  const inspect = await workbook.inspect({
    kind: 'table',
    range: 'Login Matrix!A1:M10',
    include: 'values',
    tableMaxRows: 10,
    tableMaxCols: 13,
  });
  await fs.writeFile(path.join(OUTPUT_DIR, 'login-matrix-inspect.ndjson'), inspect.ndjson ?? '', 'utf8');

  const preview = await workbook.render({
    sheetName: 'Summary',
    autoCrop: 'all',
    scale: 1,
    format: 'png',
  });
  await fs.writeFile(
    path.join(PREVIEW_DIR, 'summary.png'),
    new Uint8Array(await preview.arrayBuffer()),
  );

  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(OUTPUT_FILE);

  return OUTPUT_FILE;
}

buildWorkbook()
  .then((file) => {
    console.log(file);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
