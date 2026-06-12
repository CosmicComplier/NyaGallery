"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fileUrl, readToken } from "@/lib/api";

export function useRandomPreview(query: string) {
  const [showRandom, setShowRandom] = useState(false);
  const [randomBlobUrl, setRandomBlobUrl] = useState<string | null>(null);
  const [randomAssetKey, setRandomAssetKey] = useState<string | null>(null);
  const [randomLoaded, setRandomLoaded] = useState(false);
  const [randomError, setRandomError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    blobUrlRef.current = randomBlobUrl;
  }, [randomBlobUrl]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const handleRandom = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const base = fileUrl.randomPreview(query || undefined);
    const url = `${base}${base.includes("?") ? "&" : "?"}_=${Date.now()}`;

    setShowRandom(true);
    setRandomLoaded(false);
    setRandomError(false);
    setRandomAssetKey(null);

    try {
      const token = readToken();
      const response = await fetch(url, {
        signal: controller.signal,
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = blobUrl;
      setRandomBlobUrl(blobUrl);
      setRandomAssetKey(response.headers.get("X-Asset-Key"));
      setRandomLoaded(true);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setRandomError(true);
    }
  }, [query]);

  return {
    showRandom,
    setShowRandom,
    randomBlobUrl,
    randomAssetKey,
    randomLoaded,
    randomError,
    handleRandom,
  };
}
