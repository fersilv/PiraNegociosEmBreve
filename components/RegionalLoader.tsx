import React from "react";
import {
  BriefcaseBusiness,
  Building2,
  CarFront,
  Home,
  MapPin,
  Store,
  Tag,
} from "lucide-react";

type RegionalLoaderContext =
  | "jobs"
  | "classifieds"
  | "companies"
  | "dashboard"
  | "auth"
  | "default";

type RegionalLoaderProps = {
  context?: RegionalLoaderContext;
  label?: string;
  compact?: boolean;
  className?: string;
};

const contextLabels: Record<RegionalLoaderContext, string> = {
  jobs: "Buscando oportunidades na região...",
  classifieds: "Organizando os classificados...",
  companies: "Conectando empresas e talentos...",
  dashboard: "Preparando seu painel regional...",
  auth: "Verificando seu acesso...",
  default: "Conectando oportunidades locais...",
};

const iconClasses = [
  "pn-loader-icon pn-loader-icon-1",
  "pn-loader-icon pn-loader-icon-2",
  "pn-loader-icon pn-loader-icon-3",
  "pn-loader-icon pn-loader-icon-4",
  "pn-loader-icon pn-loader-icon-5",
  "pn-loader-icon pn-loader-icon-6",
];

export function RegionalLoader({
  context = "default",
  label,
  compact = false,
  className = "",
}: RegionalLoaderProps) {
  const message = label || contextLabels[context];
  const sizeClass = compact ? "min-h-40" : "min-h-[55vh]";

  return (
    <div className={`flex ${sizeClass} items-center justify-center px-4 ${className}`}>
      <style>{`
        @keyframes pnLoaderOrbit {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pnLoaderPulse {
          0%, 100% { transform: scale(.94); opacity: .72; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes pnLoaderSwap {
          0%, 12% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
          17%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(.74) rotate(10deg); }
        }
        @keyframes pnLoaderLine {
          0%, 100% { opacity: .25; transform: scaleX(.72); }
          50% { opacity: .68; transform: scaleX(1); }
        }
        .pn-loader-icon { animation: pnLoaderSwap 7.2s ease-in-out infinite; }
        .pn-loader-icon-1 { animation-delay: 0s; }
        .pn-loader-icon-2 { animation-delay: 1.2s; }
        .pn-loader-icon-3 { animation-delay: 2.4s; }
        .pn-loader-icon-4 { animation-delay: 3.6s; }
        .pn-loader-icon-5 { animation-delay: 4.8s; }
        .pn-loader-icon-6 { animation-delay: 6s; }
      `}</style>

      <div className="text-center">
        <div className="relative mx-auto h-28 w-28">
          <div className="absolute inset-0 rounded-full bg-[#fff7f0] shadow-[0_18px_60px_rgba(102,38,27,.12)] ring-1 ring-[#e9d8ca]" />
          <div
            className="absolute inset-3 rounded-full border border-dashed border-[#c66a4b]/45"
            style={{ animation: "pnLoaderOrbit 8s linear infinite" }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#66261b] shadow-[0_12px_28px_rgba(102,38,27,.24)]"
            style={{ animation: "pnLoaderPulse 1.8s ease-in-out infinite" }}
          />
          <div className="absolute left-1/2 top-1/2 text-white">
            <BriefcaseBusiness className={iconClasses[0]} />
            <Home className={iconClasses[1]} />
            <CarFront className={iconClasses[2]} />
            <Building2 className={iconClasses[3]} />
            <Store className={iconClasses[4]} />
            <Tag className={iconClasses[5]} />
          </div>
          <MapPin className="absolute -right-1 top-8 h-5 w-5 text-[#c66a4b]" />
          <span className="absolute bottom-8 left-2 h-2 w-2 rounded-full bg-[#c66a4b]" />
          <span className="absolute right-5 top-3 h-2.5 w-2.5 rounded-full bg-[#f2b176]" />
          <span className="absolute bottom-3 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#8e6d5a]" />
        </div>

        <div className="mx-auto mt-5 h-1.5 w-44 overflow-hidden rounded-full bg-[#eadfd7]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#66261b] via-[#c66a4b] to-[#e7a15d]"
            style={{
              animation: "pnLoaderLine 1.6s ease-in-out infinite",
              transformOrigin: "center",
            }}
          />
        </div>
        <p className="mt-4 text-sm font-black text-[#66261b]">{message}</p>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b06448]">
          PiraNegócios
        </p>
      </div>
    </div>
  );
}
