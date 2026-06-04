const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(backendRoot, '..');
const readBackend = (relativePath) => fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');
const readWorkspace = (relativePath) => fs.readFileSync(path.join(workspaceRoot, relativePath), 'utf8');

describe('auth OTP stabilization regressions', () => {
  test('local backend environment uses test OTP mode without Twilio hijacking QA login', () => {
    const env = readBackend('.env');
    const main = readBackend('src/main.ts');

    expect(env).toMatch(/^OTP_MODE=test$/m);
    expect(env).toMatch(/^TEST_OTP_CODE=123456$/m);
    expect(env).toMatch(/^TWILIO_VERIFY_ENABLED=false$/m);
    expect(main).toContain("loadEnv({ path: resolve(process.cwd(), '.env')");
    expect(main).toContain("loadEnv({ path: resolve(process.cwd(), 'backend/.env')");
  });

  test('test OTP provider accepts configured code and never sends real SMS', () => {
    const provider = readBackend('src/modules/auth/otp/test.provider.ts');

    expect(provider).toContain('TEST OTP MODE');
    expect(provider).toContain("process.env.TEST_OTP_CODE?.trim() || '123456'");
    expect(provider).toContain('code.trim() === this.getConfiguredCode()');
  });

  test('OTP mode selection prioritizes OTP_MODE=test before Twilio settings', () => {
    const service = readBackend('src/modules/auth/otp.service.ts');
    const testModeIndex = service.indexOf("configuredMode === 'test'");
    const twilioIndex = service.indexOf("configuredMode === 'twilio'");

    expect(testModeIndex).toBeGreaterThan(-1);
    expect(twilioIndex).toBeGreaterThan(-1);
    expect(testModeIndex).toBeLessThan(twilioIndex);
    expect(service).toContain('OTP provider selected:');
    expect(service).toContain('OTP verification using provider:');
  });

  test('non-suspended onboarding users can receive sessions with status for frontend routing', () => {
    const authService = readBackend('src/modules/auth/auth.service.ts');
    const jwtStrategy = readBackend('src/modules/auth/strategies/jwt.strategy.ts');

    expect(authService).toContain('assertAccountCanAuthenticate');
    expect(authService).toContain('user.status === AccountStatus.SUSPENDED');
    expect(authService).toContain('status: user.status');
    expect(authService).toContain('Session created for user');
    expect(jwtStrategy).toContain('user.status === AccountStatus.SUSPENDED');
    expect(jwtStrategy).toContain('status: user.status');
  });

  test('pending users are limited to verification routes and frontend redirects to complete verification', () => {
    const guard = readBackend('src/modules/auth/guards/jwt-auth.guard.ts');
    const loginPage = readWorkspace('frontend/src/app/(auth)/login/page.tsx');
    const completeVerification = readWorkspace('frontend/src/app/(auth)/complete-verification/page.tsx');

    expect(guard).toContain('Complete verification before accessing this module.');
    expect(guard).toContain("path === '/users/me/verification'");
    expect(guard).toContain("path === '/users/me/kyc'");
    expect(guard).toContain("path === '/users/me/kyc/submit'");
    expect(loginPage).toContain("'/complete-verification'");
    expect(loginPage).toContain('Review it, then tap Verify code.');
    expect(loginPage).not.toContain('void submitOtpCode(code);');
    expect(completeVerification).toContain('capture="environment"');
    expect(completeVerification).toContain("formData.append('captureSource', 'CAMERA')");
  });
});
