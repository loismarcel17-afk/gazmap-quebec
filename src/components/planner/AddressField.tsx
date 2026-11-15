"use client";

import { useQuery } from "@tanstack/react-query";
import { useId, useState, type KeyboardEvent } from "react";
import type { LatLng } from "@/features/geo/geo";
import { MIN_QUERY_LENGTH, type AddressSuggestion } from "@/features/places/geocoding";
import { t } from "@/lib/i18n";
import { searchAddresses } from "@/lib/planner-api";
import { useDebounced } from "@/lib/use-debounced";

/** Wait for a pause in typing: one Mapbox request per word, not per letter (each is billed). */
const DEBOUNCE_MS = 400;

export interface Place extends LatLng {
  label: string;
  /** true: the device's position */
  fromDevice?: boolean;
}

interface AddressFieldProps {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  /** Rank suggestions near this point (the departure) */
  near: LatLng | null;
  /** Shown as a button in the field (departure only): use the device's position */
  onLocate?: () => void;
  locating?: boolean;
}

/**
 * Address combobox (WAI-ARIA pattern, like LocationSearch): type, pick a
 * suggestion with the mouse or the arrow keys + Enter.
 */
export function AddressField({ label, value, onChange, near, onLocate, locating = false }: AddressFieldProps) {
  const [text, setText] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounced = useDebounced(text.trim(), DEBOUNCE_MS);
  const id = useId();
  const listboxId = `${id}-list`;
  const optionId = (index: number) => `${id}-${index}`;

  // A place chosen from outside (e.g. "my position"): show its label. Adjusted
  // during render (React's pattern for "state derived from a prop change"), not
  // in an effect. Going back to null (the user is typing) keeps what's typed.
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    if (value) setText(value.label);
  }

  const searching = open && debounced.length >= MIN_QUERY_LENGTH && debounced !== value?.label;
  const suggestions = useQuery({
    // Rounded: moving a few meters must not trigger a new (billed) search.
    queryKey: ["addresses", debounced, near?.lat.toFixed(2), near?.lng.toFixed(2)],
    queryFn: () => searchAddresses(debounced, near),
    enabled: searching,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const results: AddressSuggestion[] = suggestions.data ?? [];
  const showList = searching && !suggestions.isPending;

  function choose(place: AddressSuggestion) {
    setText(place.label);
    setOpen(false);
    onChange({ lat: place.lat, lng: place.lng, label: place.label });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length > 0) {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + results.length) % results.length);
    } else if (event.key === "Enter" && showList && results.length > 0) {
      event.preventDefault();
      choose(results[Math.max(0, activeIndex)]);
    } else if (event.key === "Escape" && showList) {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="mb-1 block text-sm font-medium text-zinc-800">
        {label}
      </label>
      <div className="flex items-center rounded-xl border border-zinc-300 bg-white focus-within:outline-2 focus-within:outline-blue-700">
        <input
          id={`${id}-input`}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-activedescendant={showList && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          placeholder={t.planner.addressPlaceholder}
          autoComplete="off"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
            if (value) onChange(null); // typing again: the previous choice no longer applies
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setOpen(false)}
          className="min-h-11 min-w-0 flex-1 rounded-l-xl bg-transparent px-3 text-base text-zinc-950 placeholder:text-zinc-600 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText("");
              onChange(null);
            }}
            aria-label={`${t.planner.clear} : ${label}`}
            className="flex size-11 shrink-0 items-center justify-center text-zinc-600 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {onLocate && (
          <button
            type="button"
            onClick={onLocate}
            disabled={locating}
            aria-busy={locating}
            aria-label={t.planner.useMyPosition}
            className="flex size-11 shrink-0 items-center justify-center rounded-r-xl text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-60"
          >
            <svg aria-hidden viewBox="0 0 24 24" className={`size-5 ${locating ? "animate-pulse" : ""}`} fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {showList && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl bg-white shadow-lg">
          <ul id={listboxId} role="listbox" aria-label={t.planner.addressSuggestions}>
            {results.map((place, index) => (
              <li
                key={`${place.label}-${index}`}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(place)}
                className="flex min-h-11 cursor-pointer items-center px-3 py-2 text-zinc-900 hover:bg-zinc-100 aria-selected:bg-zinc-100"
              >
                {place.label}
              </li>
            ))}
          </ul>
          {results.length === 0 && (
            <p className="px-3 py-3 text-sm text-zinc-700">
              {suggestions.data === null ? t.planner.addressUnavailable : t.planner.addressNoResult}
            </p>
          )}
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {searching && suggestions.isPending ? t.planner.addressSearching : ""}
      </p>
    </div>
  );
}
