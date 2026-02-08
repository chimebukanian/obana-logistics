'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/navigation';
import { Menu, X, LogOut, Home, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: 'customer' | 'driver' | 'admin' | 'agent';
}

const navigationByRole = {
  customer: [
    { name: 'Dashboard', href: '/dashboard/customer', icon: Home },
    { name: 'Create Shipment', href: '/dashboard/customer/shipments/new', icon: Home },
    { name: 'My Shipments', href: '/dashboard/customer/shipments', icon: Home },
    { name: 'Tracking', href: '/dashboard/customer/tracking', icon: Home },
    { name: 'Profile', href: '/dashboard/customer/profile', icon: Settings },
  ],
  driver: [
    { name: 'Dashboard', href: '/dashboard/driver', icon: Home },
    { name: 'Available Jobs', href: '/dashboard/driver/jobs', icon: Home },
    { name: 'My Deliveries', href: '/dashboard/driver/deliveries', icon: Home },
    { name: 'Earnings', href: '/dashboard/driver/earnings', icon: Home },
    { name: 'Profile', href: '/dashboard/driver/profile', icon: Settings },
  ],
  admin: [
    { name: 'Dashboard', href: '/dashboard/admin', icon: Home },
    { name: 'Route Templates', href: '/dashboard/admin/routes', icon: Home },
    { name: 'Users', href: '/dashboard/admin/users', icon: Users },
    { name: 'Drivers', href: '/dashboard/admin/drivers', icon: Home },
    { name: 'Shipments', href: '/dashboard/admin/shipments', icon: Home },
    { name: 'Analytics', href: '/dashboard/admin/analytics', icon: Home },
    { name: 'Settings', href: '/dashboard/admin/settings', icon: Settings },
  ],
  agent: [
    { name: 'Dashboard', href: '/dashboard/agent', icon: Home },
    { name: 'Orders', href: '/dashboard/agent/orders', icon: Home },
    { name: 'Shipments', href: '/dashboard/agent/shipments', icon: Home },
    { name: 'Profile', href: '/dashboard/agent/profile', icon: Settings },
  ],
};

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const person = useAuthStore(state => state.getUser())
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const navItems = navigationByRole[role];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transition-transform duration-300 lg:static lg:translate-x-0`}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold">
              <Link
                href={'/'}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
            Obana Logistics
            </Link>
            </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="mt-8 space-y-2 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800 space-y-2">
          <div className="px-4 py-2 bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-400">Logged in as</p>
            <p className="text-sm font-semibold text-white truncate">{person?.email || person?.attributes?.first_name}</p>
            
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between p-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-600 hover:text-gray-900"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900 hidden lg:block">
              {/* {navigationByRole[role].find(item => item.href === typeof window !== 'undefined' ? window.location.pathname : '')?.name || 'Dashboard'} */}
              {navItems.find(item => item.href === (typeof window !== 'undefined' ? window.location.pathname : ''))?.name || 'Dashboard'}
              


            </h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user?.first_name} {user?.last_name}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
