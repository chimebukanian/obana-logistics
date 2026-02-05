'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/authContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input, Card, Alert } from '@/components/ui';
import { Lock } from 'lucide-react';

export default function OtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifyOtp, error, clearError, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(300); // 5 minutes

  const requestId = searchParams.get('request_id');

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(timer - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join('');
    
    if (otpString.length !== 4) {
      clearError();
      return;
    }

    clearError();
    setLoading(true);

    try {
      const response = await verifyOtp(requestId || '', otpString);
      
      // Get user role from the auth store (set by verifyOtp)
      // or from response if available
      const userRole = user?.role || response?.data?.user?.role;
      
      if (userRole) {
        const routes: Record<string, string> = {
          customer: '/dashboard/customer',
          driver: '/dashboard/driver',
          admin: '/dashboard/admin',
          agent: '/dashboard/agent',
        };
        router.push(routes[userRole] || '/');
      } else {
        console.warn('No user role found after OTP verification');
        router.push('/');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-600 via-blue-400 to-blue-300 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verify Your Email</h1>
          <p className="text-gray-600 mt-2">Enter the 4-digit code sent to your email</p>
        </div>

        {error && (
          <Alert
            type="error"
            className="mb-6 cursor-pointer"
            onClick={clearError}
          >
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-2 justify-center">
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-12 border-2 border-gray-300 rounded-lg text-center text-2xl font-semibold focus:border-blue-500 focus:outline-none transition-colors"
              />
            ))}
          </div>

          <div className="text-center text-sm text-gray-600">
            Code expires in {minutes}:{seconds.toString().padStart(2, '0')}
          </div>

          <Button type="submit" loading={loading} fullWidth variant="primary" disabled={otp.join('').length !== 4}>
            Verify OTP
          </Button>
        </form>

        <div className="mt-6 border-t border-gray-200 pt-6 text-center">
          <p className="text-gray-600 text-sm">
            Didn't receive the code?{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700 font-semibold">
              Resend
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}
