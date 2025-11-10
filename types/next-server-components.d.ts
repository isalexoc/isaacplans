// Type declarations for Next.js async server components
// This allows TypeScript to recognize async server components as valid JSX

import 'react';

declare module 'react' {
  // Allow Promise-returning components to be used as JSX (Next.js server components)
  namespace JSX {
    interface ElementClass {
      render(): React.ReactNode | Promise<React.ReactNode>;
    }
  }
}

