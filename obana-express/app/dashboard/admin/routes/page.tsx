'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Input, Select, Alert, Loader } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

interface RouteTemplate {
  id: string;
  origin_city: string;
  destination_city: string;
  transport_mode: string;
  service_level: string;
  weight_brackets: any[];
  metadata: any;
}

export default function RoutesManagement() {
  const [routes, setRoutes] = useState<RouteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteTemplate | null>(null);
  const [formData, setFormData] = useState<{
    origin_city: string;
    destination_city: string;
    transport_mode: string;
    service_level: string;
    weight_brackets: { min: string; max: string; price: string; eta: string }[];
  }>({
    origin_city: '',
    destination_city: '',
    transport_mode: 'road',
    service_level: 'Standard',
    weight_brackets: [],
  });

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const response = await apiClient.listRoutes();
      setRoutes(response.data || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error loading routes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate and format brackets
    const formattedBrackets = formData.weight_brackets.map(b => ({
      min: parseFloat(b.min),
      max: parseFloat(b.max),
      price: parseFloat(b.price),
      eta: b.eta
    }));

    if (formattedBrackets.some(b => isNaN(b.min) || isNaN(b.max) || isNaN(b.price) || !b.eta)) {
      setError('Please fill all fields in weight brackets correctly');
      return;
    }

    try {
      const payload = {
        origin_city: formData.origin_city,
        destination_city: formData.destination_city,
        transport_mode: formData.transport_mode,
        service_level: formData.service_level,
        weight_brackets: formattedBrackets,
        metadata: {},
      };

      if (editingRoute) {
        await apiClient.updateRoute(editingRoute.id, payload);
      } else {
        await apiClient.createRoute(payload);
      }

      await loadRoutes();
      setShowModal(false);
      setEditingRoute(null);
      resetForm();
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error saving route');
    }
  };

  const handleEdit = (route: RouteTemplate) => {
    setEditingRoute(route);
    setFormData({
      origin_city: route.origin_city,
      destination_city: route.destination_city,
      transport_mode: route.transport_mode,
      service_level: route.service_level,
      weight_brackets: Array.isArray(route.weight_brackets) 
        ? route.weight_brackets.map((b: any) => ({
            min: String(b.min || ''),
            max: String(b.max || ''),
            price: String(b.price || ''),
            eta: b.eta || ''
          }))
        : [],
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this route?')) {
      try {
        await apiClient.deleteRoute(id);
        await loadRoutes();
        setError('');
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error deleting route');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      origin_city: '',
      destination_city: '',
      transport_mode: 'road',
      service_level: 'Standard',
      weight_brackets: [],
    });
  };

  const addBracket = () => {
    setFormData({
      ...formData,
      weight_brackets: [...formData.weight_brackets, { min: '', max: '', price: '', eta: '' }]
    });
  };

  const removeBracket = (index: number) => {
    const newBrackets = [...formData.weight_brackets];
    newBrackets.splice(index, 1);
    setFormData({ ...formData, weight_brackets: newBrackets });
  };

  const updateBracket = (index: number, field: string, value: string) => {
    const newBrackets = [...formData.weight_brackets];
    // @ts-ignore
    newBrackets[index] = { ...newBrackets[index], [field]: value };
    setFormData({ ...formData, weight_brackets: newBrackets });
  };

  const handleAddNew = () => {
    setEditingRoute(null);
    resetForm();
    setShowModal(true);
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Route Templates</h1>
          <Button onClick={handleAddNew} variant="primary">
            <Plus className="w-5 h-5" />
            New Route
          </Button>
        </div>

        {error && (
          <Alert type="error" className="cursor-pointer" onClick={() => setError('')}>
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : (
          <Card>
            {routes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Route</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Mode</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Service</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">Brackets</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((route) => (
                      <tr key={route.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">
                            {route.origin_city} → {route.destination_city}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{route.transport_mode}</td>
                        <td className="py-3 px-4 text-gray-600">{route.service_level}</td>
                        {/* <td className="py-3 px-4 text-gray-600">
                          <select>
                          {route.weight_brackets?.length || 0}
                          {route.weight_brackets?.map((bracket:any, index:number) => {
                          return <option key={index}>{bracket.eta} {bracket.min}</option>
                          })
                          </select>
                          </td> */}
                        {/* i want to use t o display the above weight_brackets as a drop down showing all instead, here's it shape: [
                {
                    "eta": "2-3 days",
                    "max": 1,
                    "min": 0,
                    "price": 20000
                },
                {
                    "eta": "3-5 days",
                    "max": 5,
                    "min": 1.01,
                    "price": 50000
                }
            ], implement the fix below:*/}
                        <td className="py-3 px-4 text-gray-600">
                          <Select
                            value="see"
                            onChange={() => {}}
                            options={[
                              ...(route.weight_brackets || []).map((bracket: any, index: number) => ({
                                value: `${bracket.min}-${bracket.max} kg`,
                                label: `${bracket.min}-${bracket.max} kg (ETA: ${bracket.eta}, Price: ₦${bracket.price})`,
                              })),
                            ]}
                          />
                        </td>
                        
                      
                        <td className="py-3 px-4 text-right space-x-2">
                          <Button
                            onClick={() => handleEdit(route)}
                            variant="ghost"
                            size="sm"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(route.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-4">No routes created yet</p>
                <Button onClick={handleAddNew} variant="primary">
                  Create First Route
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-white">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingRoute ? 'Edit Route' : 'Create Route'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingRoute(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Origin City"
                  placeholder="e.g., Lagos"
                  value={formData.origin_city}
                  onChange={(e) => setFormData({ ...formData, origin_city: e.target.value })}
                  required
                />

                <Input
                  label="Destination City"
                  placeholder="e.g., Ibadan"
                  value={formData.destination_city}
                  onChange={(e) => setFormData({ ...formData, destination_city: e.target.value })}
                  required
                />

                <Select
                  label="Transport Mode"
                  value={formData.transport_mode}
                  onChange={(e) => setFormData({ ...formData, transport_mode: e.target.value })}
                  options={[
                    { value: 'road', label: 'Road' },
                    { value: 'air', label: 'Air' },
                    { value: 'sea', label: 'Sea' },
                  ]}
                />

                <Select
                  label="Service Level"
                  value={formData.service_level}
                  onChange={(e) => setFormData({ ...formData, service_level: e.target.value })}
                  options={[
                    { value: 'Standard', label: 'Standard' },
                    { value: 'Express', label: 'Express' },
                    { value: 'International Express', label: 'International Express' },
                  ]}
                />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Weight Brackets
                    </label>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addBracket}
                      className="text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Bracket
                    </Button>
                  </div>
                  
                  {formData.weight_brackets.length === 0 && (
                    <div className="text-center p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 text-sm">
                      No weight brackets defined. Click "Add Bracket" to start.
                    </div>
                  )}

                  <div className="space-y-3">
                    {formData.weight_brackets.map((bracket, index) => (
                      <div key={index} className="flex gap-2 items-start bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                          <label>Min (kg)</label> 
                          <label>Max (kg)</label>
                          <label>Price (₦)</label>
                          <label>ETA</label>
                          <Input
                            placeholder="Min (kg)"
                            type="number"
                            value={bracket.min}
                            onChange={(e) => updateBracket(index, 'min', e.target.value)}
                            className="bg-white"
                            required
                          />
                          <Input
                            placeholder="Max (kg)"
                            type="number"
                            value={bracket.max}
                            onChange={(e) => updateBracket(index, 'max', e.target.value)}
                            className="bg-white"
                            required
                          />
                          
                          <Input
                            placeholder="Price (₦)"
                            type="number"
                            value={bracket.price}
                            onChange={(e) => updateBracket(index, 'price', e.target.value)}
                            className="bg-white"
                            required
                          />
                          <Input
                            placeholder="ETA (e.g. 2-3 days)"
                            value={bracket.eta}
                            onChange={(e) => updateBracket(index, 'eta', e.target.value)}
                            className="bg-white"
                            required
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeBracket(index)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-10 w-10 p-0"
                        >
                          <span>delete</span>
                          <Trash2 className="w-12 h-12" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <Button type="submit" fullWidth variant="primary">
                    {editingRoute ? 'Update Route' : 'Create Route'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingRoute(null);
                    }}
                    fullWidth
                    variant="secondary"
                  >
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
