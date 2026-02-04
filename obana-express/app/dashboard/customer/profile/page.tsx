'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Input, Alert } from '@/components/ui';
import { useAuth } from '@/lib/authContext';
import { apiClient } from '@/lib/api';

export default function CustomerProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    first_name: user?.attributes?.first_name || '',
    last_name: user?.attributes?.last_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.updateProfile(formData);
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="customer">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">My Profile</h1>

        {message && (
          <Alert type={message.includes('Error') ? 'error' : 'success'} className="mb-6">
            {message}
          </Alert>
        )}

        <Card title="Personal Information" description="Update your profile details">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="First name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
              <Input
                label="Last Name"
                placeholder="Last name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>

            <Input
              label="Email"
              type="email"
              placeholder="Email address"
              value={formData.email}
              disabled
            />

            <Input
              label="Phone Number"
              type="tel"
              placeholder="Phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Button type="submit" loading={loading} variant="primary">
              Save Changes
            </Button>
          </form>
        </Card>

        <Card title="Account Settings" description="Manage your account security" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div>
                <p className="font-medium text-gray-900">Password</p>
                <p className="text-sm text-gray-600">Change your password</p>
              </div>
              <Button variant="secondary" size="sm">
                Change
              </Button>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-sm text-gray-600">Secure your account with 2FA</p>
              </div>
              <Button variant="secondary" size="sm">
                Enable
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
