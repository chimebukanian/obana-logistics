'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Input, Badge, Loader, Select } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1
  });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    carrier_type: ''
  });

  useEffect(() => {
    loadShipments();
  }, [pagination.page, filters.status, filters.carrier_type]);

  const loadShipments = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getAllShipments({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search,
        status: filters.status === 'all' ? '' : filters.status,
        carrier_type: filters.carrier_type === 'all' ? '' : filters.carrier_type
      });

      if (response.success && response.data) {
        setShipments(response.data.shipments);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error loading shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    loadShipments();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
            <p className="text-gray-600">Manage and track all shipments</p>
          </div>
        </div>

        <Card>
          <div className="p-4 border-b border-gray-200 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <form onSubmit={handleSearch} className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by reference, order ID, or vendor..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </form>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="w-40">
                  <Select
                    options={[
                      { value: 'all', label: 'All Status' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'in_transit', label: 'In Transit' },
                      { value: 'delivered', label: 'Delivered' },
                      { value: 'cancelled', label: 'Cancelled' },
                      { value: 'failed', label: 'Failed' }
                    ]}
                    value={filters.status || 'all'}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, status: e.target.value }));
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                  />
                </div>
                <div className="w-40">
                  <Select
                    options={[
                      { value: 'all', label: 'All Carriers' },
                      { value: 'internal', label: 'Internal' },
                      { value: 'external', label: 'External' }
                    ]}
                    value={filters.carrier_type || 'all'}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, carrier_type: e.target.value }));
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Reference</th>
                      <th className="px-6 py-3">Vendor</th>
                      <th className="px-6 py-3">Route</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.length > 0 ? (
                      shipments.map((shipment) => (
                        <tr key={shipment.id} className="bg-white border-b hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {shipment.shipment_reference}
                            <div className="text-xs text-gray-500">{shipment.carrier_name}</div>
                          </td>
                          <td className="px-6 py-4">
                            {shipment.vendor_name}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span>{shipment.pickup_address?.city}</span>
                              <span className="text-gray-400 text-xs">↓</span>
                              <span>{shipment.delivery_address?.city}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={
                                shipment.status === 'delivered' ? 'success' :
                                shipment.status === 'in_transit' ? 'info' :
                                shipment.status === 'cancelled' || shipment.status === 'failed' ? 'error' :
                                'warning'
                              }
                              className="capitalize"
                            >
                              {shipment.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            {new Date(shipment.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            {new Intl.NumberFormat('en-NG', { style: 'currency', currency: shipment.currency }).format(shipment.shipping_fee)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link href={`/dashboard/admin/shipments/${shipment.shipment_reference}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          No shipments found matching your criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}