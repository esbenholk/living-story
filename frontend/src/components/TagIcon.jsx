import { useState, useEffect } from "react";

const svgCache = new Map(); // module-level cache — shared across all instances

function TagIcon({ tag, color, size = 32 }) {
  const [svgRaw, setSvgRaw] = useState(null);

  useEffect(() => {
    if (!tag?.svg) return;
    if (svgCache.has(tag.svg)) {
      setSvgRaw(svgCache.get(tag.svg));
      return;
    }
    fetch(`/tags/${tag.svg}`)
      .then(r => r.text())
      .then(text => {
        svgCache.set(tag.svg, text);
        setSvgRaw(text);
      });
  }, [tag?.svg]);

  if (!svgRaw) return null;

  // Apply color at render time, not fetch time
  const colored = svgRaw.replace(
    /\.cls-1\s*\{[^}]*fill\s*:\s*[^;]+;/,
    `.cls-1 { fill: ${color};`
  );

  return (
    <div
        key={color}  // ← forces React to remount when color changes
      style={{ width: size, height: size, flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: colored }}
    />
  );
}

export default TagIcon;