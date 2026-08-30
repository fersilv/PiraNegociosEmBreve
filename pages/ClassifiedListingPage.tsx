import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ClassifiedListingQuestions } from '../components/classifieds/ClassifiedListingQuestions';
import { api } from '../lib/api';
import ClassifiedListingPageV2 from './ClassifiedListingPageV2';

export default function ClassifiedListingPage() {
  const { slug } = useParams();
  const [listing, setListing] = useState<{ id: string; companyId?: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    if (!slug) return () => { active = false; };
    api.get(`/classifieds/listings/${encodeURIComponent(slug)}`)
      .then((response) => {
        if (!active) return;
        setListing(response.data?.id ? { id: response.data.id, companyId: response.data.companyId || null } : null);
      })
      .catch(() => { if (active) setListing(null); });
    return () => { active = false; };
  }, [slug]);

  return <>
    <ClassifiedListingPageV2 />
    {listing?.companyId && <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8"><ClassifiedListingQuestions listingId={listing.id} companyListing /></div>}
  </>;
}
