import React, { Suspense, lazy } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ProductFeedbackWidget = lazy(() => import('./ProductFeedbackWidget').then((module) => ({ default: module.ProductFeedbackWidget })));

export function AuthenticatedProductFeedbackWidget() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <Suspense fallback={null}><ProductFeedbackWidget /></Suspense>;
}
