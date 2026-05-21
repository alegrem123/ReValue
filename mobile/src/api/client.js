import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const TOKEN_KEY = 'revalue.jwt';
const USER_KEY = 'revalue.user';

function resolveApiBase() {
  // In sviluppo: stesso IP del dev server Expo, porta 3000
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      return `http://${host}:3000`;
    }
  }
  return process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
}

export const API_BASE_URL = resolveApiBase();

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getUserId() {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    let b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(atob(b64)).id || null;
  } catch {
    return null;
  }
}

export async function setToken(token) {
  if (!token) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setStoredUser(user) {
  if (!user) {
    await AsyncStorage.removeItem(USER_KEY);
    return;
  }
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

async function buildHeaders(hasBody) {
  const headers = {};
  if (hasBody) headers['Content-Type'] = 'application/json';

  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
}

export async function apiRequest(endpoint, { method = 'GET', body, auth = true } = {}) {
  const hasBody = body !== undefined && body !== null;
  const headers = auth ? await buildHeaders(hasBody) : hasBody ? { 'Content-Type': 'application/json' } : {};

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: `Backend non raggiungibile su ${API_BASE_URL}.`,
    };
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (response.status === 401 && auth) {
    await clearSession();
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? null : data?.error || data?.message || `Errore ${response.status}`,
  };
}

export const api = {
  get(endpoint, opts = {}) {
    return apiRequest(endpoint, { ...opts, method: 'GET' });
  },
  post(endpoint, body, opts = {}) {
    return apiRequest(endpoint, { ...opts, method: 'POST', body });
  },
  put(endpoint, body, opts = {}) {
    return apiRequest(endpoint, { ...opts, method: 'PUT', body });
  },
  patch(endpoint, body, opts = {}) {
    return apiRequest(endpoint, { ...opts, method: 'PATCH', body });
  },
  delete(endpoint, opts = {}) {
    return apiRequest(endpoint, { ...opts, method: 'DELETE' });
  },
};
