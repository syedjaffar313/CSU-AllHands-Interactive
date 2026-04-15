'use client';

import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { useState, useEffect, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Return a shell during SSR / static export to avoid Griffel hydration mismatch
    return <div style={{ minHeight: '100vh' }} />;
  }

  return (
    <FluentProvider theme={webLightTheme} style={{ minHeight: '100vh' }}>
      {children}
    </FluentProvider>
  );
}
