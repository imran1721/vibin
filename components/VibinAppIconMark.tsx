/**
 * Static favicon / PWA / Apple touch art — same 32×32 geometry as `VibinEqualizerMark`.
 * Uses nested flex layouts so `@vercel/og` / Satori accepts the tree (no multi-child div without display).
 */
export function VibinAppIconMark({ size }: { size: number }) {
  const s = size / 32;
  const rOuter = 8 * s;
  const rBar = 2 * s;
  const gap = 3 * s;
  const padBottom = 4 * s;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        alignItems: "center",
        background: "#1c1412",
        borderRadius: rOuter,
        paddingBottom: padBottom,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "center",
          gap,
        }}
      >
        <div
          style={{
            width: 4 * s,
            height: 10 * s,
            background: "#e8945c",
            borderRadius: rBar,
          }}
        />
        <div
          style={{
            width: 4 * s,
            height: 17 * s,
            background: "#e8945c",
            borderRadius: rBar,
          }}
        />
        <div
          style={{
            width: 4 * s,
            height: 14 * s,
            background: "#5eb8c4",
            borderRadius: rBar,
          }}
        />
      </div>
    </div>
  );
}
