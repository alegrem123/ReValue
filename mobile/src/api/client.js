import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const TOKEN_KEY = 'revalue.jwt';
const USER_KEY = 'revalue.user';
const DEFAULT_API_BASE_URL = 'https://revalue-backend-84jb.onrender.com';

function cleanApiBase(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolveApiBase() {
  const explicitBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (explicitBase) return cleanApiBase(explicitBase);

  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host === '127.0.0.1' || host === 'localhost') {
        return cleanApiBase('http://localhost:3000');
      }
      return cleanApiBase(`http://${host}:3000`);
    }
  }

  return cleanApiBase(DEFAULT_API_BASE_URL);
}

export const API_BASE_URL = resolveApiBase();
const API_PREFIX = '/api/v1';

function normalizeEndpoint(endpoint) {
  if (endpoint.startsWith(`${API_PREFIX}/`)) return endpoint;
  if (endpoint === '/api') return API_PREFIX;
  if (endpoint.startsWith('/api/')) return `${API_PREFIX}${endpoint.slice(4)}`;
  return endpoint;
}

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
    response = await fetch(`${API_BASE_URL}${normalizeEndpoint(endpoint)}`, {
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

  const normalized = data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'ok')
    ? data
    : null;
  const ok = normalized ? normalized.ok && response.ok : response.ok;
  const payload = normalized && normalized.ok ? normalized.data : data;

  return {
    ok,
    status: response.status,
    data: payload,
    error: ok ? null : normalized?.message || data?.message || data?.error || `Errore ${response.status}`,
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
