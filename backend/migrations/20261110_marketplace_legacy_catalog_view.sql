-- Leitura em tempo real dos anúncios legados e especializados, sem replicar produtos existentes.
CREATE OR REPLACE VIEW marketplace.public_catalog AS
SELECT l.id,l.module_code,l.origin,l.origin_id,l.title,l.description,l.city,l.state,
 l.price_cents,l.currency,l.category,l.capacity,l.media,l.public_metadata,l.destination_url,
 l.updated_at,lc.channel_code,rp.amenities
FROM marketplace.listings l
JOIN marketplace.listing_channels lc ON lc.listing_id=l.id AND lc.enabled=true
JOIN marketplace.channels c ON c.code=lc.channel_code AND c.enabled=true AND c.public_visible=true
LEFT JOIN marketplace.rental_projection rp ON rp.listing_id=l.id
WHERE l.status='PUBLISHED'
UNION ALL
SELECT l.id,'general'::text,'piranegocios'::text,l.id::text,l.title,l.description,
 l.city,l.state,CASE WHEN l.price IS NOT NULL THEN ROUND(l.price*100)::bigint ELSE NULL END,
 'BRL'::bpchar,l."categorySlug"::text,NULL::int,
 COALESCE((SELECT jsonb_agg(i.url ORDER BY i."isPrimary" DESC,i."sortOrder") FROM classified_listing_images i WHERE i."listingId"=l.id),'[]'::jsonb),
 jsonb_build_object('listingType',l."listingType",'condition',l.condition),
 'https://piranegocios.com.br/classificados/anuncio/'||l.slug,
 l."updatedAt",'piranegocios'::text,NULL::text[]
FROM classified_listings l
WHERE l.status='PUBLISHED' AND l."publicationChannels" @> '["CLASSIFIEDS"]'::jsonb;
