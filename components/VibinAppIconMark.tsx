/**
 * Static favicon / PWA / Apple touch art — four bars on a rounded tile so the
 * mark stays visible on browser tabs and home screens (where transparency
 * doesn't help). Bar layout matches the in-app `VibinEqualizerMark`.
 * Uses nested flex layouts so `@vercel/og` / Satori accepts the tree (no
 * multi-child div without display).
 */
export function VibinAppIconMark({ size }: { size: number }) {
  const s = size / 32;
  const rOuter = 8 * s;
  const rBar = 2 * s;
  const gap = 2 * s;
  const padBottom = 7 * s;

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
            height: 18 * s,
            background: "#e8945c",
            borderRadius: rBar,
          }}
        />
        <div
          style={{
            width: 4 * s,
            height: 12 * s,
            background: "#e8945c",
            borderRadius: rBar,
          }}
        />
        <div
          style={{
            width: 4 * s,
            height: 16 * s,
            background: "#5eb8c4",
            borderRadius: rBar,
          }}
        />
      </div>
    </div>
  );
}
