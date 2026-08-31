import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, BadgeDollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Job } from "../types/job";
import type { ClassifiedListing } from "../types/classifieds";
import { JobCard } from "./JobCard";
import { ClassifiedListingCard } from "./classifieds/ClassifiedListingCard";

type ActiveAd = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  link?: string | null;
  buttonText?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
};

type FeedPromotion =
  | { kind: "classified"; listing: ClassifiedListing }
  | { kind: "job"; job: Job };

type FeedMonetizationSlotProps = {
  placement: string;
  slot: number;
  className?: string;
  promotion?: FeedPromotion | null;
};

let activeAdsPromise: Promise<ActiveAd[]> | null = null;

function loadActiveAds() {
  if (!activeAdsPromise) {
    activeAdsPromise = api.get("/ads/active")
      .then((response) => Array.isArray(response.data) ? response.data as ActiveAd[] : [])
      .catch(() => []);
  }
  return activeAdsPromise;
}

function hashPlacement(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function FeedMonetizationSlot({
  placement,
  slot,
  className = "",
  promotion = null,
}: FeedMonetizationSlotProps) {
  const navigate = useNavigate();
  const [ads, setAds] = useState<ActiveAd[]>([]);
  const impressionSent = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (promotion) return;
    let active = true;
    void loadActiveAds().then((rows) => {
      if (active) setAds(rows);
    });
    return () => {
      active = false;
    };
  }, [promotion]);

  const ad = useMemo(() => {
    if (!ads.length) return null;
    const index = (hashPlacement(placement) + slot) % ads.length;
    return ads[index] || null;
  }, [ads, placement, slot]);

  useEffect(() => {
    if (!ad || impressionSent.current || !containerRef.current) return;
    const element = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.45)) return;
        impressionSent.current = true;
        void api.post(`/ads/${ad.id}/impression`, { placement, slot }).catch(() => undefined);
        observer.disconnect();
      },
      { threshold: [0.45] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ad, placement, slot]);

  if (promotion?.kind === "classified") {
    return (
      <div className={className} data-feed-placement={placement} data-promotion-kind="classified">
        <div className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.16em] text-[#a75a40]">
          <BadgeDollarSign className="h-3.5 w-3.5" /> Impulsionado
        </div>
        <ClassifiedListingCard listing={promotion.listing} />
      </div>
    );
  }

  if (promotion?.kind === "job") {
    const job = promotion.job;
    return (
      <div className={className} data-feed-placement={placement} data-promotion-kind="job">
        <div className="mb-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.16em] text-[#a75a40]">
          <BadgeDollarSign className="h-3.5 w-3.5" /> Impulsionado
        </div>
        <JobCard
          job={{ ...job, isSponsored: true }}
          onClick={() => job.slug ? navigate(`/vagas/${job.slug}`) : navigate(`/vagas?q=${encodeURIComponent(job.title)}`)}
        />
      </div>
    );
  }

  if (!ad) return null;

  const textColor = ad.textColor || "#2d211c";
  const backgroundColor = ad.backgroundColor || "#fff7f1";

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded-[24px] border border-[#4b3328]/10 shadow-[0_12px_35px_rgba(62,43,34,.06)] ${className}`}
      style={{ backgroundColor, color: textColor }}
      data-feed-placement={placement}
      data-promotion-kind="ad"
    >
      <a
        href={ad.link || undefined}
        target={ad.link?.startsWith("http") ? "_blank" : undefined}
        rel={ad.link?.startsWith("http") ? "noopener noreferrer sponsored" : undefined}
        onClick={() => void api.post(`/ads/${ad.id}/click`, { placement, slot }).catch(() => undefined)}
        className="group grid min-h-[150px] grid-cols-[1fr_auto] items-stretch"
      >
        <div className="flex min-w-0 flex-col justify-center p-5 sm:p-6">
          <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-current/10 bg-white/20 px-2.5 py-1 text-[8px] font-black uppercase tracking-[.17em] opacity-65">
            Publicidade
          </span>
          <h3 className="font-serif text-xl font-black leading-tight sm:text-2xl">{ad.title}</h3>
          {ad.description && <p className="mt-2 line-clamp-2 max-w-2xl text-xs font-semibold leading-5 opacity-65 sm:text-sm">{ad.description}</p>}
          <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-black">
            {ad.buttonText || "Saiba mais"} <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
        {ad.imageUrl && (
          <div className="hidden w-48 overflow-hidden sm:block lg:w-56">
            <img src={ad.imageUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
          </div>
        )}
      </a>
    </div>
  );
}

export function shouldInsertFeedMonetizationSlot(index: number, offset = 4, interval = 8) {
  if (index < offset) return false;
  return (index - offset) % interval === 0;
}
