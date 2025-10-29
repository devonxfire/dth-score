// Central API base helper
export const API_BASE = import.meta.env.VITE_API_BASE || '';

export function apiUrl(path) {
  // ensure leading slash
  if (!path.startsWith('/')) path = '/' + path;
  return `${API_BASE}${path}`;
}
