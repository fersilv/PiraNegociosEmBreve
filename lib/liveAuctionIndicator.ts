import { useEffect, useState } from 'react';
import { loadPublicAuctions } from './classifiedsAuctions';

export function useLiveAuctionIndicator() {
  const [live, setLive] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async (force = false) => {
      try {
        const rows = await loadPublicAuctions(force);
        if (active) setLive(rows.some((row) => row.live && row.status === 'OPEN'));
      } catch {
        // Falha da badge nunca deve derrubar a navbar.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(true), 15_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(true); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  return live;
}
