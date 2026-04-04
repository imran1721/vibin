/** Shared visual for favicon / PWA / Apple touch (ImageResponse subtree). */
export function VibinAppIconMark({ size }: { size: number }) {
  const barW = Math.max(2, Math.round(size * 0.14));
  const gap = Math.round(size * 0.09);
  const rOuter = Math.round(size * 0.25);
  const rBar = Math.round(barW / 2);
  const h1 = Math.round(size * 0.31);
  const h2 = Math.round(size * 0.53);
  const h3 = Math.round(size * 0.44);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1c1412",
        borderRadius: rOuter,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap,
          marginBottom: Math.round(size * 0.14),
        }}
      >
        <div
          style={{
            width: barW,
            height: h1,
            background: "#e8945c",
            borderRadius: rBar,
          }}
        />
        <div
          style={{
            width: barW,
            height: h2,
            background: "#e8945c",
            borderRadius: rBar,
          }}
        />
        <div
          style={{
            width: barW,
            height: h3,
            background: "#5eb8c4",
            borderRadius: rBar,
          }}
        />
      </div>
    </div>
  );
}
