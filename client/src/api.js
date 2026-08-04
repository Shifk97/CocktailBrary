const TOKEN_KEY = "coctelaria_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }

  if (!res.ok) {
    const message = (data && data.error) || `Error ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  config: () => request("/config"),
  register: (username, password) => request("/auth/register", { method: "POST", body: { username, password } }),
  login: (username, password) => request("/auth/login", { method: "POST", body: { username, password } }),
  changePassword: (currentPassword, newPassword) => request("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } }),
  uploadImage: (dataUrl) => request("/uploads", { method: "POST", body: { dataUrl } }),
  deleteImages: (paths) => request("/uploads", { method: "DELETE", body: { paths } }),
  me: () => request("/me"),
  getData: (key) => request(`/data/${key}`),
  setData: (key, value) => request(`/data/${key}`, { method: "PUT", body: { value } }),
};
