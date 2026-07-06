import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getUsers, createUser, updateUser } from '../src/lib/api/users';
import {
  UnauthorizedError,
  ForbiddenError,
  InternalServerError,
  NetworkError,
  ParseError,
  AppError,
} from '../src/lib/errors';

describe('Users API Client Service (users.ts & fetcher.ts)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('devuelve una lista vacía cuando el contrato retorna users vacío', async () => {
    const mockResponse = {
      ok: true,
      data: {
        users: [],
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => JSON.stringify(mockResponse),
    });

    const usersList = await getUsers();
    expect(usersList).toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith('/api/users', undefined);
  });

  it('devuelve lista de usuarios cuando el contrato retorna datos válidos', async () => {
    const mockUsers = [
      { id: '1', username: 'user1', fullname: 'User One', email: 'u1@test.com', role: 'tecnico', active: 1, phone: null, whatsapp: null },
    ];
    const mockResponse = {
      ok: true,
      data: {
        users: mockUsers,
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => JSON.stringify(mockResponse),
    });

    const usersList = await getUsers();
    expect(usersList).toEqual(mockUsers);
  });

  it('lanza error de red (NetworkError) cuando fetch falla por completo', async () => {
    (global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(getUsers()).rejects.toThrow(NetworkError);
  });

  it('lanza UnauthorizedError ante código de respuesta HTTP 401', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      status: 401,
      ok: false,
      text: async () => '',
    });

    await expect(getUsers()).rejects.toThrow(UnauthorizedError);
  });

  it('lanza ForbiddenError ante código de respuesta HTTP 403', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      status: 403,
      ok: false,
      text: async () => '',
    });

    await expect(getUsers()).rejects.toThrow(ForbiddenError);
  });

  it('lanza InternalServerError ante código de respuesta HTTP 500', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      status: 500,
      ok: false,
      text: async () => '',
    });

    await expect(getUsers()).rejects.toThrow(InternalServerError);
  });

  it('lanza ParseError si el cuerpo de respuesta no es JSON válido', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      status: 200,
      ok: true,
      text: async () => 'not a valid json string',
    });

    await expect(getUsers()).rejects.toThrow(ParseError);
  });

  it('lanza AppError con código y mensaje personalizado si el contrato ok es false', async () => {
    const errorResponse = {
      ok: false,
      error: {
        code: 'CONFLICT_EMAIL',
        message: 'El email ya existe',
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      status: 409,
      ok: false,
      text: async () => JSON.stringify(errorResponse),
    });

    const promise = getUsers();
    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toThrow('El email ya existe');
  });
});
