'use client';

import React, { use, useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Badge, Loader, Button } from '@/components/ui';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { ArrowLeft, Package, Truck, MapPin, User, FileText, Clock, Calendar, Weight, Tag } from 'lucide-react';

interface Address {
  name: string;
  phone: string;
  contact_email: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string;
  instructions: string;
}

interface ShipmentItem {
  id: number;
  name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  weight: string;
}

interface TrackingEvent {
  id: number;
  status: string;
  description: string;
  location: string | null;
  createdAt: string;
  performed_by: string;
}

interface Driver {
  id: number;
  driver_code: string;
  vehicle_type: string;
  vehicle_registration: string;
  metadata: {
    phone: string;
    email: string;
    rating: number;
  };
}

interface ShipmentDetail {
  id: number;
  shipment_reference: string;
  order_reference: string;
  status: string;
  carrier_name: string;
  carrier_type: string;
  total_weight: string;
  total_items: number;
  product_value: string;
  shipping_fee: string;
  currency: string;
  createdAt: string;
  notes: string;
  delivery_address: Address;
  pickup_address: Address;
  items: ShipmentItem[];
  tracking_events: TrackingEvent[];
  driver: Driver | null;
}

export default function ShipmentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const {id} = use(params);
    
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadShipmentDetails(id);
    }
  }, [id]);

  const loadShipmentDetails = async (ref: string) => {
    setLoading(true);
    setError(null);
    try {
      // NOTE: You'll need to implement `getShipment` in your apiClient to call:
      // GET /shipments/track/{shipment_reference}
      const response = await apiClient.getShipment(ref);


      if (response.success) {
        setShipment(response.data);
      setLoading(false);

      } else {
        setError(response.data.message || 'Shipment not found.');
      }
    } catch (err: any) {
      console.error('Error loading shipment details:', err);
      setError(err.response?.data?.message || 'Failed to load shipment details.');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center py-20"><Loader /></div>;
    }

    if (error) {
      return (
        <Card className="text-center py-12">
          <p className="text-red-600 font-semibold">Error</p>
          <p className="text-gray-600 mt-2">{error}</p>
        </Card>
      );
    }

    if (!shipment) {
      return (
        <Card className="text-center py-12">
          <p className="text-gray-600">Shipment details could not be loaded.</p>
        </Card>
      );
    }

    return (
      <>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 truncate mb-2 md:mb-0">
            Shipment #{shipment.shipment_reference}
          </h1>
          <Badge
            variant={
              shipment.status === 'delivered' ? 'success' :
              shipment.status === 'in_transit' ? 'info' :
              ['failed', 'cancelled'].includes(shipment.status) ? 'error' : 'warning'
            }
            className="capitalize"
          >
            {shipment.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Tracking History */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-gray-500" />
                Tracking History
              </h3>
              <div className="relative pl-4 border-l-2 border-gray-200">
                {shipment.tracking_events.map((event, index) => (
                  <div key={event.id} className="mb-8 ml-4">
                    <div className={`absolute -left-2.25 mt-1.5 w-4 h-4 rounded-full ${index === 0 ? 'bg-primary' : 'bg-gray-300'}`}></div>
                    <p className={`font-semibold ${index === 0 ? 'text-primary' : 'text-gray-800'}`}>{event.description}</p>
                    <p className="text-sm text-gray-500">{new Date(event.createdAt).toLocaleString()}</p>
                    {event.location && <p className="text-sm text-gray-500">Location: {event.location}</p>}
                    <p className="text-xs text-gray-400 mt-1">Source: {event.performed_by}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                <Truck className="w-5 h-5 mr-2 text-gray-500" />
                Shipment Details
              </h3>
              <div className="space-y-2 text-sm">
                <p className="flex justify-between"><span><Tag className="inline w-4 h-4 mr-1" />Order Ref:</span> <span className="font-medium">{shipment.order_reference}</span></p>
                <p className="flex justify-between"><span><Calendar className="inline w-4 h-4 mr-1" />Created:</span> <span className="font-medium">{new Date(shipment.createdAt).toLocaleDateString()}</span></p>
                <p className="flex justify-between"><span><Weight className="inline w-4 h-4 mr-1" />Total Weight:</span> <span className="font-medium">{shipment.total_weight} kg</span></p>
                <p className="flex justify-between"><span><Package className="inline w-4 h-4 mr-1" />Total Items:</span> <span className="font-medium">{shipment.total_items}</span></p>
                <p className="flex justify-between"><span>Carrier:</span> <span className="font-medium">{shipment.carrier_name}</span></p>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-gray-500" />
                Addresses
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-medium text-gray-500">Pickup From</p>
                  <p className="font-semibold text-gray-800">{shipment.pickup_address.name}</p>
                  <p className="text-gray-600">{`${shipment.pickup_address.line1}, ${shipment.pickup_address.city}`}</p>
                  <p className="text-gray-600">{shipment.pickup_address.phone}</p>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <p className="font-medium text-gray-500">Deliver To</p>
                  <p className="font-semibold text-gray-800">{shipment.delivery_address.name}</p>
                  <p className="text-gray-600">{`${shipment.delivery_address.line1}, ${shipment.delivery_address.city}`}</p>
                  <p className="text-gray-600">{shipment.delivery_address.phone}</p>
                </div>
              </div>
            </Card>

            {shipment.driver && (
              <Card className="p-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-gray-500" />
                  Assigned Driver
                </h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Driver Code:</span> {shipment.driver.driver_code}</p>
                  <p><span className="font-medium">Vehicle:</span> <span className="capitalize">{shipment.driver.vehicle_type} ({shipment.driver.vehicle_registration})</span></p>
                  <p><span className="font-medium">Contact:</span> {shipment.driver.metadata.phone}</p>
                  <p><span className="font-medium">Rating:</span> {shipment.driver.metadata.rating} / 5</p>
                </div>
              </Card>
            )}

            <Card className="p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                <Package className="w-5 h-5 mr-2 text-gray-500" />
                Items ({shipment.total_items})
              </h3>
              <ul className="divide-y divide-gray-200 text-sm">
                {shipment.items.map(item => (
                  <li key={item.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{item.name} (x{item.quantity})</p>
                      <p className="text-gray-500">Weight: {item.weight} kg</p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: shipment.currency }).format(parseFloat(item.total_price))}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="border-t border-gray-200 mt-4 pt-4 text-sm">
                <p className="flex justify-between font-semibold">
                  <span>Total Product Value</span>
                  <span>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: shipment.currency }).format(parseFloat(shipment.product_value))}</span>
                </p>
              </div>
            </Card>
          </div>
        </div>
      </>
    );
  };

  return (
    <DashboardLayout role="customer">
      <div className="space-y-4">
        <Link href="/dashboard/customer/shipments" className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Shipments
        </Link>
        {renderContent()}
      </div>
    </DashboardLayout>
  );
}