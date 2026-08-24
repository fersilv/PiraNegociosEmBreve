import type { Key } from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: Key | null;
    }
  }
}
