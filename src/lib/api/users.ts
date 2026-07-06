import { safeFetch } from './fetcher';

export interface ApiUser {
  id: string;
  username: string;
  fullname: string;
  email: string;
  role: string;
  phone: string | null;
  whatsapp: string | null;
  active: number;
}

export interface GetUsersResponse {
  users: ApiUser[];
}

export interface UserMutateResponse {
  user: ApiUser;
}

export async function getUsers(): Promise<ApiUser[]> {
  const data = await safeFetch<GetUsersResponse>('/api/users');
  return data.users || [];
}

export async function createUser(payload: Partial<ApiUser> & { password?: string }): Promise<ApiUser> {
  const data = await safeFetch<UserMutateResponse>('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data.user;
}

export async function updateUser(id: string, payload: Partial<ApiUser> & { password?: string }): Promise<ApiUser> {
  const data = await safeFetch<UserMutateResponse>(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return data.user;
}
