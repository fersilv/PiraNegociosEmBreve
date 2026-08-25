import React from 'react';
import {
  Baby,
  BriefcaseBusiness,
  Car,
  Dumbbell,
  House,
  Laptop,
  Package,
  PawPrint,
  Shirt,
  Smartphone,
  Sofa,
  TabletSmartphone,
  Wrench,
} from 'lucide-react';

const ICONS: Record<string, React.ElementType> = {
  car: Car,
  house: House,
  smartphone: Smartphone,
  phone: TabletSmartphone,
  laptop: Laptop,
  sofa: Sofa,
  shirt: Shirt,
  baby: Baby,
  dumbbell: Dumbbell,
  wrench: Wrench,
  'paw-print': PawPrint,
  'briefcase-business': BriefcaseBusiness,
  package: Package,
};

export function ClassifiedCategoryIcon({ name, className = 'h-6 w-6' }: { name?: string | null; className?: string }) {
  const Icon = ICONS[String(name || '').toLowerCase()] || Package;
  return <Icon className={className} />;
}
