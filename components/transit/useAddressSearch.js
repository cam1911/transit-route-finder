"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = { lat: 32.7767, lng: -96.797 };
const AUTOCOMPLETE_DELAY_MS = 300;
const TRANSIENT_RETRY_DELAY_MS = 400;

function isTransientGoogleError(error) {
  return /unknown_error|network|temporar|unavailable|\b5\d\d\b/i.test(error?.message || "");
}

export function googleErrorMessage(error, fallback) {
  const message = error?.message || "";
  if (/quota|resource_exhausted|over_query_limit|rate.?limit/i.test(message)) {
    return "Google Maps is temporarily at its request limit. Please wait and try again.";
  }
  if (/api.?key|auth|denied|not authorized|referer/i.test(message)) {
    return "Google Maps could not authorize this site. Check the configured browser key.";
  }
  if (/network|failed to fetch|offline/i.test(message)) {
    return "Google Maps could not be reached. Check your connection and try again.";
  }
  return fallback;
}

async function withTransientRetry(operation) {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientGoogleError(error)) throw error;
    await new Promise((resolve) => window.setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS));
    return operation();
  }
}

export function useAddressSearch({ placesLibrary, mapsReady, location, setError }) {
  const sessionRef = useRef(null);
  const requestRef = useRef(0);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  function resetSession() {
    sessionRef.current = null;
    requestRef.current += 1;
    setSuggestions([]);
    setSuggestionsOpen(false);
  }

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!mapsReady || normalizedQuery.length < 3 || location?.title === normalizedQuery) {
      requestRef.current += 1;
      setSuggestions([]);
      if (!normalizedQuery) sessionRef.current = null;
      return undefined;
    }

    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      try {
        if (!sessionRef.current) sessionRef.current = new placesLibrary.AutocompleteSessionToken();
        const result = await withTransientRetry(() =>
          placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: normalizedQuery,
            includedRegionCodes: ["us"],
            language: "en-US",
            region: "us",
            locationBias: { center: location?.position || DEFAULT_CENTER, radius: 50000 },
            sessionToken: sessionRef.current,
          }),
        );
        if (requestId !== requestRef.current) return;
        setSuggestions(result.suggestions.slice(0, 5));
        setSuggestionsOpen(true);
        setError(result.suggestions.length ? null : "No matching Dallas-area places found.");
      } catch (requestError) {
        if (requestId !== requestRef.current) return;
        setSuggestions([]);
        setError(googleErrorMessage(requestError, "Address suggestions are temporarily unavailable."));
      }
    }, AUTOCOMPLETE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [location, mapsReady, placesLibrary, query, setError]);

  async function resolveSuggestion(suggestion) {
    const prediction = suggestion.placePrediction;
    const place = prediction.toPlace();
    await withTransientRetry(() => place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] }));
    resetSession();
    return { place, fallback: prediction.text.toString() };
  }

  async function searchText() {
    const normalizedQuery = query.trim();
    resetSession();
    const result = await withTransientRetry(() =>
      placesLibrary.Place.searchByText({
        textQuery: normalizedQuery,
        fields: ["displayName", "formattedAddress", "location"],
        locationBias: { center: DEFAULT_CENTER, radius: 50000 },
        maxResultCount: 1,
      }),
    );
    return { place: result.places?.[0], fallback: normalizedQuery };
  }

  return {
    query,
    setQuery,
    suggestions,
    suggestionsOpen,
    setSuggestionsOpen,
    resetSession,
    resolveSuggestion,
    searchText,
  };
}
