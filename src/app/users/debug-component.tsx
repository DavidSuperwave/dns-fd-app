"use client";

import React from 'react';

export default function DebugComponent() {
  // Attempt to log available paths and modules
  React.useEffect(() => {
    console.log('====== DEBUG COMPONENT MOUNTED ======');
    console.log('Current location:', window.location.href);
    console.log('Import.meta:', import.meta);
    
    // Show attempted paths - this won't actually work but demonstrates the concept
    const attemptedPaths = [
      '../../components/layout/dashboard-layout',
      '../../../components/layout/dashboard-layout',
      '@/components/layout/dashboard-layout',
      '/components/layout/dashboard-layout'
    ];
    
    console.log('Would attempt to import from these paths:', attemptedPaths);
    
    // Try to detect if we're in the correct directory structure
    console.log('Directory detection:');
    try {
      // This is just to show what would be checked - it can't actually do this at runtime
      console.log('- Would check if /src/components/layout/dashboard-layout.tsx exists');
      console.log('- Would check if /dns-fd-app/src/components/layout/dashboard-layout.tsx exists');
    } catch (err) {
      console.error('Error during path checking:', err);
    }
  }, []);

  return (
    <div className="p-4 border border-red-500 rounded">
      <h2 className="text-xl font-bold">Debug Component</h2>
      <p>This component has been loaded successfully.</p>
      <p>Check console for debugging information.</p>
    </div>
  );
}