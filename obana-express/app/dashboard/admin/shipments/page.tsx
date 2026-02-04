'use client';

import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Badge } from '@/components/ui';

export default function AdminShipmentsPage() {
  const shipments = [
    { id: 'SHP001', from: 'Lagos', to: 'Ibadan', status: 'Delivered', date: '2026-01-31' },
    { id: 'SHP002', from: 'Abuja', to: 'Kano', status: 'In Transit', date: '2026-01-31' },
    { id: 'SHP003', from: 'Port Harcourt', to: 'Lagos', status: 'Pending', date: '2026-01-30' },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Shipments Overview</h1>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Route</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shipment) => (
                  <tr key={shipment.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{shipment.id}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {shipment.from} → {shipment.to}
                    </td>
                    <td className="py-3 px-4">
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
                    </td>
                    <td className="py-3 px-4 text-gray-600">{shipment.date}</td>
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
