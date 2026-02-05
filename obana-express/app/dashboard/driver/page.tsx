"use client";
import { Card, Button, Badge, Loader } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { TrendingUp, Package, MapPin, Clock } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
interface Shipment {
  id: number;
  shipment_reference: string;
  pickup_address: { city: string; state: string };
  delivery_address: { city: string; state: string; line1: string };
  total_weight: string;
  status: string;
  metadata: any;
}

export default function DriverDashboard() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ active: 0, completed: 0, earnings: 0 });
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      loadShipments();
    }
  }, [user]);

  const loadShipments = async () => {
    try {
      if (!user?.id) return;
      const response = await apiClient.listShipments(Number(user.id), { role: 'driver', limit: 10 });
      const data = response.data?.shipments || [];
      setShipments(data);
      
      // Calculate stats      
      const active = data.filter((s: any) => s.status !== 'delivered').length || 0;
      const completed = data.filter((s: any) => s.status === 'delivered').length || 0;
      
      setStats({
        active,
        completed,
        earnings: completed * 5000, // Demo calculation
      });
    } catch (err) {
      console.error('Error loading shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Active Deliveries', value: stats.active, icon: Package, color: 'bg-blue-100 text-blue-600' },
    { label: 'Completed', value: stats.completed, icon: MapPin, color: 'bg-green-100 text-green-600' },
    { label: 'Total Earnings', value: `₦${stats.earnings.toLocaleString()}`, icon: TrendingUp, color: 'bg-purple-100 text-purple-600' },
  ];

  return (
    <DashboardLayout role="driver">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome Driver!</h1>
          <p className="text-gray-600 mt-2">Manage your deliveries and earnings</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statCards.map((stat) => {
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

        {/* Active Deliveries */}
        <Card title="Your Deliveries" description="Manage your assigned shipments">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader />
            </div>
          ) : shipments.length > 0 ? (
            <div className="space-y-3">
              {shipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {shipment.pickup_address?.city} → {shipment.delivery_address?.city}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{shipment.delivery_address?.line1}</p>
                    </div>
                    <Badge
                      variant={
                        shipment.status === 'delivered'
                          ? 'success'
                        : shipment.status === 'in_transit'
                          ? 'info'
                          : 'warning'
                      }
                    >
                      {shipment.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-600">Weight</p>
                      <p className="font-medium text-gray-900">{shipment.total_weight} kg</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Est. Delivery</p>
                      <p className="font-medium text-gray-900">{shipment.metadata?.carrier_details?.delivery_eta || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          // Handle update status
                          alert('Update status modal coming soon!');
                        }}
                      >
                        Update Status
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No deliveries assigned yet</p>
              <p className="text-sm text-gray-500 mt-2">Check back soon for new deliveries!</p>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
