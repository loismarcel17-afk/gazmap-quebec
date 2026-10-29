// When to speak each voice instruction.
//
// Mapbox gives, per step, announcements with distanceAlongGeometry = "say this
// when the next maneuver is that many meters ahead". Each is spoken once.
import type { NavigationModel, Progress } from "./progress";

export interface Announcement {
  /** Stable id "step:index", to remember what was already said */
  key: string;
  text: string;
}

/**
 * The announcement to speak now, or null.
 *
 * If several became due at once (GPS gap, app resumed), only the latest — the
 * one closest to the maneuver — is spoken; older ones are skipped: hearing
 * "in 600 m, turn left" when the turn is 30 m away would be wrong.
 *
 * @returns the announcement to speak, and every key to mark as spoken.
 */
export function dueAnnouncement(
  model: NavigationModel,
  progress: Progress,
  spoken: ReadonlySet<string>,
): { announcement: Announcement | null; markSpoken: string[] } {
  const step = model.route.steps[progress.stepIndex];
  const due = step.voice
    .map((instruction, index) => ({ ...instruction, key: `${progress.stepIndex}:${index}` }))
    .filter((instruction) => !spoken.has(instruction.key))
    .filter((instruction) => progress.distanceToManeuver <= instruction.distanceAlongGeometry);

  if (due.length === 0) return { announcement: null, markSpoken: [] };
  const latest = due.reduce((a, b) => (b.distanceAlongGeometry < a.distanceAlongGeometry ? b : a));
  return {
    announcement: { key: latest.key, text: latest.announcement },
    markSpoken: due.map((instruction) => instruction.key),
  };
}
