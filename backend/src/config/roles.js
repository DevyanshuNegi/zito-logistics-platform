```js
// src/config/roles.js

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  AGENT: 'agent',
  CUSTOMER: 'customer',
  DRIVER: 'driver',
  TRANSPORTER: 'transporter',
  AGENCY: 'agency'
};

const PERMISSIONS = {

  // ================= CORE =================
  dashboard: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN
  ],

  // ================= BOOKINGS =================
  bookings: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.TRANSPORTER,
    ROLES.AGENT,
    ROLES.AGENCY
  ],

  // CUSTOMER - own bookings only
  customerBookings: [
    ROLES.CUSTOMER
  ],

  // ================= ASSIGNMENTS =================
  assignments: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.TRANSPORTER,
    ROLES.DRIVER
  ],

  // ================= DRIVER =================
  driverTrips: [
    ROLES.DRIVER
  ],

  // ================= DRIVERS =================
  drivers: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.TRANSPORTER,
    ROLES.AGENCY
  ],

  // ================= VEHICLES =================
  fleet: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.TRANSPORTER
  ],

  // ================= CUSTOMERS =================
  customers: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.TRANSPORTER,
    ROLES.AGENT,
    ROLES.AGENCY
  ],

  // ================= TRANSPORTERS =================
  transporters: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN
  ],

  // ================= COMPLIANCE =================
  verification: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN
  ],

  // ================= FINANCE =================
  payments: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN
  ],

  reports: [
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN
  ],

  // ================= SETTINGS =================
  settings: [
    ROLES.SUPER_ADMIN
  ]
};

module.exports = {
  ROLES,
  PERMISSIONS
};
```
