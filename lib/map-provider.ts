export function mapProvider(key: string | undefined) {
  if (!key?.trim()) return null;
  return {
    name: "MapTiler",
    url: `https://api.maptiler.com/maps/dataviz-v4-dark/{z}/{x}/{y}.png?key=${encodeURIComponent(key.trim())}`,
    tileSize: 512,
    zoomOffset: -1,
    attribution:
      '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">&copy; MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
  };
}
