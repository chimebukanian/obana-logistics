

import React, { Suspense } from 'react';
import OtpContent from '@/components/OtpContent';

export default function OtpPage() {
  return (
   
    <Suspense fallback={<div className="flex justify-center p-8">Loading...</div>}>
      <OtpContent />
    </Suspense>
  );
}