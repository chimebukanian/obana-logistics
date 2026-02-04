'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { ArrowRight, Zap, Shield, Smartphone } from 'lucide-react';

export default function Home() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Redirect to appropriate dashboard based on role
      const dashboards: Record<string, string> = {
        customer: '/dashboard/customer',
        driver: '/dashboard/driver',
        admin: '/dashboard/admin',
        agent: '/dashboard/agent',
      };
      router.push(dashboards[user.role] || '/');
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-600 via-blue-400 to-blue-300">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-600">Obana</h1>
          <div className="space-x-4">
            <Link href="/auth/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button variant="primary">Sign Up</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-white text-center mb-16">
          <h2 className="text-5xl font-bold mb-6">
            Logistics Made <span className="text-white drop-shadow-lg">Simple</span>
          </h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto mb-8">
            The modern platform for shipping, tracking, and managing deliveries across Nigeria and beyond.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" variant="primary" className=" hover:bg-gray-100 hover:text-blue-600">
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-white/50">
              Learn More
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white rounded-lg p-8 shadow-xl">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Lightning Fast</h3>
            <p className="text-gray-600">
              Get real-time pricing and delivery estimates before creating shipments
            </p>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-xl">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Secure & Reliable</h3>
            <p className="text-gray-600">
              Track your shipments in real-time with guaranteed delivery updates
            </p>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-xl">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Smartphone className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Mobile Ready</h3>
            <p className="text-gray-600">
              Manage shipments and deliveries from anywhere, anytime
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-white rounded-lg p-12 shadow-2xl mt-20 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to streamline your logistics?</h3>
          <p className="text-gray-600 mb-6">
            Join thousands of businesses using Obana to manage their shipments efficiently.
          </p>
          <Link href="/auth/signup">
            <Button size="lg" variant="primary">
              Start Free Today
            </Button>
          </Link>
        </div>

        {/* Testing Links Section */}
        <div className="bg-white rounded-lg p-12 shadow-2xl mt-20">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">🧪 Testing Links</h3>
          
          {/* Auth Pages */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Authentication</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <Link href="/auth/signup">
                <Button variant="secondary" fullWidth>Sign Up</Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="secondary" fullWidth>Login</Button>
              </Link>
              <Link href="/auth/otp">
                <Button variant="secondary" fullWidth>OTP Verification</Button>
              </Link>
            </div>
          </div>

          {/* Customer Dashboard */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Customer Dashboard</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <Link href="/dashboard/customer">
                <Button variant="secondary" fullWidth>Overview</Button>
              </Link>
              <Link href="/dashboard/customer/shipments/new">
                <Button variant="secondary" fullWidth>Create Shipment</Button>
              </Link>
              <Link href="/dashboard/customer/shipments">
                <Button variant="secondary" fullWidth>My Shipments</Button>
              </Link>
              <Link href="/dashboard/customer/profile">
                <Button variant="secondary" fullWidth>Profile</Button>
              </Link>
            </div>
          </div>

          {/* Admin Dashboard */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Admin Dashboard</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <Link href="/dashboard/admin">
                <Button variant="secondary" fullWidth>Overview</Button>
              </Link>
              <Link href="/dashboard/admin/routes">
                <Button variant="secondary" fullWidth>Route Templates</Button>
              </Link>
              <Link href="/dashboard/admin/drivers">
                <Button variant="secondary" fullWidth>Drivers</Button>
              </Link>
              <Link href="/dashboard/admin/shipments">
                <Button variant="secondary" fullWidth>Shipments</Button>
              </Link>
            </div>
          </div>

          {/* Driver & Agent Dashboards */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Other Dashboards</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <Link href="/dashboard/driver">
                <Button variant="secondary" fullWidth>Driver Dashboard</Button>
              </Link>
              <Link href="/dashboard/agent">
                <Button variant="secondary" fullWidth>Agent Dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-gray-400">&copy; 2026 Obana Logistics. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
