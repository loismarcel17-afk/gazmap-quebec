// Shared Tailwind classes for the account pages: large touch targets (≥ 44 px),
// visible keyboard focus.
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export const BUTTON_PRIMARY = `min-h-12 rounded-xl bg-blue-700 px-5 text-lg font-semibold text-white hover:bg-blue-800 disabled:opacity-60 ${FOCUS}`;
export const BUTTON_SECONDARY = `min-h-11 rounded-xl bg-zinc-100 px-4 font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-60 ${FOCUS}`;
export const BUTTON_DANGER = `min-h-11 rounded-xl bg-red-700 px-4 font-semibold text-white hover:bg-red-800 disabled:opacity-60 ${FOCUS}`;
export const BUTTON_DANGER_SOFT = `min-h-11 rounded-xl bg-zinc-100 px-4 font-medium text-red-800 hover:bg-red-50 disabled:opacity-60 ${FOCUS}`;
export const FIELD =
  "min-h-12 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-950 aria-invalid:border-red-700 focus-visible:outline-2 focus-visible:outline-blue-700";
