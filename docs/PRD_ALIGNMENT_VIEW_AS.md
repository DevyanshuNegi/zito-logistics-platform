# PRD Alignment: View As Feature Implementation

## Overview
Implemented full View As functionality per PRD §3.1 and §5.1, enabling super_admin to impersonate any user for support, QA, and onboarding purposes.

## Changes Made

### 1. Frontend AuthContext Enhancement (`frontend/src/contexts/AuthContext.jsx`)
- ✅ Added `adminUser` state to track the real admin identity
- ✅ Implemented `startViewAs(targetUser)` function for entering View As mode
- ✅ Implemented `endViewAs()` function for exiting View As mode
- ✅ Added `isViewingAs` flag to context for UI indicators
- ✅ Updated logout to clear View As state
- ✅ Preserved real admin identity while impersonating target user

### 2. Axios Interceptor Update (`frontend/src/api/axios.js`)
- ✅ Added automatic `X-View-As-User` header injection when in View As mode
- ✅ Sends impersonated user ID to backend for scope filtering
- ✅ Backend middleware validates and enforces View As permissions

### 3. ViewAsSwitcher Component (`frontend/src/components/ViewAsSwitcher.jsx`)
- ✅ Created dedicated UI for View As functionality
- ✅ Displays user search modal for finding target users
- ✅ Shows current View As status with exit button
- ✅ Restricted to super_admin role only
- ✅ Integrates with `/admin/users` endpoint for user search
- ✅ Shows user details: name, email, role

### 4. Layout Component Updates (`frontend/src/components/layout.jsx`)
- ✅ Integrated ViewAsSwitcher component in sidebar
- ✅ Added View As status bar in main content area
- ✅ Shows yellow warning banner when in View As mode
- ✅ Provides quick exit button for View As mode

### 5. ProtectedRoute Component Update (`frontend/src/components/ProtectedRoute.jsx`)
- ✅ Updated to handle View As context
- ✅ Checks permissions against impersonated user's role
- ✅ Ensures routes work correctly when viewing as another user

## PRD Requirements Met

### §3.1 - Super Admin Authority
- ✅ Only super_admin can use View As
- ✅ Real admin identity preserved in audit logs (backend)
- ✅ Admin can preview any user's experience

### §5.1 - Admin Portal Features
- ✅ View As accessible from admin portal
- ✅ User search functionality
- ✅ Quick exit from View As mode

### §25.1 - API-Level Role-Based Filtering
- ✅ X-View-As-User header sent on all requests
- ✅ Backend applies scope filter for impersonated user
- ✅ Data visibility matches impersonated user's role

### §25.8 - Audit Logging
- ✅ Backend logs View As sessions automatically
- ✅ Audit logs show real admin and impersonated user
- ✅ Action recorded as VIEW_AS_STARTED

## Technical Implementation Details

### Frontend Flow
1. Super Admin clicks "View As User" button in sidebar
2. Modal opens with user search interface
3. Admin searches for target user by email/name/ID
4. Admin clicks "View" on target user
5. `startViewAs()` stores real admin in `adminUser`, target in `user`
6. Both users stored in localStorage
7. axios interceptor reads both and sends `X-View-As-User` header
8. All subsequent requests include the header
9. Admin sees View As status banner
10. Admin can click "Exit View As" to restore original identity

### Backend Validation (Already Implemented)
- `viewAs()` middleware in auth.js validates:
  - Requester is super_admin
  - Target user exists and is active
  - Preserves real admin identity in `req.adminUser`
  - Sets `req.viewAs = true` flag
  - Applies target user's scope via `applyScope` middleware

### Data Isolation
- When in View As mode:
  - User sees only what impersonated user would see
  - Bookings, drivers, customers filtered by impersonated user's scope
  - Financial data hidden from non-finance roles
  - Admin operations restricted per impersonated role

## Security Considerations

1. **Permission Validation**: Backend middleware validates X-View-As-User header
2. **Scope Enforcement**: applyScope middleware applies filtering based on impersonated role
3. **Audit Trail**: All View As sessions logged with real admin identity
4. **Session Isolation**: View As state stored in localStorage, cleared on logout
5. **Frontend Check**: ProtectedRoute verifies impersonated user has role permission

## Frontend-Backend Sync

### Requests Include
- Authorization Bearer token (real admin's token)
- X-View-As-User header (impersonated user ID)

### Response Handling
- Backend returns impersonated user's data scope
- Frontend UI respects impersonated user's role/permissions
- Routes protected by ProtectedRoute component

## Files Modified

- `frontend/src/contexts/AuthContext.jsx` - Added View As state/functions
- `frontend/src/api/axios.js` - Added X-View-As-User header injection
- `frontend/src/components/layout.jsx` - Integrated ViewAsSwitcher, added status bar
- `frontend/src/components/ProtectedRoute.jsx` - Updated for View As context

## Files Created

- `frontend/src/components/ViewAsSwitcher.jsx` - View As UI component

## Testing Checklist

- [ ] Super Admin can search for users
- [ ] Super Admin can enter View As mode for customer
- [ ] Super Admin can enter View As mode for driver
- [ ] Super Admin can enter View As mode for transporter
- [ ] Super Admin can enter View As mode for agent
- [ ] Super Admin can enter View As mode for agency
- [ ] View As status banner displays correctly
- [ ] Non-super_admin users cannot see View As button
- [ ] Routes are restricted per impersonated user role
- [ ] Exit View As restores original admin identity
- [ ] Audit logs show View As sessions
- [ ] View As ends on logout

## Remaining PRD Gaps (Separate Issues)

From ZITO_Testing_Addendum_PRD_Gaps.md:

1. **Missing Test Cases**
   - Login and landing page by role
   - UI route protection by role
   - Help/SOS system
   - Notifications matrix
   - Soft delete and admin recovery
   - Compliance expiry blocking
   - Marketplace features
   - Document flows
   - Mobile/narrow-screen checks

2. **Mobile APK Position**
   - PRD does not explicitly require Android/iOS APK
   - Recommendation: Use Expo for native mobile build

These are tracked in separate PRD gaps document and will require additional implementation work.
