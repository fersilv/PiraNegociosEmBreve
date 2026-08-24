import 'react/jsx-runtime';
import 'react/jsx-dev-runtime';

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: string | number | bigint | null;
    }
  }
}

declare module 'react/jsx-dev-runtime' {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: string | number | bigint | null;
    }
  }
}
