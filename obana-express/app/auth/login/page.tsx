'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, Alert } from '@/components/ui';
import { Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, error, clearError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ userIdentification: '', password: '', rememberMe: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLoading(true);

    try {
      const response = await login(formData.userIdentification, formData.password, formData.rememberMe);
      if (response?.data?.request_id) {
        router.push(`/auth/otp?request_id=${response.data.request_id}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-600 via-blue-400 to-blue-300 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Obana</h1>
          <p className="text-gray-600 mt-2">Welcome Back</p>
        </div>

        {error && (
          <Alert
            type="error"
            className="mb-6 cursor-pointer"
            onClick={clearError}
          >
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email or Phone Number"
            type="text"
            placeholder="you@example.com or +234800..."
            required
            value={formData.userIdentification}
            onChange={(e) => setFormData({ ...formData, userIdentification: e.target.value })}
            icon={<Mail className="w-5 h-5" />}
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            icon={<Lock className="w-5 h-5" />}
          />

          <div className="flex items-center">
            <input
              type="checkbox"
              id="remember"
              checked={formData.rememberMe}
              onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <label htmlFor="remember" className="ml-2 text-sm text-gray-600">
              Remember me
            </label>
          </div>

          <Button type="submit" loading={loading} fullWidth variant="primary">
            Sign In
          </Button>
        </form>

        <div className="mt-6 border-t border-gray-200 pt-6 space-y-3 text-center">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <a href="/auth/signup" className="text-blue-600 hover:text-blue-700 font-semibold">
              Sign up
            </a>
          </p>
          <a href="#" className="block text-sm text-blue-600 hover:text-blue-700 font-semibold">
            Forgot password?
          </a>
        </div>
      </Card>
    </div>
  );
}
