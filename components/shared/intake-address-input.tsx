"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { Input } from "@/components/ui/input";
import {
  logFePlaces,
  readPlacePredictionFromGmpSelectEvent,
  inspectGmpSelectEvent,
} from "@/lib/fe-get-covered-places";

export type ResolvedAddress = {
  line1: string;
  city: string;
  state: string;
  zip: string;
  /**
   * County name as Google reports it (e.g. "Miami-Dade County"). Empty when Places does not
   * return `administrative_area_level_2`. ACA needs this because rating areas are county-level
   * and a single ZIP can straddle two counties; IUL ignores it.
   */
  county: string;
  /** Full single-line address (street, city, state zip) for fields that store the whole thing. */
  formatted: string;
};

type GoogleAddressComponent = {
  types: string[];
  longText?: string;
  shortText?: string;
};

/** Parse `Place.addressComponents` (new Places `Place` class) into our flat shape. */
function parsePlaceComponents(components: GoogleAddressComponent[] | undefined): ResolvedAddress | null {
  if (!components?.length) return null;
  const getPart = (type: string, pick: "longText" | "shortText" = "longText") => {
    const c = components.find((x) => x.types?.includes(type));
    if (!c) return "";
    const v = pick === "shortText" ? c.shortText : c.longText;
    return (v ?? "").trim();
  };
  const streetNumber = getPart("street_number");
  const route = getPart("route");
  const locality =
    getPart("locality") || getPart("postal_town") || getPart("administrative_area_level_3");
  const stateShort = getPart("administrative_area_level_1", "shortText");
  const county = getPart("administrative_area_level_2");
  const zip = getPart("postal_code");
  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();
  if (!line1) return null;
  const state = stateShort ? stateShort.toUpperCase() : "";
  const formatted = [line1, locality, [state, zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return { line1, city: locality, state, zip, county, formatted };
}

/**
 * Google Places street-address autocomplete, reusing the proven /final-expense/get-covered
 * approach. Loads the Maps script once (deduped by id), mounts a `PlaceAutocompleteElement`,
 * and degrades to a plain text input if Maps is unavailable so the field is always usable.
 *
 * Shared by the IUL and ACA intake forms.
 */
export default function IntakeAddressInput({
  id,
  value,
  onChange,
  onResolve,
  placeholder,
  invalid,
  locale,
  fullAddress,
  className,
  fontSize,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onResolve: (addr: ResolvedAddress) => void;
  placeholder?: string;
  invalid?: boolean;
  locale: "en" | "es";
  /** Display the whole formatted address in the input after selection (not just the street). */
  fullAddress?: boolean;
  /**
   * Replaces the default wrapper geometry, so a form with its own visual language can make this
   * match its other fields. Omit it and every existing caller keeps today's shadcn sizing.
   */
  className?: string;
  /**
   * Font size for the Google element itself, e.g. "1.125rem".
   *
   * Needed separately from `className` because `PlaceAutocompleteElement` is a web component with
   * its own shadow DOM — a Tailwind `text-lg` on the wrapper does not cascade into it, so the
   * inner input would keep rendering at the browser default while its neighbours grew.
   */
  fontSize?: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Keep the latest callbacks/value without forcing the mount effect to re-run.
  const onChangeRef = useRef(onChange);
  const onResolveRef = useRef(onResolve);
  const valueRef = useRef(value);
  const fullAddressRef = useRef(fullAddress);
  const fontSizeRef = useRef(fontSize);
  onChangeRef.current = onChange;
  onResolveRef.current = onResolve;
  valueRef.current = value;
  fullAddressRef.current = fullAddress;
  fontSizeRef.current = fontSize;

  // `importLibrary` is the real readiness signal (the <Script> onLoad can fire too early).
  useEffect(() => {
    if (!apiKey || typeof window === "undefined") return;
    if (ready || failed) return;
    let attempts = 0;
    const gWin = window as unknown as { google?: { maps?: { importLibrary?: unknown } } };
    if (gWin.google?.maps?.importLibrary) {
      setReady(true);
      return;
    }
    const interval = window.setInterval(() => {
      attempts += 1;
      if (gWin.google?.maps?.importLibrary) {
        setReady(true);
        window.clearInterval(interval);
      } else if (attempts >= 200) {
        window.clearInterval(interval);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [apiKey, ready, failed]);

  useEffect(() => {
    if (!ready || !apiKey || !containerRef.current) return;
    let cancelled = false;
    let detach: (() => void) | undefined;
    const gWin = window as unknown as {
      google?: { maps?: { importLibrary: (name: string) => Promise<unknown> } };
    };

    void (async () => {
      let lib: unknown;
      try {
        lib = await gWin.google?.maps?.importLibrary?.("places");
      } catch (err) {
        logFePlaces("error", { message: String(err instanceof Error ? err.message : err) });
        setFailed(true);
        return;
      }
      if (cancelled || !containerRef.current || !lib || typeof lib !== "object") {
        if (!lib) setFailed(true);
        return;
      }
      const PlaceAutocompleteElement = (
        lib as { PlaceAutocompleteElement?: new (opts?: object) => HTMLElement }
      ).PlaceAutocompleteElement;
      if (!PlaceAutocompleteElement) {
        setFailed(true);
        return;
      }

      const mountRoot = containerRef.current;
      mountRoot.replaceChildren();
      const el = new PlaceAutocompleteElement({
        includedRegionCodes: ["us"],
        requestedLanguage: locale === "es" ? "es" : "en",
        requestedRegion: "us",
        placeholder: placeholder ?? "",
        name: id,
      });
      el.id = id;
      el.style.width = "100%";
      el.style.display = "block";
      el.style.colorScheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
      el.style.boxSizing = "border-box";
      el.style.border = "none";
      el.style.backgroundColor = "transparent";
      // Shadow DOM: a wrapper class cannot reach the inner input, so set this inline or the
      // address box stays browser-default while every field around it is larger.
      if (fontSizeRef.current) el.style.fontSize = fontSizeRef.current;

      const onSelect = (event: Event) => {
        inspectGmpSelectEvent(event);
        void (async () => {
          const pred = readPlacePredictionFromGmpSelectEvent(event);
          if (!pred) return;
          try {
            const place = pred.toPlace() as {
              fetchFields: (opts: { fields: string[] }) => Promise<void>;
              addressComponents?: GoogleAddressComponent[];
              formattedAddress?: string;
            };
            await place.fetchFields({ fields: ["addressComponents", "formattedAddress"] });
            const parsed = parsePlaceComponents(place.addressComponents);
            if (parsed?.line1) {
              // Prefer Google's formatted address (drops country) when available.
              const gFormatted = (place.formattedAddress ?? "").replace(/,\s*USA$/i, "").trim();
              const resolved = { ...parsed, formatted: gFormatted || parsed.formatted };
              (el as unknown as { value: string }).value = fullAddressRef.current ? resolved.formatted : parsed.line1;
              onResolveRef.current(resolved);
            }
          } catch (e) {
            logFePlaces("error", { message: String(e instanceof Error ? e.message : e), step: "fetchFields" });
          }
        })();
      };
      const onInput = () => {
        const v = (el as unknown as { value?: string }).value ?? "";
        onChangeRef.current(v);
      };

      el.addEventListener("gmp-select", onSelect as EventListener);
      el.addEventListener("input", onInput);
      if (cancelled || !containerRef.current) return;
      mountRoot.appendChild(el);
      try {
        const line = (valueRef.current ?? "").trim();
        if (line && "value" in el) (el as unknown as { value: string }).value = line;
      } catch {
        /* non-fatal */
      }
      detach = () => {
        el.removeEventListener("gmp-select", onSelect as EventListener);
        el.removeEventListener("input", onInput);
      };
    })();

    return () => {
      cancelled = true;
      detach?.();
      if (containerRef.current) containerRef.current.replaceChildren();
    };
    // Intentionally exclude value/callbacks (handled via refs) so we don't remount on keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, apiKey, id, locale, placeholder]);

  // No key or Maps failed → plain text input (always usable).
  if (!apiKey || failed) {
    return (
      <Input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={
          className
            ? className
            : invalid
              ? "border-red-500 focus-visible:ring-red-500"
              : ""
        }
      />
    );
  }

  return (
    <>
      {apiKey && (
        <Script
          id="google-maps-places"
          src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`}
          strategy="afterInteractive"
          onError={() => setFailed(true)}
        />
      )}
      <div
        ref={containerRef}
        className={
          className
            ? `flex w-full items-center ${className}`
            : `flex h-10 w-full items-center rounded-md border bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                invalid ? "border-red-500 focus-within:ring-red-500" : "border-input"
              }`
        }
      />
    </>
  );
}
