import { apiFetch } from './client.js';

export async function loginUser(identifier, password) {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, username: identifier, password })
  });
  return res.json();
}

export async function registerUser(nama, username, password) {
  const isEmail = username.includes('@');
  const payload = {
    nama,
    password,
    email: isEmail ? username : null,
    whatsapp: !isEmail ? username : null
  };

  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res.json();
}

export async function getUserProfile() {
  const res = await apiFetch('/api/auth/me');
  return res.json();
}
