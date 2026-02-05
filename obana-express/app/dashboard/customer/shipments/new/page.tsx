'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Input, Select, Alert } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';

export default function CreateShipmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newShipmentInfo, setNewShipmentInfo] = useState<any>(null);
  const [matchedRoute, setMatchedRoute] = useState<any>(null);
  const [step, setStep] = useState<'details' | 'match' | 'confirm'>('details');
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    transport_mode: '',
    service_level: '',
    weight: '',
    pickup_address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      country: '',
      phone: '',
      contact_name: '',
      email: '',
      zip_code: ''
    },
    delivery_address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      country: '',
      phone: '',
      first_name: '',
      last_name: '',
      email: '',
      zip_code: ''
    },
    items: [{ name: '', description: '', quantity: '1', weight: '0', price: '' }],
  });

  const transportModes = [
    { value: 'road', label: 'Road Transport' },
    { value: 'air', label: 'Air Transport' },
    { value: 'sea', label: 'Sea Transport' },
  ];

  const serviceLevels = [
    { value: 'Standard', label: 'Standard' },
    { value: 'Express', label: 'Express' },
    { value: 'Economy', label: 'Express' },
  ];

  const resetForm = () => {
    setFormData({
      origin: '',
      destination: '',
      transport_mode: '',
      service_level: '',
      weight: '',
      pickup_address: {
        line1: '', line2: '', city: '', state: '', country: '', phone: '', contact_name: '', email: '', zip_code: ''
      },
      delivery_address: {
        line1: '', line2: '', city: '', state: '', country: '', phone: '', first_name: '', last_name: '', email: '', zip_code: ''
      },
      items: [{ name: '', description: '', quantity: '1', weight: '0', price: '' }],
    });
    setError('');
    setMatchedRoute(null);
    setStep('details');
    setShowSuccessModal(false);
    setNewShipmentInfo(null);
  };

  const handleMatchRoute = async () => {
    // Validate pickup address (origin)
    if (!formData.pickup_address.city || !formData.pickup_address.state || !formData.pickup_address.country) {
      setError('Please fill in Pickup Address: City, State, and Country are required');
      return;
    }

    // Validate delivery address (destination)
    if (!formData.delivery_address.city || !formData.delivery_address.state || !formData.delivery_address.country) {
      setError('Please fill in Delivery Address: City, State, and Country are required');
      return;
    }

    // Validate items
    if (formData.items.length === 0 || formData.items.some(item => !item.name || !item.quantity || !item.price)) {
      setError('Please add at least one item with all required fields');
      return;
    }

    // Validate transport mode and service level
    if (!formData.transport_mode || !formData.service_level) {
      setError('Please select Transport Mode and Service Level');
      return;
    }

    setLoading(true);
    try {
      // Extract origin and destination cities only (no state)
      const originCity = formData.pickup_address.city;
      const destinationCity = formData.delivery_address.city;
      
      // Calculate total weight from items
      const totalWeight = formData.items.reduce((sum, item) => sum + ((parseFloat(item.weight) || 0) * (parseInt(item.quantity) || 1)), 0);

      const response = await apiClient.matchRoute(
        totalWeight,
        originCity,
        destinationCity,
        formData.transport_mode,
        formData.service_level
      );

      if (response.data) {
        setMatchedRoute(response.data);
        setStep('match');
        setError('');
      } else {
        setError('No matching routes found. Try different parameters.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error matching routes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!matchedRoute) return;

    // Validate pickup address
    if (!formData.pickup_address.line1 || !formData.pickup_address.city || 
        !formData.pickup_address.state || !formData.pickup_address.country || 
        !formData.pickup_address.phone) {
      setError('Please fill all pickup address fields');
      return;
    }

    // Validate delivery address
    if (!formData.delivery_address.line1 || !formData.delivery_address.city || 
        !formData.delivery_address.state || !formData.delivery_address.country || 
        !formData.delivery_address.phone) {
      setError('Please fill all delivery address fields');
      return;
    }

    // Validate items
    if (formData.items.length === 0 || formData.items.some(item => !item.name || !item.quantity || !item.price)) {
      setError('Please add at least one item with all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.createShipment({
        pickup_address: formData.pickup_address,
        delivery_address: formData.delivery_address,
        items: formData.items.map(item => ({
          name: item.name,
          description: item.description,
          quantity: parseInt(item.quantity),
          weight: parseFloat(item.weight || '0'),
          price: parseFloat(item.price),
          total_price: parseFloat(item.price) * parseInt(item.quantity),
        })),
        transport_mode: formData.transport_mode,
        service_level: formData.service_level,
        vendor_name:'obana.africa',
        shipping_fee: matchedRoute.match.price,
        estimated_delivery: matchedRoute.match.estimated_delivery,
        
      });

      if (response.success && response.data) {
        setNewShipmentInfo(response.data);
        setShowSuccessModal(true);
      } else {
        setError(response.message || 'Error creating shipment');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error creating shipment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="customer">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Create Shipment</h1>
          <Link href="/dashboard/customer/shipments">
            <Button variant="ghost">← Back</Button>
          </Link>
        </div>

        {error && (
          <Alert type="error" className="cursor-pointer" onClick={() => setError('')}>
            {error}
          </Alert>
        )}

        {showSuccessModal && newShipmentInfo && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Shipment Created!</h2>
              <p className="text-gray-600 mt-2 mb-4">Your shipment has been created successfully.</p>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left space-y-2 text-sm mb-6">
                <p><span className="font-semibold">Tracking #:</span> {newShipmentInfo.shipment_reference}</p>
                <p><span className="font-semibold">Carrier:</span> {newShipmentInfo.carrier}</p>
                <p>
                  <span className="font-semibold">Status:</span> 
                  <span className="capitalize ml-1">{newShipmentInfo.status}</span>
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => router.push(`/dashboard/customer/shipments/${newShipmentInfo.shipment_reference}`)}
                  fullWidth
                  variant="primary"
                >
                  Track Shipment
                </Button>
                <Button
                  onClick={resetForm}
                  fullWidth
                  variant="secondary"
                >
                  Create Another Shipment
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 'details' && (
          <Card title="Shipment Details" description="Enter shipment information">
            <div className="space-y-6">
              {/* Pickup Address Section */}
              <div className="border-2 border-blue-100 rounded-lg p-5 bg-blue-50">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                  Pickup Address Details
                </h3>
                <div className="space-y-4">
                  <Input
                    label="Street Address *"
                    placeholder="e.g., 123 Main Street"
                    value={formData.pickup_address.line1}
                    onChange={(e) => setFormData({
                      ...formData,
                      pickup_address: { ...formData.pickup_address, line1: e.target.value }
                    })}
                    required
                  />

                  <Input
                    label="Street Address (Line 2)"
                    placeholder="e.g., Apartment, Suite (Optional)"
                    value={formData.pickup_address.line2}
                    onChange={(e) => setFormData({
                      ...formData,
                      pickup_address: { ...formData.pickup_address, line2: e.target.value }
                    })}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="City *"
                      placeholder="e.g., Lagos"
                      value={formData.pickup_address.city}
                      onChange={(e) => setFormData({
                        ...formData,
                        pickup_address: { ...formData.pickup_address, city: e.target.value }
                      })}
                      required
                    />
                    <Input
                      label="State *"
                      placeholder="e.g., Lagos State"
                      value={formData.pickup_address.state}
                      onChange={(e) => setFormData({
                        ...formData,
                        pickup_address: { ...formData.pickup_address, state: e.target.value }
                      })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Country *"
                      placeholder="e.g., Nigeria"
                      value={formData.pickup_address.country}
                      onChange={(e) => setFormData({
                        ...formData,
                        pickup_address: { ...formData.pickup_address, country: e.target.value }
                      })}
                      required
                    />
                    <Input
                      label="ZIP Code"
                      placeholder="Optional"
                      value={formData.pickup_address.zip_code || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        pickup_address: { ...formData.pickup_address, zip_code: e.target.value }
                      })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Contact Name"
                      placeholder="Pickup contact person"
                      value={formData.pickup_address.contact_name}
                      onChange={(e) => setFormData({
                        ...formData,
                        pickup_address: { ...formData.pickup_address, contact_name: e.target.value }
                      })}
                    />
                    <Input
                      label="Phone Number *"
                      placeholder="e.g., +234 801 234 5678"
                      value={formData.pickup_address.phone}
                      onChange={(e) => setFormData({
                        ...formData,
                        pickup_address: { ...formData.pickup_address, phone: e.target.value }
                      })}
                      required
                    />
                  </div>

                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="Optional"
                    value={formData.pickup_address.email}
                    onChange={(e) => setFormData({
                      ...formData,
                      pickup_address: { ...formData.pickup_address, email: e.target.value }
                    })}
                  />
                </div>
              </div>

              {/* Delivery Address Section */}
              <div className="border-2 border-green-100 rounded-lg p-5 bg-green-50">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                  Delivery Address Details
                </h3>
                <div className="space-y-4">
                  <Input
                    label="Street Address *"
                    placeholder="e.g., 123 Main Street"
                    value={formData.delivery_address.line1}
                    onChange={(e) => setFormData({
                      ...formData,
                      delivery_address: { ...formData.delivery_address, line1: e.target.value }
                    })}
                    required
                  />

                  <Input
                    label="Street Address (Line 2)"
                    placeholder="e.g., Apartment, Suite (Optional)"
                    value={formData.delivery_address.line2}
                    onChange={(e) => setFormData({
                      ...formData,
                      delivery_address: { ...formData.delivery_address, line2: e.target.value }
                    })}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="City *"
                      placeholder="e.g., Lagos"
                      value={formData.delivery_address.city}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, city: e.target.value }
                      })}
                      required
                    />
                    <Input
                      label="State *"
                      placeholder="e.g., Lagos State"
                      value={formData.delivery_address.state}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, state: e.target.value }
                      })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Country *"
                      placeholder="e.g., Nigeria"
                      value={formData.delivery_address.country}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, country: e.target.value }
                      })}
                      required
                    />
                    <Input
                      label="ZIP Code"
                      placeholder="Optional"
                      value={formData.delivery_address.zip_code || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, zip_code: e.target.value }
                      })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="First Name"
                      placeholder="Recipient first name"
                      value={formData.delivery_address.first_name}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, first_name: e.target.value }
                      })}
                    />
                    <Input
                      label="Last Name"
                      placeholder="Recipient last name"
                      value={formData.delivery_address.last_name}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, last_name: e.target.value }
                      })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Phone Number *"
                      placeholder="e.g., +234 801 234 5678"
                      value={formData.delivery_address.phone}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, phone: e.target.value }
                      })}
                      required
                    />
                    <Input
                      label="Email Address"
                      type="email"
                      placeholder="Optional"
                      value={formData.delivery_address.email}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, email: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div className="border-2 border-purple-100 rounded-lg p-5 bg-purple-50">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                  Items to Ship
                </h3>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-purple-200 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Item Name"
                          placeholder="e.g., Electronics"
                          value={item.name}
                          onChange={(e) => {
                            const newItems = [...formData.items];
                            newItems[index].name = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                          required
                        />
                        <Input
                          label="Quantity"
                          type="number"
                          min="1"
                          placeholder="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...formData.items];
                            newItems[index].quantity = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                          required
                        />
                      </div>
                      <Input
                        label="Description"
                        placeholder="Item details (optional)"
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[index].description = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                      />
                      <div className="grid grid-cols-3 gap-3">
                        <Input
                          label="Price (₦)"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={item.price}
                          onChange={(e) => {
                            const newItems = [...formData.items];
                            newItems[index].price = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                          required
                        />
                        <Input
                          label="Weight (kg)"
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={item.weight}
                          onChange={(e) => {
                            const newItems = [...formData.items];
                            newItems[index].weight = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                        />
                        {formData.items.length > 1 && (
                          <div className="flex items-end">
                            <Button
                              onClick={() => {
                                const newItems = formData.items.filter((_, i) => i !== index);
                                setFormData({ ...formData, items: newItems });
                              }}
                              variant="secondary"
                              fullWidth
                              className="bg-red-50 text-red-600 hover:bg-red-100"
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => {
                    setFormData({
                      ...formData,
                      items: [...formData.items, { name: '', description: '', quantity: '1', weight: '0', price: '' }]
                    });
                  }}
                  variant="secondary"
                  fullWidth
                  className="mt-3"
                >
                  + Add Another Item
                </Button>
              </div>

              {/* Transport & Service Level Section */}
              <div className="border-2 border-orange-100 rounded-lg p-5 bg-orange-50">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">4</span>
                  Shipping Method & ETA
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Transport Mode *"
                      options={transportModes}
                      value={formData.transport_mode}
                      onChange={(e) => setFormData({ ...formData, transport_mode: e.target.value })}
                      required
                    />
                    <Select
                      label="Service Level *"
                      options={serviceLevels}
                      value={formData.service_level}
                      onChange={(e) => setFormData({ ...formData, service_level: e.target.value })}
                      required
                    />
                  </div>
                  <p className="text-sm text-gray-600 italic">
                    These selections will help determine the estimated delivery time and price for your shipment.
                  </p>
                </div>
              </div>

              <Button
                onClick={handleMatchRoute}
                loading={loading}
                fullWidth
                variant="primary"
                className="mt-6"
              >
                Check Price & ETA
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Route Match */}
        {step === 'match' && matchedRoute && (
          <Card title="Pricing & ETA" description="Review the matched route">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600">Route</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formData.pickup_address.city}, {formData.pickup_address.state} → {formData.delivery_address.city}, {formData.delivery_address.state}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Price</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₦{matchedRoute.match.price?.toLocaleString() || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Estimated Delivery</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {matchedRoute.match.eta || 'N/A'} days
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <Button
                  onClick={() => setStep('confirm')}
                  fullWidth
                  variant="primary"
                >
                  Continue to Confirmation
                </Button>
                <Button
                  onClick={() => setStep('details')}
                  fullWidth
                  variant="secondary"
                >
                  Back to Details
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <Card title="Confirm Shipment" description="Review and confirm your shipment">
            <div className="space-y-6">
              {/* Route Summary */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Shipment Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Route</p>
                    <p className="font-semibold text-gray-900">{formData.pickup_address.city}, {formData.pickup_address.state} → {formData.delivery_address.city}, {formData.delivery_address.state}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Transport Mode</p>
                    <p className="font-semibold text-gray-900">{formData.transport_mode}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Service Level</p>
                    <p className="font-semibold text-gray-900">{formData.service_level}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Estimated Price</p>
                    <p className="font-bold text-green-600">₦{matchedRoute?.match.price?.toLocaleString() || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Pickup Address */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Pickup Address</h3>
                <div className="text-sm space-y-2 text-gray-700">
                  {formData.pickup_address.contact_name && (
                    <p><span className="font-semibold">Contact:</span> {formData.pickup_address.contact_name}</p>
                  )}
                  <p>{formData.pickup_address.line1}</p>
                  {formData.pickup_address.line2 && <p>{formData.pickup_address.line2}</p>}
                  <p>{formData.pickup_address.city}, {formData.pickup_address.state} {formData.pickup_address.zip_code}</p>
                  <p>{formData.pickup_address.country}</p>
                  <p><span className="font-semibold">Phone:</span> {formData.pickup_address.phone}</p>
                  {formData.pickup_address.email && <p><span className="font-semibold">Email:</span> {formData.pickup_address.email}</p>}
                </div>
              </div>

              {/* Delivery Address */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Delivery Address</h3>
                <div className="text-sm space-y-2 text-gray-700">
                  {formData.delivery_address.first_name && formData.delivery_address.last_name && (
                    <p><span className="font-semibold">Recipient:</span> {formData.delivery_address.first_name} {formData.delivery_address.last_name}</p>
                  )}
                  <p>{formData.delivery_address.line1}</p>
                  {formData.delivery_address.line2 && <p>{formData.delivery_address.line2}</p>}
                  <p>{formData.delivery_address.city}, {formData.delivery_address.state} {formData.delivery_address.zip_code}</p>
                  <p>{formData.delivery_address.country}</p>
                  <p><span className="font-semibold">Phone:</span> {formData.delivery_address.phone}</p>
                  {formData.delivery_address.email && <p><span className="font-semibold">Email:</span> {formData.delivery_address.email}</p>}
                </div>
              </div>

              {/* Items Summary */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Items ({formData.items.length})</h3>
                <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start py-2 border-b last:border-0">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        {item.description && <p className="text-sm text-gray-600">{item.description}</p>}
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold text-gray-900">Qty: {item.quantity}</p>
                        <p className="text-gray-600">₦{parseFloat(item.price || '0').toLocaleString('en-NG', { minimumFractionDigits: 2 })} × {item.quantity}</p>
                        <p className="font-semibold text-gray-900">₦{(parseFloat(item.price || '0') * parseInt(item.quantity)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleCreateShipment}
                  loading={loading}
                  fullWidth
                  variant="primary"
                >
                  Confirm & Create Shipment
                </Button>
                <Button
                  onClick={() => setStep('details')}
                  fullWidth
                  variant="secondary"
                >
                  Back to Details
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
