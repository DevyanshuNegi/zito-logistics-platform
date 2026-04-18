import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import {
  FINANCE_ROLES,
  MARKETPLACE_ROLES,
  OPERATIONS_ROLES,
  SETTINGS_ROLES,
  SUPER_ADMIN_ROLE,
} from './utils/roles';

import Login          from './pages/login';
import Register       from './pages/register';
import PendingApproval from './pages/pending-approval';
import ForgotPassword from './pages/forgot-password';
import Terms          from './pages/terms';
import Privacy        from './pages/privacy';
import Dashboard      from './pages/dashboard';
import Drivers        from './pages/drivers';
import Bookings       from './pages/bookings';
import Fleet          from './pages/fleet';
import Customers      from './pages/customers';
import Verification   from './pages/verification';
import Payments       from './pages/payments';
import Assignments    from './pages/assignments';
import Reports        from './pages/reports';
import AuditLog       from './pages/audit-log';
import Contracts      from './pages/contracts';
import Transporters   from './pages/transporters';
import DriverApp      from './pages/driver-app';
import DriverView     from './pages/driver-view';           // ✅ NEW
import CustomerView, { AgentView } from './pages/customer-view';
import TransporterView from './pages/transporter-view';
import AgencyView      from './pages/agency-view';
import NotificationsCenter from './pages/notifications-center';
import LiveMap        from './pages/map';
import Settings       from './pages/settings';
import Unauthorized   from './pages/unauthorized';
import TripCharges    from './pages/trip-charges';
import TripDetails from './pages/trip';
import Complaints     from './pages/complaints';
import Help           from './pages/help';
import Marketplace    from './pages/marketplace';
import Profile        from './pages/profile';

function App() {

  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>

          {/* PUBLIC */}
          <Route path="/login"            element={<Login />} />
          <Route path="/register"         element={<Register />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />
          <Route path="/terms"            element={<Terms />} />
          <Route path="/privacy"          element={<Privacy />} />
          


          {/* ROLE PORTALS */}

          <Route
            path="/portal/driver"
            element={
              <ProtectedRoute allowedRoles={['driver']}>
                <DriverApp />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portal/driver-view"
            element={
              <ProtectedRoute allowedRoles={[SUPER_ADMIN_ROLE]}>
                <DriverView mode="preview" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/portal/customer"
            element={
              <ProtectedRoute allowedRoles={['customer', SUPER_ADMIN_ROLE]}>
                <CustomerView role="customer" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/portal/agent"
            element={
              <ProtectedRoute allowedRoles={['agent', SUPER_ADMIN_ROLE]}>
                <AgentView />
              </ProtectedRoute>
            }
          />

          <Route
            path="/portal/transporter"
            element={
              <ProtectedRoute allowedRoles={['transporter', SUPER_ADMIN_ROLE]}>
                <TransporterView />
              </ProtectedRoute>
            }
          />

          <Route
            path="/portal/agency"
            element={
              <ProtectedRoute allowedRoles={['agency', SUPER_ADMIN_ROLE]}>
                <AgencyView />
              </ProtectedRoute>
            }
          />



          {/* ADMIN PAGES */}

          <Route
            path="/"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/bookings"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <Bookings />
              </ProtectedRoute>
            }
          />

          <Route
            path="/trip/:id"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <TripDetails />
              </ProtectedRoute>
            }
          />

          <Route
            path="/complaints"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <Complaints />
              </ProtectedRoute>
            }
          />

          <Route
            path="/help"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <Help />
              </ProtectedRoute>
            }
          />

          <Route
            path="/marketplace"
            element={
              <ProtectedRoute allowedRoles={MARKETPLACE_ROLES}>
                <Marketplace />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/map"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <LiveMap />
              </ProtectedRoute>
            }
          />

          <Route
            path="/assignments"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <Assignments />
              </ProtectedRoute>
            }
          />

          <Route
            path="/drivers"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <Drivers />
              </ProtectedRoute>
            }
          />

          <Route
            path="/fleet"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <Fleet />
              </ProtectedRoute>
            }
          />

          <Route
            path="/customers"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <Customers />
              </ProtectedRoute>
            }
          />

          <Route
            path="/verification"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <Verification />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payments"
            element={
              <ProtectedRoute allowedRoles={FINANCE_ROLES}>
                <Payments />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={FINANCE_ROLES}>
                <Reports />
              </ProtectedRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <ProtectedRoute allowedRoles={[...OPERATIONS_ROLES, ...FINANCE_ROLES]}>
                <NotificationsCenter />
              </ProtectedRoute>
            }
          />

          <Route
            path="/audit-log"
            element={
              <ProtectedRoute allowedRoles={[...OPERATIONS_ROLES, ...FINANCE_ROLES]}>
                <AuditLog />
              </ProtectedRoute>
            }
          />

          <Route
            path="/transporters"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <Transporters />
              </ProtectedRoute>
            }
          />

          <Route
            path="/contracts"
            element={
              <ProtectedRoute allowedRoles={FINANCE_ROLES}>
                <Contracts />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={SETTINGS_ROLES}>
                <Settings />
              </ProtectedRoute>
            }
          />

          <Route
            path="/trip-charges"
            element={
              <ProtectedRoute allowedRoles={OPERATIONS_ROLES}>
                <TripCharges />
              </ProtectedRoute>
            }
          />

          {/* UNAUTHORIZED */}
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" />} />

        </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
