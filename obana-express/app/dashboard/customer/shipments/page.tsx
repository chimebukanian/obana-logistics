'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Badge, Loader } from '@/components/ui';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';

interface Shipment {
  id: number;
  shipment_reference: string;
  status: string;
  total_weight: string;
  createdAt: string;
  delivery_address: {
    line1: string;
    city: string;
    state: string;
  };
  pickup_address: {
    city: string;
    state: string;
  };
}

export default function CustomerShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  const user = useAuthStore((state) => state.getUser());

  useEffect(() => {
    const userId = user?.id ? Number(user.id) : null;
    if (userId) {
      loadShipments(userId);
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const loadShipments = async (userId: number) => {
    try {
      const response = await apiClient.listShipments(userId);
      setShipments(response.data?.shipments || []);
    } catch (err) {
      console.error('Error loading shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="customer">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">My Shipments</h1>
          <Link href="/dashboard/customer/shipments/new">
            <Button variant="primary">+ Create Shipment</Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : shipments.length > 0 ? (
          <div className="space-y-4">
            {shipments.map((shipment) => (
              <Card key={shipment.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {shipment.pickup_address?.city || 'Origin'} → {shipment.delivery_address?.city || 'Destination'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{shipment.delivery_address?.line1}</p>
                    <div className="flex gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-gray-600">Weight</p>
                        <p className="font-medium text-gray-900">{shipment.total_weight} kg</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Created</p>
                        <p className="font-medium text-gray-900">{new Date(shipment.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        shipment.status === 'Delivered'
                          ? 'success'
                          : shipment.status === 'In Transit'
                          ? 'info'
                          : 'warning'
                      }
                    >
                      {shipment.status}
                    </Badge>
                    <Link href={`/dashboard/customer/shipments/${shipment.shipment_reference}`} className="block mt-3">
                      <Button variant="ghost" size="sm">
                        Track Shipment
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
        ) : (
          <Card>
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No shipments yet</p>
              <Link href="/dashboard/customer/shipments/new">
                <Button variant="primary">Create Your First Shipment</Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
