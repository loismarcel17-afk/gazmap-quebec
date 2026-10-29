import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { LatLng } from "@/features/geo/geo";
import { searchPlaces, type Place } from "@/features/places/places";
import { formatInteger } from "@/lib/format";
import { GeolocationFailure, getCurrentPosition, type GeolocationFailureReason } from "@/lib/geolocation";
import { plural, t } from "@/lib/i18n";

/** Where to search around: the user's position or a chosen place. */
export interface Origin extends LatLng {
  label: string;
  /** true: the device's position ("Ma position"); false: a searched place */
  fromDevice: boolean;
}

interface LocationSearchProps {
  places: Place[];
  onOriginChange: (origin: Origin | null) => void;
}

export function LocationSearch({ places, onOriginChange }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<GeolocationFailureReason | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // useId gives ids that are unique even if this component is rendered twice.
  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-${index}`;

  const suggestions = useMemo(() => searchPlaces(places, query), [places, query]);
  const showList = open && query.trim().length >= 2;

  function choose(place: Place) {
    setQuery(place.label);
    setOpen(false);
    setError(null);
    onOriginChange({ lat: place.lat, lng: place.lng, label: place.label, fromDevice: false });
  }

  function clear() {
    setQuery("");
    setOpen(false);
    setError(null);
    onOriginChange(null);
    inputRef.current?.focus();
  }

  async function locate() {
    setLocating(true);
    setError(null);
    try {
      const position = await getCurrentPosition();
      setQuery(t.search.myPosition);
      setOpen(false);
      onOriginChange({ ...position, label: t.search.myPosition, fromDevice: true });
    } catch (failure) {
      setError(failure instanceof GeolocationFailure ? failure.reason : "unavailable");
    } finally {
      setLocating(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      event.preventDefault(); // keep the cursor where it is
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && showList && suggestions.length > 0) {
      event.preventDefault();
      choose(suggestions[Math.max(0, activeIndex)]);
    } else if (event.key === "Escape" && showList) {
      event.stopPropagation(); // close the list, not the station sheet
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center rounded-full bg-white shadow-md focus-within:outline-2 focus-within:outline-blue-700">
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={t.search.label}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-activedescendant={showList && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          placeholder={t.search.placeholder}
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setOpen(false)}
          className="min-h-11 min-w-0 flex-1 rounded-l-full bg-transparent pl-4 text-base text-zinc-950 placeholder:text-zinc-600 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            aria-label={t.search.clear}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <span aria-hidden className="h-6 w-px bg-zinc-200" />
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          aria-label={t.search.locate}
          aria-busy={locating}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-60"
        >
          {/* Crosshair icon */}
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className={`size-5 ${locating ? "animate-pulse" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {showList && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl bg-white shadow-lg">
          <ul id={listboxId} role="listbox" aria-label={t.search.suggestions}>
            {suggestions.map((place, index) => (
              <li
                key={`${place.kind}-${place.key}`}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                // mousedown fires before the input's blur: keep focus so the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(place)}
                className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-4 text-zinc-900 hover:bg-zinc-100 aria-selected:bg-zinc-100"
              >
                <span className="truncate">{place.label}</span>
                <span className="shrink-0 text-xs text-zinc-600">
                  {plural(t.search.stationCount, place.stationCount, { count: formatInteger(place.stationCount) })}
                </span>
              </li>
            ))}
          </ul>
          {suggestions.length === 0 && <p className="px-4 py-3 text-sm text-zinc-700">{t.search.noResult}</p>}
        </div>
      )}

      {/* Live region: announced by screen readers when the text changes. */}
      <p aria-live="polite" className="empty:hidden mt-1 rounded-lg bg-white/95 px-3 py-1.5 text-sm text-zinc-800 shadow-sm">
        {locating ? `${t.search.locating} ${t.search.privacy}` : error ? t.search.errors[error] : ""}
      </p>
    </div>
  );
}
