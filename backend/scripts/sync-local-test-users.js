const path = require('path');
const bcrypt = require('bcrypt');
const { PrismaClient, UserRole } = require('@prisma/client');
const { AGENCIES, USERS, HEAD_OFFICE_AGENCY_NAME } = require('./test-users.config');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local'), override: true });

const prisma = new PrismaClient();

async function ensureAgencies() {
  const agencyMap = new Map();

  for (const agencySpec of AGENCIES) {
    const existing = await prisma.agency.findFirst({
      where: { name: agencySpec.name },
      select: { id: true },
    });

    if (existing) {
      agencyMap.set(agencySpec.name, existing.id);
      continue;
    }

    const created = await prisma.agency.create({
      data: agencySpec,
      select: { id: true },
    });

    agencyMap.set(agencySpec.name, created.id);
  }

  return agencyMap;
}

async function upsertUser(spec, agencyMap) {
  const password = await bcrypt.hash(spec.password, 10);
  const agencyId =
    spec.role === UserRole.AGENCY_STAFF
      ? agencyMap.get(spec.agencyName || HEAD_OFFICE_AGENCY_NAME) ?? null
      : null;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: spec.email }, { phone: spec.phone }],
    },
    select: {
      id: true,
    },
  });

  const payload = {
    fullName: spec.fullName,
    companyName: spec.companyName ?? null,
    email: spec.email,
    phone: spec.phone,
    password,
    role: spec.role,
    status: spec.status,
    agencyId,
  };

  let userId;

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: payload,
      select: { id: true },
    });
    userId = updated.id;
  } else {
    const created = await prisma.user.create({
      data: {
        ...payload,
        driverProfile:
          spec.role === UserRole.DRIVER
            ? {
                create: {},
              }
            : undefined,
      },
      select: { id: true },
    });
    userId = created.id;
  }

  if (spec.role === UserRole.DRIVER) {
    await prisma.driver.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  if (spec.role === UserRole.AGENCY_STAFF && agencyId) {
    const existingStaff = await prisma.staff.findFirst({
      where: { userId },
      select: { id: true },
    });

    const staffPayload = {
      agencyId,
      scope: spec.staffScope || 'AGENCY',
      department: spec.staffRole || 'OPERATIONS',
      role: spec.staffRole || 'OPERATIONS',
      isActive: true,
    };

    if (existingStaff) {
      await prisma.staff.update({
        where: { id: existingStaff.id },
        data: staffPayload,
      });
    } else {
      await prisma.staff.create({
        data: {
          userId,
          ...staffPayload,
        },
      });
    }
  }

  return {
    email: spec.email,
    phone: spec.phone,
    role: spec.role,
    status: spec.status,
    agency: spec.agencyName ?? null,
    staffScope: spec.staffScope ?? null,
  };
}

async function main() {
  const agencyMap = await ensureAgencies();
  const synced = [];
  const failed = [];

  for (const user of USERS) {
    try {
      synced.push(await upsertUser(user, agencyMap));
    } catch (error) {
      failed.push({
        email: user.email,
        role: user.role,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(`Synced ${synced.length} local QA users.`);
  for (const user of synced) {
    console.log(
      `- ${user.role} | ${user.status} | ${user.email} | ${user.phone} | ${user.staffScope ?? '-'} | ${user.agency ?? '-'}`,
    );
  }

  if (failed.length > 0) {
    console.log(`Skipped ${failed.length} users due to schema or data mismatch:`);
    for (const user of failed) {
      console.log(`- ${user.role} | ${user.email} | ${user.reason}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
