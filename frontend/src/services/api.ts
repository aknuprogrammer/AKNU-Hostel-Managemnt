const API_BASE = '/api/v1';

export function getStoredToken(): string | null {
  return localStorage.getItem('aknu_auth_token');
}

export function setStoredToken(token: string) {
  localStorage.setItem('aknu_auth_token', token);
}

export function clearStoredToken() {
  localStorage.removeItem('aknu_auth_token');
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: any;
    formData?: FormData;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body: any = undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body
  });

  let data: any;
  try {
    data = await res.json();
  } catch (e) {
    data = { error: res.statusText };
  }

  if (!res.ok) {
    // If structured scan response with resultStatus, return it so the caller can render result screen
    if (data.resultStatus) {
      return data as T;
    }
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data as T;
}
