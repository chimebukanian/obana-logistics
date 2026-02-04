'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, Alert } from '@/components/ui';
import { Mail, Phone, User } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const { signup, error, clearError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'role' | 'info'>('role');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [formData, setFormData] = useState({ email: '', phone: '', password: '', confirmPassword: '' });

  const roles = [
    { id: 'customer', label: 'Customer', description: 'Ship packages & track shipments' },
    { id: 'driver', label: 'Driver', description: 'Accept deliveries & earn' },
    { id: 'admin', label: 'admin', description: 'Manage operations & orders' },
  ];

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    setStep('info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !formData.email || !formData.phone || !formData.password) return;

    if (formData.password !== formData.confirmPassword) {
      return;
    }

    setLoading(true);
    try {
      const response = await signup(formData.email, formData.phone, formData.password, selectedRole);
      if (response?.data?.request_id) {
        router.push(`/auth/otp?request_id=${response.data.request_id}&email=${formData.email}`);
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
          <p className="text-gray-600 mt-2">Logistics Made Simple</p>
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

        {step === 'role' ? (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Choose Your Role</h2>
            <div className="space-y-3">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                >
                  <h3 className="font-semibold text-gray-900">{role.label}</h3>
                  <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Sign up as <span className="text-blue-600">{roles.find(r => r.id === selectedRole)?.label}</span>
              </h2>
            </div>

            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              icon={<Mail className="w-5 h-5" />}
            />

            <Input
              label="Phone Number"
              type="tel"
              placeholder="+234 (0) 800 000 0000"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              icon={<Phone className="w-5 h-5" />}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              required
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            />

            <Button type="submit" loading={loading} fullWidth variant="primary">
              Send OTP
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep('role');
                setSelectedRole('');
              }}
              className="w-full text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Back to Role Selection
            </button>
          </form>
        )}

        <div className="mt-6 text-center border-t border-gray-200 pt-6">
          <p className="text-gray-600">
            Already have an account?{' '}
            <a href="/auth/login" className="text-blue-600 hover:text-blue-700 font-semibold">
              Sign in
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}
