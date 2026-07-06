import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyMaster, AuthError } from '../src/lib/auth/authService';
import { getSession } from '../src/infrastructure/auth/session';
import { decryptSession, encryptSession, UserSession } from '../src/lib/auth/sessionDecrypt';

// Mock dependencies
vi.mock('../src/infrastructure/auth/session', () => ({
  getSession: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock('../src/infrastructure/db/client', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

describe('Session Persistence and Identity Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifyMaster approves user session when isMaster flag is true', async () => {
    const mockSession: UserSession = {
      userId: 'user-admin',
      username: 'dario',
      fullname: 'Darío Moyano',
      role: 'master',
      isMaster: true,
      sessionId: 'sess-1234',
      expiresAt: Date.now() + 10000,
    };
    (getSession as any).mockResolvedValueOnce(mockSession);

    const result = await verifyMaster();
    expect(result.userId).toBe('user-admin');
    expect(result.isMaster).toBe(true);
  });

  it('verifyMaster rejects user session when isMaster is false and role is not master', async () => {
    const mockSession: UserSession = {
      userId: 'user-tech1',
      username: 'mgomez',
      fullname: 'Marcelo Gómez',
      role: 'tecnico',
      isMaster: false,
      sessionId: 'sess-5678',
      expiresAt: Date.now() + 10000,
    };
    (getSession as any).mockResolvedValueOnce(mockSession);

    await expect(verifyMaster()).rejects.toThrow(AuthError);
  });

  it('encryptSession and decryptSession correctly serializes and deserializes the isMaster flag', async () => {
    const mockSession: UserSession = {
      userId: 'user-admin',
      username: 'dario',
      fullname: 'Darío Moyano',
      role: 'master',
      isMaster: true,
      sessionId: 'sess-9999',
      expiresAt: Date.now() + 10000,
    };

    const token = await encryptSession(mockSession);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decrypted = await decryptSession(token);
    expect(decrypted).not.toBeNull();
    expect(decrypted!.userId).toBe('user-admin');
    expect(decrypted!.isMaster).toBe(true);
  });
});
