'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Loader } from '@/components/ui';
import { BarChart3, Route, Users, Package, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';
import { apiClient } from '@/lib/api';

interface AdminStats {
  totalRoutes: number;
  activeDrivers: number;
  pendingShipments: number;
  revenue: number;
  recentActivity: any[];
}

export default function AdminDashboard() {
  const [statsData, setStatsData] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { access_token: token} = useAuthStore();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await apiClient.getAdminStats();
        if (response.success) {
          setStatsData(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchStats();
    }
  }, [token]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const stats = [
    { 
      label: 'Total Routes', 
      value: statsData?.totalRoutes.toString() || '0', 
      icon: Route, 
      color: 'bg-blue-100 text-blue-600' 
    },
    { label: 'Active Drivers', value: statsData?.activeDrivers.toString() || '0', icon: Users, color: 'bg-green-100 text-green-600' },
    { label: 'Pending Shipments', value: statsData?.pendingShipments.toString() || '0', icon: Package, color: 'bg-yellow-100 text-yellow-600' },
    { 
      label: 'Revenue (This Month)', 
      value: new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(statsData?.revenue || 0), 
      icon: TrendingUp, 
      color: 'bg-purple-100 text-purple-600' 
    },
  ];

  const quickActions = [
    { label: 'Manage Routes', href: '/dashboard/admin/routes', icon: Route },
    { label: 'Manage Drivers', href: '/dashboard/admin/drivers', icon: Users },
    { label: 'View Shipments', href: '/dashboard/admin/shipments', icon: Package },
    { label: 'Analytics', href: '/dashboard/admin/analytics', icon: BarChart3 },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your logistics operations</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader /></div>
        ) : (
          /* Stats */
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Quick Actions */}
        <Card title="Quick Actions" description="Manage your logistics operations">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href}>
                  <Button fullWidth variant="secondary" className="h-24 flex flex-col items-center justify-center gap-2">
                    <Icon className="w-6 h-6" />
                    <span className="text-sm">{action.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card title="Recent Activity" description="Latest operations">
          <div className="space-y-3">
            {loading ? (
              <div className="py-4 text-center text-gray-500">Loading activity...</div>
            ) : statsData?.recentActivity && statsData.recentActivity.length > 0 ? (
              statsData.recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{activity.description || activity.status?.replace('_', ' ')}</p>
                    <p className="text-sm text-gray-600">{activity.performed_by || 'System'} {activity.shipment ? `• ${activity.shipment.shipment_reference}` : ''}</p>
                  </div>
                  <p className="text-sm text-gray-500">{formatTimeAgo(activity.createdAt)}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
