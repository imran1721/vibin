const KEY = "jam_display_name";

export function getOrCreateDisplayName(): string {
  if (typeof window === "undefined") return "Guest";
  let name = window.localStorage.getItem(KEY);
  if (!name) {
    name = `Guest ${Math.random().toString(36).slice(2, 6)}`;
    window.localStorage.setItem(KEY, name);
  }
  return name;
}
