'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Input, Select, Loader, Alert } from '@/components/ui';
import { Users, Edit2, Trash2, X, Plus } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Driver {
  id: number;
  user_id: number;
  driver_code: string;
  vehicle_type: string;
  vehicle_registration: string;
  status: string;
  total_deliveries: number;
  metadata: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
  };
  user?: {
    email: string;
    phone: string;
  };
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    vehicle_type: 'bike',
    vehicle_registration: '',
    status: 'active'
  });

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.listDrivers();
      setDrivers(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingDriver(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      password: '',
      vehicle_type: 'bike',
      vehicle_registration: '',
      status: 'active'
    });
    setShowModal(true);
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      first_name: driver.metadata?.first_name || '',
      last_name: driver.metadata?.last_name || '',
      email: driver.user?.email || driver.metadata?.email || '',
      phone: driver.user?.phone || driver.metadata?.phone || '',
      password: '', // Don't show password
      vehicle_type: driver.vehicle_type,
      vehicle_registration: driver.vehicle_registration || '',
      status: driver.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this driver? This action cannot be undone.')) {
      try {
        await apiClient.deleteDriver(id.toString());
        await loadDrivers();
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to delete driver');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (editingDriver) {
        await apiClient.updateDriver(editingDriver.user_id.toString(), formData);
      } else {
        await apiClient.createDriver(formData);
      }
      setShowModal(false);
      loadDrivers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Operation failed');
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Driver Management</h1>
          <Button onClick={handleAddNew} variant="primary">
            <Plus className="w-5 h-5 mr-2" />
            Add Driver
          </Button>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <Card>
          {loading ? (
            <div className="flex justify-center py-12"><Loader /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Vehicle</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Deliveries</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.length > 0 ? drivers.map((driver) => (
                    <tr key={driver.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">{driver.driver_code}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">
                          {driver.metadata?.first_name || 'Unknown'} {driver.metadata?.last_name || ''}
                        </p>
                        <p className="text-xs text-gray-500">{driver.user?.phone || driver.metadata?.phone}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-600 capitalize">
                        {driver.vehicle_type} <span className="text-xs text-gray-400">({driver.vehicle_registration})</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                            driver.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {driver.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{driver.total_deliveries}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(driver)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(driver.user_id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">No drivers found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-white">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingDriver ? 'Edit Driver' : 'Add New Driver'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                  <Input
                    label="Last Name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>

                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!!editingDriver} // Prevent email change for simplicity
                />

                <Input
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />

                {!editingDriver && (
                  <Input
                    label="Password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    placeholder="Set initial password"
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Vehicle Type"
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                    options={[
                      { value: 'bike', label: 'Bike' },
                      { value: 'car', label: 'Car' },
                      { value: 'van', label: 'Van' },
                      { value: 'truck', label: 'Truck' },
                    ]}
                  />
                  <Input
                    label="Registration No."
                    value={formData.vehicle_registration}
                    onChange={(e) => setFormData({ ...formData, vehicle_registration: e.target.value })}
                    placeholder="ABC-123-XYZ"
                  />
                </div>

                {editingDriver && (
                  <Select
                    label="Status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                      { value: 'suspended', label: 'Suspended' },
                    ]}
                  />
                )}

                <div className="pt-4 space-y-3">
                  <Button type="submit" fullWidth variant="primary">
                    {editingDriver ? 'Update Driver' : 'Create Driver'}
                  </Button>
                  <Button type="button" onClick={() => setShowModal(false)} fullWidth variant="secondary">
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
