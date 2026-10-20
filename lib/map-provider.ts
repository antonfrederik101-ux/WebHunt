export function mapProvider(key: string | undefined) {
  if (!key?.trim()) return null;
  return {
    name: "MapTiler",
    url: `https://api.maptiler.com/maps/streets-v4/{z}/{x}/{y}.png?key=${encodeURIComponent(key.trim())}`,
    styleUrl: `https://api.maptiler.com/maps/streets-v4/style.json?key=${encodeURIComponent(key.trim())}`,
    attribution:
      '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">&copy; MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
  };
}
