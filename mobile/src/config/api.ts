import { NativeModules, Platform } from 'react-native';

// Automatically detect host IP from Metro bundle URL when running on physical device via Expo Go,
// with fallback to current local Wi-Fi IP
function resolveDefaultHost(): string {
  try {
    const scriptURL: string = NativeModules?.SourceCode?.scriptURL || '';
    if (scriptURL && scriptURL.includes('://')) {
      const hostPart = scriptURL.split('://')[1]?.split(':')[0];
      if (hostPart && hostPart !== 'localhost' && hostPart !== '127.0.0.1') {
        return hostPart;
      }
    }
  } catch (e) {
    // Fallback if NativeModules is unavailable
  }
  return Platform.OS === 'android' && !Platform.isTV
    ? '192.168.0.102'
    : 'localhost';
}

let customBaseUrl = `http://${resolveDefaultHost()}:5000/api/v1`;

export function getApiBaseUrl(): string {
  return customBaseUrl;
}

export function setApiBaseUrl(url: string) {
  let cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned.endsWith('/api/v1')) {
    cleaned = `${cleaned}/api/v1`;
  }
  customBaseUrl = cleaned;
}

let authToken: string | null = null;

export function setMobileToken(token: string) {
  authToken = token;
}

export function getMobileToken(): string | null {
  return authToken;
}

export async function mobileApiRequest<T = any>(endpoint: string, options: any = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await res.json();
  if (!res.ok) {
    if (data.resultStatus) return data as T;
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data as T;
}
