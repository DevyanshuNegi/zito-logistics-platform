'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';

// ─── Forgot Password Multi-Step Form Logic PRD v8 ──────────────────────────
const Step1Schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
const Step2Schema = z.object({
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
});
const Step3Schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(data => data.password === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

export default function ForgotPasswordPage() {
  const router = useRouter();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otpToken, setOtpToken] = useState('');
  
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register: registerStep1, handleSubmit: handleStep1, formState: { errors: errors1 } } = useForm<z.infer<typeof Step1Schema>>({
    resolver: zodResolver(Step1Schema),
  });

  const { register: registerStep2, handleSubmit: handleStep2, formState: { errors: errors2 } } = useForm<z.infer<typeof Step2Schema>>({
    resolver: zodResolver(Step2Schema),
  });

  const { register: registerStep3, handleSubmit: handleStep3, formState: { errors: errors3 } } = useForm<z.infer<typeof Step3Schema>>({
    resolver: zodResolver(Step3Schema),
  });

  const onStep1Submit = async (data: z.infer<typeof Step1Schema>) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await axios.post('/api/v1/auth/forgot-password', { email: data.email });
      setEmail(data.email);
      setStep(2);
    } catch (err: any) {
      setServerError(err.response?.data?.message || 'Failed to send reset code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onStep2Submit = async (data: z.infer<typeof Step2Schema>) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const res = await axios.post('/api/v1/auth/verify-reset-otp', { email, otp: data.otp });
      setOtpToken(res.data.resetToken || data.otp); // Depending on auth architecture
      setStep(3);
    } catch (err: any) {
      setServerError(err.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onStep3Submit = async (data: z.infer<typeof Step3Schema>) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await axios.post('/api/v1/auth/reset-password', { 
        email, 
        token: otpToken, 
        newPassword: data.password 
      });
      alert('Password reset successfully. You can now login.');
      router.push('/login');
    } catch (err: any) {
      setServerError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {step === 1 && 'Reset Password'}
            {step === 2 && 'Verify Code'}
            {step === 3 && 'New Password'}
          </h2>
          <p className="text-gray-500 text-sm mt-2">
            {step === 1 && "Enter your email addresses and we'll send you a recovery code."}
            {step === 2 && `Enter the 6-digit code sent to ${email}`}
            {step === 3 && "Secure your account with a new password."}
          </p>
        </div>

        {serverError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm text-center">
            {serverError}
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <form onSubmit={handleStep1(onStep1Submit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                {...registerStep1('email')}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="name@company.com"
              />
              {errors1.email && <p className="text-red-500 text-xs mt-1">{errors1.email.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Send Recovery Code'}
            </button>
            
            <div className="text-center pt-4">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-sm text-gray-600 hover:underline"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <form onSubmit={handleStep2(onStep2Submit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">6-Digit OTP</label>
              <input
                type="text"
                maxLength={6}
                {...registerStep2('otp')}
                className="w-full p-2 border border-gray-300 rounded-md text-center text-xl tracking-widest focus:ring-blue-500 focus:border-blue-500"
                placeholder="000000"
              />
              {errors2.otp && <p className="text-red-500 text-xs mt-1 text-center">{errors2.otp.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <form onSubmit={handleStep3(onStep3Submit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                {...registerStep3('password')}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
              {errors3.password && <p className="text-red-500 text-xs mt-1">{errors3.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                {...registerStep3('confirm_password')}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
              {errors3.confirm_password && <p className="text-red-500 text-xs mt-1">{errors3.confirm_password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}