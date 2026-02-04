'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Badge, Loader } from '@/components/ui';
import { Package, TrendingUp, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/api';

interface Shipment {
  id: number;
  shipment_reference: string;
  status: string;
  createdAt: string;
  shipping_fee: string;
  currency: string;
  delivery_address: {
    city: string;
    state: string;
    country: string;
  };
}

interface Stat {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}

export default function CustomerDashboardPage() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [recentShipments, setRecentShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((state) => state.getUser());

  useEffect(() => {
    const userId = user?.id ? Number(user.id) : null;
    if (userId) {
      loadDashboardData(userId);
    } else {
      setLoading(false);
      setStats([
        { label: 'Active Shipments', value: '0', icon: Package, color: 'bg-blue-100 text-blue-600' },
        { label: 'Completed', value: '0', icon: TrendingUp, color: 'bg-green-100 text-green-600' },
        { label: 'Total Spent', value: '₦0', icon: MapPin, color: 'bg-purple-100 text-purple-600' },
      ]);
    }
  }, [user?.id]);

  const loadDashboardData = async (userId: number) => {
    try {
      const response = await apiClient.listShipments(userId);
      const shipments: Shipment[] = response.data?.shipments || [];

      // Calculate stats
      const activeShipments = shipments.filter(s => !['delivered', 'cancelled', 'returned'].includes(s.status)).length;
      const completedShipments = shipments.filter(s => s.status === 'delivered').length;
      const totalSpent = shipments.reduce((sum, s) => sum + parseFloat(s.shipping_fee || '0'), 0);
      
      const currency = shipments.length > 0 ? shipments[0].currency : 'NGN';
      const formattedTotalSpent = new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(totalSpent);

      setStats([
        { label: 'Active Shipments', value: activeShipments.toString(), icon: Package, color: 'bg-blue-100 text-blue-600' },
        { label: 'Completed', value: completedShipments.toString(), icon: TrendingUp, color: 'bg-green-100 text-green-600' },
        { label: 'Total Spent', value: formattedTotalSpent, icon: MapPin, color: 'bg-purple-100 text-purple-600' },
      ]);

      // Set recent shipments (top 5)
      setRecentShipments(shipments.slice(0, 5));

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setStats([
        { label: 'Active Shipments', value: 'N/A', icon: Package, color: 'bg-blue-100 text-blue-600' },
        { label: 'Completed', value: 'N/A', icon: TrendingUp, color: 'bg-green-100 text-green-600' },
        { label: 'Total Spent', value: 'N/A', icon: MapPin, color: 'bg-purple-100 text-purple-600' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="customer">
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : null}
      {/* Content */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome back!</h1>
            <p className="text-gray-600 mt-2">Here's what's happening with your shipments</p>
          </div>
          <Link href="/dashboard/customer/shipments/new">
            <Button variant="primary" size="lg">
              + Create Shipment
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Recent Shipments */}
        <Card title="Recent Shipments" description="Your latest shipments">
          {recentShipments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Destination</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentShipments.map((shipment) => (
                    console.log("shipmentttt", shipment),
                    <tr key={shipment.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900">{shipment.delivery_address.city}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          shipment.status === 'Delivered'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {shipment.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{shipment.createdAt.slice(0, 10)}</td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/dashboard/customer/shipments/${shipment.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No shipments yet</p>
              <Link href="/dashboard/customer/shipments/new" className="mt-4 inline-block">
                <Button variant="primary">Create Your First Shipment</Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
