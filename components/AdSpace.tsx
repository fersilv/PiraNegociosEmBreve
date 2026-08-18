import React, { useState, useEffect } from 'react';
import { Megaphone, Globe, Cpu } from 'lucide-react';
import { api, asArray } from '../lib/api';
import { getPrivacyConsent, PRIVACY_CONSENT_EVENT } from '../lib/privacyConsent';

interface AdSpaceProps {
  variant?: 'leaderboard' | 'rectangle' | 'sidebar';
  className?: string;
}

export function AdSpace({ variant = 'leaderboard', className = '' }: AdSpaceProps) {
  const [ad, setAd] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [advertisingAllowed, setAdvertisingAllowed] = useState(() => getPrivacyConsent()?.advertising === true);

  useEffect(() => {
    const syncConsent = () => setAdvertisingAllowed(getPrivacyConsent()?.advertising === true);
    window.addEventListener(PRIVACY_CONSENT_EVENT, syncConsent);
    return () => window.removeEventListener(PRIVACY_CONSENT_EVENT, syncConsent);
  }, []);

  useEffect(() => {
    const fetchAdAndConfig = async () => {
      try {
        // 1. Fetch advertising configurations
        const configRes = await api.get('/configs/advertising').catch(() => null);
        if (configRes?.data) {
          const configData = configRes.data;
          setConfig(configData);

          // If Google Ads is enabled, load Google Adsense script dynamically
          if (configData.googleAdsEnabled && configData.googleAdsClient) {
            // Ads are always eligible to render. Without advertising consent, the
            // request is explicitly contextual/non-personalized (npa=1).
            const adsQueue = ((window as any).adsbygoogle = (window as any).adsbygoogle || []);
            adsQueue.requestNonPersonalizedAds = advertisingAllowed ? 0 : 1;
            const scriptId = 'google-adsense-script';
            if (!document.getElementById(scriptId)) {
              const script = document.createElement('script');
              script.id = scriptId;
              script.async = true;
              script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${configData.googleAdsClient}`;
              script.crossOrigin = 'anonymous';
              document.head.appendChild(script);
            }
          }
        }

        // 2. Fetch custom backup ads
        const adsRes = await api.get('/ads');
        const ads = asArray<any>(adsRes.data).filter(a => a.type === variant && a.active);
        if (ads.length > 0) {
          setAd(ads[Math.floor(Math.random() * ads.length)]);
        }
      } catch (e) {
        console.error("AdSpace load error:", e);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchAdAndConfig();
  }, [variant, advertisingAllowed]);

  useEffect(() => {
    if (config?.googleAdsEnabled) {
      try {
        const adsQueue = ((window as any).adsbygoogle = (window as any).adsbygoogle || []);
        adsQueue.requestNonPersonalizedAds = advertisingAllowed ? 0 : 1;
        adsQueue.push({});
      } catch (e) {
        // Silent catch for initial push before script is fully parsed
      }
    }
  }, [config, variant, advertisingAllowed]);

  const variantClasses = {
    leaderboard: "w-full h-[90px] md:h-[120px]",
    rectangle: "w-full max-w-[300px] aspect-video sm:aspect-square",
    sidebar: "w-full max-w-xs h-96",
  };

  // Determine which Google Ads Slot to use based on variant
  const getGoogleAdSlot = () => {
    if (!config) return '';
    if (variant === 'leaderboard') return config.googleAdsSlotLeaderboard;
    return config.googleAdsSlotRectangle;
  };

  // 1. Render Google Ads if enabled globally
  if (config?.googleAdsEnabled && config?.googleAdsClient) {
    const slotId = getGoogleAdSlot();
    return (
      <div className={`relative overflow-hidden rounded-xl border border-stone-200 bg-amber-50/10 hover:shadow-md transition-shadow ${variantClasses[variant]} ${className}`}>
        {/* Real AdSense Element */}
        <ins 
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '100%' }}
          data-ad-client={config.googleAdsClient}
          data-ad-slot={slotId || '1234567890'}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
        
        {/* Visual Mockup Overlay representing Google Ads setup (essential for sandbox testing & beautiful previewing) */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-gradient-to-r from-amber-500/5 to-amber-600/5">
          <div className="bg-white/90 border border-amber-300 rounded-lg px-3 py-1.5 shadow-xs flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-600 animate-spin" style={{ animationDuration: '4s' }} />
            <div className="text-[10px] text-stone-700 font-bold tracking-tight">
              Google Adsense • <span className="font-mono text-amber-700">{config.googleAdsClient}</span>
            </div>
          </div>
          <span className="text-[9px] text-stone-400 mt-1 uppercase tracking-widest font-mono">Espaço Monetizado</span>
        </div>
      </div>
    );
  }

  // 2. Render Google AdMob indicator if enabled globally for mobile platforms
  if (config?.adMobEnabled && config?.adMobAppId) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-stone-200 bg-sky-50/10 hover:shadow-md transition-shadow ${variantClasses[variant]} ${className}`}>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-sky-500/5 to-sky-600/5">
          <div className="bg-white/95 border border-sky-300 rounded-xl p-3 shadow-xs flex flex-col items-center text-center max-w-[90%]">
            <div className="flex items-center gap-1.5 mb-1">
              <Cpu className="w-4 h-4 text-sky-600 animate-pulse" />
              <span className="text-[10px] text-stone-700 font-bold uppercase tracking-wide">Google AdMob Ativo</span>
            </div>
            <span className="text-[8px] font-mono text-stone-400 block break-all">App ID: {config.adMobAppId}</span>
            <span className="text-[8px] text-sky-700 font-bold mt-1">Renderizado nos Aplicativos Móveis</span>
          </div>
        </div>
      </div>
    );
  }

  // 3. Fallback to custom direct ads
  if (ad) {
    return (
      <a 
        href={ad.link || '#'} 
        target="_blank" 
        rel="noreferrer"
        className={`block relative overflow-hidden rounded-xl shadow-sm border border-stone-200 hover:shadow-md transition-shadow ${variantClasses[variant]} ${className}`}
      >
        <img src={ad.imageURL} alt={ad.title} className="w-full h-full object-cover" />
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded">
          Ad
        </div>
      </a>
    );
  }

  // 4. Fallback to empty state
  const baseClasses = "flex flex-col items-center justify-center bg-stone-100/30 border border-dashed border-terracotta-300 rounded-xl text-terracotta-800/40 relative overflow-hidden group backdrop-blur-sm";

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      <div className="absolute inset-0 bg-terracotta-200/10 group-hover:bg-terracotta-200/20 transition-colors duration-300" />
      <div className="relative z-10 flex flex-col items-center">
        <Megaphone className="w-5 h-5 mb-1.5 opacity-60" />
        <span className="text-[10px] md:text-xs font-bold tracking-widest uppercase">Espaço Publicitário</span>
        {variant === 'leaderboard' ? (
          <span className="text-[9px] mt-1 opacity-50">Leaderboard / Banner Topo (728x90)</span>
        ) : (
          <span className="text-[9px] mt-1 opacity-50">Medium Rectangle (300x250)</span>
        )}
      </div>
    </div>
  );
}
