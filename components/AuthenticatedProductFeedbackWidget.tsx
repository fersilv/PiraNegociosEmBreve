import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ProductFeedbackWidget = lazy(() => import('./ProductFeedbackWidget').then((module) => ({ default: module.ProductFeedbackWidget })));

export function AuthenticatedProductFeedbackWidget() {
  const { user, loading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading || !user) {
      setReady(false);
      return;
    }
    const timer = window.setTimeout(() => setReady(true), 2500);
    return () => window.clearTimeout(timer);
  }, [loading, user?.uid]);

  if (loading || !user || !ready) return null;
  return <Suspense fallback={null}><ProductFeedbackWidget /></Suspense>;
}
