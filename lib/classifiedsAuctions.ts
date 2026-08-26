import { useEffect, useState } from 'react';
import { api } from './api';

export type PublicClassifiedAuction = {
  id: string;
  listingId: string;
  companyId?: string | null;
  status: string;
  title: string;
  slug: string;
  description?: string | null;
  listingPrice?: number | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  condition?: string | null;
  sellerVerifiedSnapshot?: boolean;
  companyName?: string | null;
  companyLogo?: string | null;
  image?: string | null;
  startPrice: number;
  minIncrement: number;
  currentBid?: number | null;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  closedAt?: string | null;
  finalAmount?: number | null;
  nextMinimum: number;
  live: boolean;
  bids?: Array<{ id: string; amount: number; createdAt: string; bidderName: string }>;
  settlement?: { mode: 'DIRECT'; protectedPayment: false; message: string };
};

let cache: { at: number; rows: PublicClassifiedAuction[] } | null = null;
let inFlight: Promise<PublicClassifiedAuction[]> | null = null;
const TTL_MS = 20_000;

export async function loadPublicAuctions(force = false) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  if (!force && inFlight) return inFlight;
  inFlight = api.get('/classifieds/public/auctions')
    .then((response) => {
      const rows = Array.isArray(response.data) ? response.data as PublicClassifiedAuction[] : [];
      cache = { at: Date.now(), rows };
      return rows;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

export async function loadPublicAuctionDetail(id: string) {
  const response = await api.get(`/classifieds/public/auctions/${encodeURIComponent(id)}`);
  return response.data as PublicClassifiedAuction;
}

export function invalidatePublicAuctions() {
  cache = null;
}

export function useLiveAuctionForListing(listingId?: string | null) {
  const [auction, setAuction] = useState<PublicClassifiedAuction | null>(() => {
    if (!listingId || !cache) return null;
    return cache.rows.find((row) => row.listingId === listingId && row.live) || null;
  });

  useEffect(() => {
    let active = true;
    if (!listingId) { setAuction(null); return; }
    void loadPublicAuctions()
      .then((rows) => {
        if (active) setAuction(rows.find((row) => row.listingId === listingId && row.live) || null);
      })
      .catch(() => active && setAuction(null));
    return () => { active = false; };
  }, [listingId]);

  return auction;
}

export function auctionCurrentValue(auction: PublicClassifiedAuction) {
  return auction.currentBid == null ? Number(auction.startPrice || 0) : Number(auction.currentBid || 0);
}
