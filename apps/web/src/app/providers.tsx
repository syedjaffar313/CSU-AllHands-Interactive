'use client';

import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <FluentProvider theme={webLightTheme} style={{ minHeight: '100vh' }}>
      {children}
    </FluentProvider>
  );
}
