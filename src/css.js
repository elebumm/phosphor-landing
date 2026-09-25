// The design is authored with inline CSS strings; React needs style objects.
// Parse each distinct string once and reuse the object on every render.
const cache = new Map();

export function css(text) {
  let style = cache.get(text);
  if (style) return style;
  style = {};
  for (const decl of text.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || value === '') continue;
    style[prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  cache.set(text, style);
  return style;
}
