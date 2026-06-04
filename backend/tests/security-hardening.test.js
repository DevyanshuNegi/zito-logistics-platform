const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('enterprise security hardening regressions', () => {
  test('production does not publicly serve local uploads', () => {
    const main = read('src/main.ts');
    expect(main).toContain("process.env.NODE_ENV !== 'production'");
    expect(main).toContain("app.useStaticAssets(join(process.cwd(), 'uploads')");
  });

  test('production startup validates security-critical environment variables', () => {
    const main = read('src/main.ts');

    expect(main).toContain('Weak security secret(s)');
    expect(main).toContain('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
    expect(main).toContain('MPESA_CALLBACK_SECRET');
    expect(main).toContain('Production ALLOWED_ORIGINS must not include localhost origins');
    expect(main).toContain('Production must not use MPESA_ENVIRONMENT=sandbox');
    expect(main).toContain('OTP_MODE=test is forbidden in production');
    expect(main).toContain('Production OTP_MODE must be twilio');
  });

  test('otp provider abstraction keeps twilio and adds safe test mode', () => {
    const otpService = read('src/modules/auth/otp.service.ts');
    const twilioProvider = read('src/modules/auth/otp/twilio.provider.ts');
    const testProvider = read('src/modules/auth/otp/test.provider.ts');
    const firebaseProvider = read('src/modules/auth/otp/firebase.provider.ts');

    expect(otpService).toContain('resolveProvider');
    expect(otpService).toContain("mode === 'test'");
    expect(otpService).toContain("mode === 'twilio'");
    expect(twilioProvider).toContain('https://verify.twilio.com/v2/Services');
    expect(testProvider).toContain('TEST OTP MODE');
    expect(testProvider).toContain('TEST_OTP_CODE');
    expect(firebaseProvider).toContain('Firebase OTP provider is not implemented yet');
  });

  test('payment endpoints pass authenticated actor into object-scope checks', () => {
    const controller = read('src/modules/payments/payments.controller.ts');
    const service = read('src/modules/payments/payments.service.ts');

    expect(controller).toContain('this.paymentsService.getPayment(id, req.user)');
    expect(controller).toContain('this.paymentsService.retryPayment(id, req.user)');
    expect(controller).toContain('this.paymentsService.getEscrow(bookingId, req.user)');
    expect(service).toContain('assertScopedAccess');
    expect(service).toContain('You are not allowed to access this finance record.');
  });

  test('tracking gateway authenticates sockets and authorizes rooms', () => {
    const gateway = read('src/modules/tracking/tracking.gateway.ts');

    expect(gateway).toContain('authenticateSocket');
    expect(gateway).toContain('assertDriverAssignedToBooking');
    expect(gateway).toContain('assertCustomerCanTrack');
    expect(gateway).toContain('assertAdminSocket');
    expect(gateway).toContain('GPS updates are rate limited');
  });

  test('mpesa callbacks require callback verification before mutation', () => {
    const controller = read('src/modules/payments/mpesa.controller.ts');

    expect(controller).toContain('verifyCallbackRequest');
    expect(controller).toContain('MPESA_CALLBACK_SECRET');
    expect(controller).toContain('timingSafeEqual');
    expect(controller).toContain('MPESA_CALLBACK_SECURITY');
  });

  test('refresh tokens are not persisted in frontend localStorage', () => {
    const api = read('../frontend/src/lib/api.ts');
    const authService = read('src/modules/auth/auth.service.ts');

    expect(api).toContain('const refreshToken = null');
    expect(api).toContain('window.localStorage.removeItem(REFRESH_TOKEN_KEY)');
    expect(api).not.toContain('window.localStorage.setItem(REFRESH_TOKEN_KEY');
    expect(authService).toContain('shouldExposeLegacyRefreshToken');
    expect(authService).toContain('EXPOSE_LEGACY_REFRESH_TOKEN');
  });
});
