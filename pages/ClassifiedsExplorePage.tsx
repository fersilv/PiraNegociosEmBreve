import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ClassifiedListingQuestions } from '../components/classifieds/ClassifiedListingQuestions';
import { api } from '../lib/api';
import ClassifiedsExplorePageV3 from './ClassifiedsExplorePageV3';

export default function ClassifiedsExplorePage() {
  const { listingSlug } = useParams();
  const [listing, setListing] = useState<{ id: string; companyId?: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    if (!listingSlug) {
      setListing(null);
      return () => { active = false; };
    }
    api.get(`/classifieds/listings/${encodeURIComponent(listingSlug)}`)
      .then((response) => {
        if (!active) return;
        setListing(response.data?.id ? { id: response.data.id, companyId: response.data.companyId || null } : null);
      })
      .catch(() => { if (active) setListing(null); });
    return () => { active = false; };
  }, [listingSlug]);

  return <>
    <ClassifiedsExplorePageV3 />
    {listingSlug && listing?.companyId && <div className="mx-auto max-w-6xl"><ClassifiedListingQuestions listingId={listing.id} companyListing /></div>}
  </>;
}
