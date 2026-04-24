'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axios from 'axios';

// ─── Schema Definitions based on PRD v8 ──────────────────────────────────────
const registerSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email_or_phone: z.string().min(5, 'Email or phone required'),
  password: z.string().min(8, 'Minimum 8 characters'),
  confirm_password: z.string(),
  role: z.enum([
    'Customer', 
    'Driver', 
    'Transporter', 
    'Agent', 
    'Warehouse Partner'
  ]),
  // Optional depending on role, handled broadly in backend for registration
  country: z.string().default('KE'),
}).refine(data => data.password === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'Customer',
      country: 'KE'
    }
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterFormValues) => {
    setServerError(null);
    try {
      // Determines whether the input is an email or phone heuristically for the backend
      const isEmail = data.email_or_phone.includes('@');
      
      const payload = {
        name: data.full_name,
        email: isEmail ? data.email_or_phone : undefined,
        phone: !isEmail ? data.email_or_phone : undefined,
        password: data.password,
        role: data.role,
      };

      // POST /auth/register -> 201 Created (pending OTP)
      await axios.post('/api/v1/auth/register', payload);

      setSuccess(true);
      
      // Delay redirect
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (err: any) {
      setServerError(err.response?.data?.error?.message || 'Registration failed. Please try again.');
    }
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Created!</h2>
          <p className="text-gray-600 mb-6">Your registration was successful. You will be redirected to login shortly so you can verify your OTP.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4 py-12">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-sm text-gray-500 mt-2">Join ZITO Logistics</p>
        </div>

        {serverError && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">I am a...</label>
            <select
              {...register('role')}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="Customer">Customer</option>
              <option value="Driver">Driver</option>
              <option value="Transporter">Transporter</option>
              <option value="Agent">Agent</option>
              <option value="Warehouse Partner">Warehouse Partner</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              {...register('full_name')}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. John Doe"
            />
            {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email or Phone Number</label>
            <input
              type="text"
              {...register('email_or_phone')}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="name@company.com or +2547..."
            />
            {errors.email_or_phone && <p className="text-red-500 text-xs mt-1">{errors.email_or_phone.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                {...register('password')}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                {...register('confirm_password')}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
              {errors.confirm_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white font-medium py-2.5 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 mt-6"
          >
            {isSubmitting ? 'Creating account...' : 'Sign Up'}
          </button>

          <div className="text-center pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-blue-600 hover:underline font-medium"
              >
                Log In
              </button>
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}