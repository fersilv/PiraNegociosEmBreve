import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { VisitorLocationHint } from "../lib/locationPersonalization";

export type VisitorLocationStatus =
  | "idle"
  | "requesting"
  | "browser"
  | "fallback"
  | "denied"
  | "unsupported"
  | "error";

type UseVisitorLocationOptions = {
  autoRequest?: boolean;
};

export function useVisitorLocation({ autoRequest = true }: UseVisitorLocationOptions = {}) {
  const [location, setLocation] = useState<VisitorLocationHint | null>(null);
  const [status, setStatus] = useState<VisitorLocationStatus>("idle");
  const fallbackRef = useRef<VisitorLocationHint | null>(null);
  const browserResolvedRef = useRef(false);
  const mountedRef = useRef(true);

  const loadFallback = useCallback(async () => {
    try {
      const response = await api.get("/public/location-hint");
      const fallback = response.data as VisitorLocationHint;
      fallbackRef.current = fallback;
      if (!mountedRef.current || browserResolvedRef.current) return fallback;
      setLocation(fallback);
      setStatus((current) => current === "requesting" ? current : "fallback");
      return fallback;
    } catch {
      return null;
    }
  }, []);

  const requestBrowserLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      if (fallbackRef.current) setLocation(fallbackRef.current);
      else void loadFallback();
      return;
    }

    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mountedRef.current) return;
        browserResolvedRef.current = true;
        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
          source: "browser",
        });
        setStatus("browser");
      },
      (error) => {
        if (!mountedRef.current) return;
        const nextStatus: VisitorLocationStatus =
          error.code === error.PERMISSION_DENIED ? "denied" : "error";
        setStatus(nextStatus);
        if (fallbackRef.current) setLocation(fallbackRef.current);
        else void loadFallback();
      },
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 5 * 60 * 1000,
      },
    );
  }, [loadFallback]);

  useEffect(() => {
    mountedRef.current = true;
    void loadFallback();
    if (autoRequest) requestBrowserLocation();
    return () => {
      mountedRef.current = false;
    };
  }, [autoRequest, loadFallback, requestBrowserLocation]);

  return {
    location,
    status,
    requestBrowserLocation,
    usingPreciseLocation: status === "browser",
  };
}
