'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Badge, Loader, Select, Input, Alert } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { ArrowLeft, MapPin, Package, Calendar, Truck, User, X, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function ShipmentDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const reference = params.reference as string;

  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Update Status State
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateForm, setUpdateForm] = useState({ status: '', location: '', notes: '' });
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadShipment();
  }, [reference]);

  const loadShipment = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getShipment(reference);
      if (response.success) {
        setShipment(response.data);
      } else {
        setError('Shipment not found');
      }
    } catch (err) {
      setError('Error loading shipment details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this shipment? This action cannot be undone.')) return;
    
    try {
      await apiClient.deleteShipment(shipment.id);
      router.push('/dashboard/admin/shipments');
    } catch (err) {
      alert('Failed to delete shipment');
      console.error(err);
    }
  };

  const handleUpdateClick = () => {
    setUpdateForm({ 
      status: shipment.status, 
      location: '', 
      notes: '' 
    });
    setShowUpdateModal(true);
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipment) return;
    
    try {
      setUpdating(true);
      await apiClient.updateShipmentStatus(shipment.id.toString(), updateForm.status, updateForm.notes, updateForm.location);
      setShowUpdateModal(false);
      loadShipment(); // Reload to see changes
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !shipment) {
    return (
      <DashboardLayout role="admin">
        <Alert type="error">{error || 'Shipment not found'}</Alert>
        <div className="mt-4">
          <Link href="/dashboard/admin/shipments">
            <Button variant="secondary">Back to Shipments</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin/shipments">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{shipment.shipment_reference}</h1>
              <p className="text-gray-600 text-sm">Created on {new Date(shipment.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleUpdateClick}>
              Update Status
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Current Status</h3>
                <Badge
                  variant={
                    shipment.status === 'delivered' ? 'success' :
                    shipment.status === 'in_transit' ? 'info' :
                    shipment.status === 'cancelled' || shipment.status === 'failed' ? 'error' :
                    'warning'
                  }
                  className="text-sm px-3 py-1 capitalize"
                >
                  {shipment.status.replace('_', ' ')}
                </Badge>
              </div>
              
              {/* Tracking Timeline */}
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                {shipment.tracking_events?.map((event: any, index: number) => (
                  <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-blue-500 text-slate-500 group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 shadow">
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-slate-900 capitalize">{event.status.replace('_', ' ')}</div>
                        <time className="font-caveat font-medium text-indigo-500 text-xs">
                          {new Date(event.createdAt).toLocaleString()}
                        </time>
                      </div>
                      <div className="text-slate-500 text-sm">
                        {event.description}
                        {event.location && <div className="mt-1 text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3"/> {event.location}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Items */}
            <Card title="Shipment Items">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-4 py-2">Item</th>
                      <th className="px-4 py-2">Qty</th>
                      <th className="px-4 py-2">Weight</th>
                      <th className="px-4 py-2">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipment.items?.map((item: any) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-2 font-medium">{item.name}</td>
                        <td className="px-4 py-2">{item.quantity}</td>
                        <td className="px-4 py-2">{item.weight} kg</td>
                        <td className="px-4 py-2">
                          {new Intl.NumberFormat('en-NG', { style: 'currency', currency: item.currency }).format(item.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            {/* Route Info */}
            <Card title="Route Details">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1"><div className="w-2 h-2 rounded-full bg-blue-500" /></div>
                  <div>
                    <p className="text-xs text-gray-500">Pickup</p>
                    <p className="font-medium text-gray-900">{shipment.pickup_address?.name}</p>
                    <p className="text-sm text-gray-600">{shipment.pickup_address?.line1}</p>
                    <p className="text-sm text-gray-600">{shipment.pickup_address?.city}, {shipment.pickup_address?.state}</p>
                    <p className="text-sm text-gray-600">{shipment.pickup_address?.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1"><div className="w-2 h-2 rounded-full bg-green-500" /></div>
                  <div>
                    <p className="text-xs text-gray-500">Delivery</p>
                    <p className="font-medium text-gray-900">{shipment.delivery_address?.name}</p>
                    <p className="text-sm text-gray-600">{shipment.delivery_address?.line1}</p>
                    <p className="text-sm text-gray-600">{shipment.delivery_address?.city}, {shipment.delivery_address?.state}</p>
                    <p className="text-sm text-gray-600">{shipment.delivery_address?.phone}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Driver Info */}
            <Card title="Driver Details">
              {shipment.driver ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{shipment.driver.driver_code}</p>
                      <Badge variant="success" className="text-xs">Active</Badge>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Vehicle</span>
                      <span className="font-medium capitalize">{shipment.driver.vehicle_type}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500">Plate</span>
                      <span className="font-medium">{shipment.driver.vehicle_registration}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No driver assigned
                </div>
              )}
            </Card>

            {/* Payment Info */}
            <Card title="Payment Details">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Shipping Fee</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('en-NG', { style: 'currency', currency: shipment.currency }).format(shipment.shipping_fee)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Product Value</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('en-NG', { style: 'currency', currency: shipment.currency }).format(shipment.product_value)}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-gray-900">
                    {new Intl.NumberFormat('en-NG', { style: 'currency', currency: shipment.currency }).format(Number(shipment.shipping_fee) + Number(shipment.product_value))}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Update Status Modal */}
        {showUpdateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Update Shipment Status</h2>
                <button onClick={() => setShowUpdateModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleUpdateSubmit} className="space-y-4">
                <Select
                  label="New Status"
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                  options={[
                    { value: 'pending', label: 'Pending' },
                    { value: 'picked_up', label: 'Picked Up' },
                    { value: 'in_transit', label: 'In Transit' },
                    { value: 'delivered', label: 'Delivered' },
                    { value: 'cancelled', label: 'Cancelled' },
                    { value: 'returned', label: 'Returned' },
                  ]}
                />

                <Input
                  label="Current Location"
                  placeholder="e.g. Ikeja, Lagos"
                  value={updateForm.location}
                  onChange={(e) => setUpdateForm({ ...updateForm, location: e.target.value })}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Optional notes about the update..."
                    value={updateForm.notes}
                    onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" fullWidth variant="primary" loading={updating}>
                    Update Status
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
