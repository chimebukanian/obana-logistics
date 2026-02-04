'use client';

import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button } from '@/components/ui';
import { Package, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';

export default function AgentDashboard() {
  const stats = [
    { label: 'Active Orders', value: '8', icon: Package, color: 'bg-blue-100 text-blue-600' },
    { label: 'Pending Shipments', value: '5', icon: TrendingUp, color: 'bg-yellow-100 text-yellow-600' },
    { label: 'Customers', value: '24', icon: Users, color: 'bg-green-100 text-green-600' },
  ];

  const recentOrders = [
    { id: 'ORD001', customer: 'Acme Corp', status: 'Processing', date: '2026-01-31' },
    { id: 'ORD002', customer: 'Tech Store', status: 'Shipped', date: '2026-01-30' },
    { id: 'ORD003', customer: 'Fashion Hub', status: 'Pending', date: '2026-01-30' },
  ];

  return (
    <DashboardLayout role="agent">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Agent Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage orders and shipments for your customers</p>
          </div>
          <Link href="/dashboard/agent/orders/new">
            <Button variant="primary">+ New Order</Button>
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

        {/* Recent Orders */}
        <Card title="Recent Orders" description="Your latest orders">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Order ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Customer</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{order.id}</td>
                    <td className="py-3 px-4 text-gray-600">{order.customer}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.status === 'Shipped'
                            ? 'bg-green-100 text-green-800'
                            : order.status === 'Processing'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{order.date}</td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
