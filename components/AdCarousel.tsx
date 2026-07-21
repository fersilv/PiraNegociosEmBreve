import React, { useRef, useState, useEffect } from 'react';
import { AdSpace } from './AdSpace';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function AdCarousel() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftNav, setShowLeftNav] = useState(false);
  const [showRightNav, setShowRightNav] = useState(true);
  const [ads, setAds] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchAds = async () => {
      try {
        const q = query(collection(db, 'ads'), where('type', '==', 'carousel'), where('active', '==', true));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setAds(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchAds();
  }, []);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftNav(scrollLeft > 0);
    setShowRightNav(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 320; // roughly card width + gap
    scrollContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const displayAds = ads.length > 0 ? ads : [];
  const renderPlaceholders = displayAds.length === 0;

  return (
    <div className="relative w-full group">
      
      {/* Navigation Buttons (only show when needed and on hover) */}
      {showLeftNav && (
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 z-20 bg-white/80 backdrop-blur text-terracotta-800 p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 hidden md:block"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {showRightNav && (
        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 z-20 bg-white/80 backdrop-blur text-terracotta-800 p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 hidden md:block"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 -mx-4 px-4 md:mx-0 md:px-0"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {renderPlaceholders ? (
          [1, 2, 3, 4].map((_, idx) => (
            <div key={idx} className="snap-center shrink-0 w-[280px] sm:w-[300px]">
              <AdSpace variant="rectangle" className="w-full h-full max-w-none !aspect-auto min-h-[250px]" />
            </div>
          ))
        ) : (
          displayAds.map((ad, idx) => (
            <a 
              key={idx} 
              href={ad.link || '#'}
              target="_blank"
              rel="noreferrer"
              className="snap-center shrink-0 w-[280px] sm:w-[300px] h-[250px] relative overflow-hidden rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow block"
            >
              <img src={ad.imageURL} alt={ad.title} className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded">
                Ad
              </div>
            </a>
          ))
        )}
      </div>
      
      {/* CSS to hide scrollbar for webkit */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
