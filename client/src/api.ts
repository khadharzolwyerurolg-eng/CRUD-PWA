import type { User, UserInput } from './types';

const apiUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api').replace(
  /\/$/,
  '',
);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? `O pedido falhou (${response.status}).`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function listUsers(): Promise<User[]> {
  return request<User[]>('/usuarios');
}

export function createUser(
  clientId: string,
  payload: UserInput,
): Promise<User> {
  return request<User>('/usuarios', {
    method: 'POST',
    body: JSON.stringify({ ...payload, clientId }),
  });
}

export function updateUser(id: string, payload: UserInput): Promise<User> {
  return request<User>(`/usuarios/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteUser(id: string): Promise<void> {
  return request<void>(`/usuarios/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
