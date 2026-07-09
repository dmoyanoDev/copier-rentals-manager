import { describe, it, expect } from 'vitest';
import { encryptSession, decryptSession, UserSession } from '../../lib/auth/sessionDecrypt';

describe('Sesiones Cifradas AES-GCM (Web Crypto API)', () => {
  it('debe encriptar y desencriptar una sesión de usuario con éxito manteniendo sus atributos', async () => {
    const session: UserSession = {
      userId: 'test-id-123',
      username: 'operador_test',
      fullname: 'Operador de Pruebas',
      role: 'tecnico',
      sessionId: 'mock-session-id',
      expiresAt: Date.now() + 60000, // 1 minuto
    };

    const token = await encryptSession(session);
    expect(token).toContain(':'); // Separador IV:TextoEncriptado

    const decrypted = await decryptSession(token);
    expect(decrypted).not.toBeNull();
    expect(decrypted!.userId).toBe('test-id-123');
    expect(decrypted!.username).toBe('operador_test');
    expect(decrypted!.fullname).toBe('Operador de Pruebas');
    expect(decrypted!.role).toBe('tecnico');
    expect(decrypted!.expiresAt).toBe(session.expiresAt);
  });

  it('debe retornar null ante un token alterado o inválido', async () => {
    const result = await decryptSession('invalidiv:invalidciphertext');
    expect(result).toBeNull();
  });

  it('debe retornar null ante un token con formato incorrecto', async () => {
    const result = await decryptSession('token-sin-dos-puntos');
    expect(result).toBeNull();
  });
});
