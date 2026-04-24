'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';
import { useAuthStore } from '@/store/auth';

const loginSchema = z.object({
  email_or_phone: z.string().min(1, 'Email or Phone is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type OtpFormValues = z.infer<typeof otpSchema>;

export default function LoginPage() {
  const router = useRouter();
  const loginAction = useAuthStore((state) => state.login);
  
  const [step, setStep] = useState<1 | 2>(1);
  const [contactIdentifier, setContactIdentifier] = useState<string>('');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register: loginRegister,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isSubmitting: isLoginSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const {
    register: otpRegister,
    handleSubmit: handleOtpSubmit,
    formState: { errors: otpErrors, isSubmitting: isOtpSubmitting },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
  });

  const onLogin = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      // POST /auth/login - 200: OTP sent to email. No token yet.
      await axios.post('/api/v1/auth/login', {
        email_or_phone: data.email_or_phone,
        password: data.password,
      });

      setContactIdentifier(data.email_or_phone);
      setStep(2);
    } catch (err: any) {
      setServerError(err.response?.data?.error?.message || 'Login failed. Please check your credentials.');
    }
  };

  const onOtpVerify = async (data: OtpFormValues) => {
    setServerError(null);
    try {
      // POST /auth/verify-otp - 200: { access_token, refresh_token, user }
      const res = await axios.post('/api/v1/auth/verify-otp', {
        contact: contactIdentifier,
        otp: data.otp,
      });

      const { access_token, refresh_token, user } = res.data.data;
      
      loginAction(user, access_token, refresh_token);
      
      // Basic routing logic per PRD User roles
      if (user.role.includes('Admin')) {
        router.push('/admin/dashboard');
      } else if (user.role === 'Driver') {
        router.push('/driver/trips');
      } else {
        router.push('/customer/bookings');
      }
      
    } catch (err: any) {
      setServerError(err.response?.data?.error?.message || 'Invalid OTP. Please try again.');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">ZITO Platform</h1>
          <p className="text-sm text-gray-500 mt-2">Logistics Super-App</p>
        </div>

        {serverError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {serverError}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email or Phone</label>
              <input
                type="text"
                {...loginRegister('email_or_phone')}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter email or phone"
              />
              {loginErrors.email_or_phone && (
                <p className="text-red-500 text-xs mt-1">{loginErrors.email_or_phone.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                {...loginRegister('password')}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
              {loginErrors.password && (
                <p className="text-red-500 text-xs mt-1">{loginErrors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoginSubmitting}
              className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoginSubmitting ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit(onOtpVerify)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
              <p className="text-xs text-gray-500 mb-4">Sent to {contactIdentifier}</p>
              <input
                type="text"
                maxLength={6}
                {...otpRegister('otp')}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center tracking-widest text-lg"
                placeholder="000000"
              />
              {otpErrors.otp && (
                <p className="text-red-500 text-xs mt-1">{otpErrors.otp.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isOtpSubmitting}
              className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isOtpSubmitting ? 'Verifying...' : 'Verify OTP'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-blue-600 hover:underline"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}