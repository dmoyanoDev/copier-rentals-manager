import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import UsersPage from '../src/app/(dashboard)/usuarios/page';
import * as usersClient from '../src/lib/api/users';
import { AppError } from '../src/lib/errors';

// Mock Lucide icons to prevent SVG rendering issues in test environment
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual<any>('lucide-react');
  return {
    ...actual,
    ShieldAlert: () => <div data-testid="shield-alert-icon" />,
    Shield: () => <div data-testid="shield-icon" />,
    Check: () => <div data-testid="check-icon" />,
    X: () => <div data-testid="x-icon" />,
    Plus: () => <div data-testid="plus-icon" />,
    Edit: () => <div data-testid="edit-icon" />,
    RefreshCw: () => <div data-testid="refresh-icon" />,
  };
});

// Mock UI Table elements to prevent compilation issues
vi.mock('@/components/ui/table', () => ({
  TableContainer: ({ children }: any) => <div data-testid="table-container">{children}</div>,
  Table: ({ children }: any) => <table data-testid="table">{children}</table>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
  TableHeaderCell: ({ children }: any) => <th>{children}</th>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children }: any) => <td>{children}</td>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ label, value, onChange, ...props }: any) => (
    <div>
      <label>{label}</label>
      <input value={value} onChange={onChange} {...props} />
    </div>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ label, value, onChange, options }: any) => (
    <div>
      <label>{label}</label>
      <select value={value} onChange={onChange}>
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  ),
}));

vi.mock('@/components/ui/modal', () => ({
  Modal: ({ children, isOpen, title, footer }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal">
        <h2>{title}</h2>
        {children}
        <footer>{footer}</footer>
      </div>
    );
  },
}));

describe('UsersPage UI Render States', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // Suppress console.error inside catch blocks for testing
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders LOADING state exclusively', async () => {
    // Keep auth validation unresolved to test loading state
    (global.fetch as any).mockReturnValueOnce(new Promise(() => {}));

    render(<UsersPage />);

    expect(screen.getByText('Validando credenciales de seguridad...')).toBeDefined();
    expect(screen.queryByText('Acceso Restringido')).toBeNull();
    expect(screen.queryByText('Error al Cargar Usuarios')).toBeNull();
    expect(screen.queryByPlaceholderText('Buscar usuario o nombre...')).toBeNull();
  });

  it('renders RESTRICTED ACCESS (unauthorized) state exclusively when isMaster is false', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authenticated: true,
        user: { permissions: { isMaster: false } },
      }),
    });

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Acceso Restringido')).toBeDefined();
    });

    expect(screen.queryByText('Validando credenciales de seguridad...')).toBeNull();
    expect(screen.queryByText('Error al Cargar Usuarios')).toBeNull();
    expect(screen.queryByPlaceholderText('Buscar usuario o nombre...')).toBeNull();
  });

  it('renders ERROR state exclusively with retry button when API fails', async () => {
    // Auth succeeds
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authenticated: true,
        user: { permissions: { isMaster: true } },
      }),
    });
    // getUsers fails
    const mockGetUsers = vi.spyOn(usersClient, 'getUsers');
    mockGetUsers.mockRejectedValueOnce(new Error('Conexión con Turso falló'));

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Error al Cargar Usuarios')).toBeDefined();
    });

    expect(screen.getByText(/Conexión con Turso falló/)).toBeDefined();
    expect(screen.getByText('Reintentar Conexión')).toBeDefined();

    expect(screen.queryByText('Validando credenciales de seguridad...')).toBeNull();
    expect(screen.queryByText('Acceso Restringido')).toBeNull();
    expect(screen.queryByPlaceholderText('Buscar usuario o nombre...')).toBeNull();
  });

  it('renders EMPTY state row in table exclusively when fetch succeeds but returns 0 users', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authenticated: true,
        user: { permissions: { isMaster: true } },
      }),
    });
    
    const mockGetUsers = vi.spyOn(usersClient, 'getUsers');
    mockGetUsers.mockResolvedValueOnce([]);

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Buscar usuario o nombre...')).toBeDefined();
    });

    expect(screen.getByText('No se encontraron usuarios registrados.')).toBeDefined();
    
    expect(screen.queryByText('Validando credenciales de seguridad...')).toBeNull();
    expect(screen.queryByText('Acceso Restringido')).toBeNull();
    expect(screen.queryByText('Error al Cargar Usuarios')).toBeNull();
  });

  it('renders SUCCESS state table rows exclusively when fetch succeeds and returns users list', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        authenticated: true,
        user: { permissions: { isMaster: true } },
      }),
    });

    const mockUsers = [
      { id: '1', username: 'tech1', fullname: 'Marcelo Gómez', email: 'mgomez@test.com', role: 'tecnico', active: 1, phone: null, whatsapp: null },
    ];
    
    const mockGetUsers = vi.spyOn(usersClient, 'getUsers');
    mockGetUsers.mockResolvedValueOnce(mockUsers);

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Buscar usuario o nombre...')).toBeDefined();
    });

    expect(screen.getByText('Marcelo Gómez')).toBeDefined();
    expect(screen.getByText('tech1')).toBeDefined();
    expect(screen.getByText('mgomez@test.com')).toBeDefined();

    expect(screen.queryByText('No se encontraron usuarios registrados.')).toBeNull();
    expect(screen.queryByText('Validando credenciales de seguridad...')).toBeNull();
    expect(screen.queryByText('Acceso Restringido')).toBeNull();
    expect(screen.queryByText('Error al Cargar Usuarios')).toBeNull();
  });
});
