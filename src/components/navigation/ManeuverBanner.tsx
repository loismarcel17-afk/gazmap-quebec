import type { ManeuverIcon as Icon } from "@/features/navigation/maneuver-icon";
import { t } from "@/lib/i18n";

/** Arrow paths drawn in a 48×48 box, pointing up = straight ahead. */
const PATHS: Record<Exclude<Icon, "roundabout" | "arrive">, string> = {
  straight: "M24 42V8M14 18l10-10 10 10",
  "slight-left": "M28 42V26L16 12M16 24V12h12",
  left: "M30 42V22H10M18 14l-8 8 8 8",
  "sharp-left": "M32 42V14L12 34M12 22v12h12",
  "slight-right": "M20 42V26l12-14M20 12h12v12",
  right: "M18 42V22h20M30 14l8 8-8 8",
  "sharp-right": "M16 42V14l20 20M24 34h12V22",
  uturn: "M16 42V20a8 8 0 0 1 16 0v14M24 28l8 8 8-8",
};

export function ManeuverGlyph({ icon }: { icon: Icon }) {
  return (
    <svg role="img" aria-label={t.navigation.icons[icon]} viewBox="0 0 48 48" className="size-14 shrink-0">
      {icon === "arrive" ? (
        <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 42V8" />
          <path d="M14 10h22l-5 7 5 7H14" fill="currentColor" />
        </g>
      ) : icon === "roundabout" ? (
        <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="24" cy="22" r="8" />
          <path d="M24 42V30M30 16l8-8M30 8h8v8" />
        </g>
      ) : (
        <path d={PATHS[icon]} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

interface ManeuverBannerProps {
  icon: Icon;
  /** "250 m" */
  distance: string;
  street: string;
}

/** Next maneuver, readable at a glance: big icon, big distance, street name. */
export function ManeuverBanner({ icon, distance, street }: ManeuverBannerProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-zinc-900 p-4 text-white shadow-xl" aria-live="polite">
      <ManeuverGlyph icon={icon} />
      <div className="min-w-0">
        <p className="text-4xl font-bold tabular-nums">{distance}</p>
        <p className="truncate text-xl font-medium">{street}</p>
      </div>
    </div>
  );
}
