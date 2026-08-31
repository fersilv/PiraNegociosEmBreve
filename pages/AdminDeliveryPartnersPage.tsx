import React from 'react';
import { AdminDeliveryRuleManager } from '../components/AdminDeliveryRuleManager';
import AdminDeliveryPartnersPageV3 from './AdminDeliveryPartnersPageV3';

export default function AdminDeliveryPartnersPage() {
  return (
    <>
      <AdminDeliveryPartnersPageV3 />
      <AdminDeliveryRuleManager />
    </>
  );
}
