import React from 'react';
import { useSearchParams } from 'react-router-dom';
import AuctionAccessPage from './AuctionAccessPage';
import { Login as LoginV2 } from './LoginV2';

export function Login() {
  const [searchParams] = useSearchParams();
  if (searchParams.get('intent') === 'auction') return <AuctionAccessPage />;
  return <LoginV2 />;
}
