import React from 'react';
import {
  Baby,
  BriefcaseBusiness,
  Camera,
  Car,
  Dumbbell,
  Ellipsis,
  GraduationCap,
  Hammer,
  House,
  Laptop,
  Package,
  Palette,
  PawPrint,
  Scissors,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  TabletSmartphone,
  Truck,
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
  sparkles: Sparkles,
  hammer: Hammer,
  palette: Palette,
  scissors: Scissors,
  'graduation-cap': GraduationCap,
  camera: Camera,
  truck: Truck,
  ellipsis: Ellipsis,
  package: Package,
};

export function ClassifiedCategoryIcon({ name, className = 'h-6 w-6' }: { name?: string | null; className?: string }) {
  const Icon = ICONS[String(name || '').toLowerCase()] || Package;
  return <Icon className={className} />;
}
