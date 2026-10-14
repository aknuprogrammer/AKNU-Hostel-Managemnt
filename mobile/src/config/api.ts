import { Platform } from 'react-native';

// In Android emulator, 10.0.2.2 points to host machine localhost:5000. On physical devices, host machine LAN IP.
export const API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:5000/api/v1',
  ios: 'http://localhost:5000/api/v1',
  default: 'http://localhost:5000/api/v1'
});

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

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
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
