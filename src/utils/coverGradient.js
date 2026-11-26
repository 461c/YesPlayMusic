import Color from 'color';

// Weight contrasting colors by their coverage so tiny specks do not dominate.
export function coverGradient(swatches) {
  const colors = swatches
    .filter(s => s.population > 0)
    .sort((a, b) => b.population - a.population);
  if (!colors.length) return '';
  const primary = colors[0];
  const distance = (a, b) =>
    Math.hypot(...a.rgb.map((channel, i) => channel - b.rgb[i]));
  function pickAccent(references) {
    let best = primary;
    let bestScore = 0;
    for (const candidate of colors) {
      const separation = Math.min(
        ...references.map(s => distance(candidate, s))
      );
      const score =
        separation * Math.sqrt(candidate.population / primary.population);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }
  const secondary = pickAccent([primary]);
  const accent = pickAccent([primary, secondary]);
  // Cap each stop's relative luminance for white lyrics, including on pale covers.
  function tone(swatch, strength) {
    let color = Color.rgb(swatch.rgb).darken(strength);
    while (color.luminosity() > 0.14) color = color.darken(0.08);
    return color.rgb().string();
  }
  return `linear-gradient(132deg, ${tone(primary, 0.12)}, ${tone(
    secondary,
    0.22
  )} 56%, ${tone(accent, 0.32)})`;
}
