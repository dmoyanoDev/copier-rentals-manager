import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '../src/app/api/users/route';
import { verifyMaster } from '../src/lib/auth/authService';
import { db } from '../src/infrastructure/db/client';

vi.mock('../src/lib/auth/authService', () => ({
  verifyMaster: vi.fn(),
}));

vi.mock('../src/infrastructure/db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('../src/lib/security/audit', () => ({
  logSecurityEvent: vi.fn(),
}));

describe('Users API Endpoints (/api/users)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET retorna status 401 si verifyMaster falla con UNAUTHORIZED', async () => {
    const mockAuthError = new Error('No autenticado');
    (mockAuthError as any).code = 'UNAUTHORIZED';
    (verifyMaster as any).mockRejectedValueOnce(mockAuthError);

    const req = new Request('http://localhost/api/users');
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Sesión no válida.',
      },
    });
  });

  it('GET retorna status 403 si verifyMaster falla con FORBIDDEN', async () => {
    const mockAuthError = new Error('No autorizado');
    (mockAuthError as any).code = 'FORBIDDEN';
    (verifyMaster as any).mockRejectedValueOnce(mockAuthError);

    const req = new Request('http://localhost/api/users');
    const res = await GET(req);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'No tenés permisos para acceder a usuarios.',
      },
    });
  });

  it('GET retorna status 200 con la lista de usuarios si es master', async () => {
    (verifyMaster as any).mockResolvedValueOnce({
      userId: 'user-admin',
      username: 'dmoyano',
      fullname: 'Darío Moyano',
      role: 'master',
    });

    const mockUsers = [
      { id: '1', username: 'tech1', fullname: 'Tech One', email: 't1@test.com', role: 'tecnico', active: 1, passwordHash: 'hashedpassword' },
    ];

    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockResolvedValueOnce(mockUsers),
    });

    const req = new Request('http://localhost/api/users');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    // passwordHash debe ser excluido en el route handler
    expect(json.data.users).toEqual([
      { id: '1', username: 'tech1', fullname: 'Tech One', email: 't1@test.com', role: 'tecnico', active: 1 },
    ]);
  });

  it('POST retorna status 400 si faltan campos obligatorios', async () => {
    (verifyMaster as any).mockResolvedValueOnce({
      userId: 'user-admin',
      username: 'dmoyano',
      fullname: 'Darío Moyano',
      role: 'master',
    });

    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      body: JSON.stringify({
        username: 'newuser',
        // fullname, email, password, role faltan
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('BAD_REQUEST');
  });
});
