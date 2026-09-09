export const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000/api";

export const apiFetch = (path: string, init?: RequestInit) => {
  const token = localStorage.getItem("nexus_token");
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).then((response) => {
    if (response.status === 401) window.dispatchEvent(new CustomEvent("nexus-session-expired"));
    return response;
  });
};
