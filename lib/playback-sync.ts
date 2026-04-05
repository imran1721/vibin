/** Wall-clock sync point for shared playback (see `rooms.playback_anchor_*`). */
export function effectivePlaybackSec(
  anchorSec: number,
  anchorAtIso: string,
  paused: boolean
): number {
  if (paused) return Math.max(0, anchorSec);
  const at = Date.parse(anchorAtIso);
  if (Number.isNaN(at)) return Math.max(0, anchorSec);
  const elapsed = (Date.now() - at) / 1000;
  return Math.max(0, anchorSec + Math.max(0, elapsed));
}
