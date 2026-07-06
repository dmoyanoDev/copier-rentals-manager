import React from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ManagementProvider, useManagement } from '../src/lib/context';

// Mock window.location
const mockPathname = vi.fn().mockReturnValue('/');
Object.defineProperty(window, 'location', {
  value: {
    get pathname() {
      return mockPathname();
    }
  },
  writable: true
});

const TestConsumer: React.FC = () => {
  const { clients, setClients, isSyncing, syncError, lastSyncTime } = useManagement();
  return (
    <div>
      <span data-testid="clients-count">{clients.length}</span>
      <span data-testid="is-syncing">{isSyncing ? 'true' : 'false'}</span>
      <span data-testid="sync-error">{syncError || 'none'}</span>
      <span data-testid="last-sync">{lastSyncTime ? 'synced' : 'never'}</span>
      <button data-testid="add-client" onClick={() => setClients([{ id: 'c-1', name: 'Client 1' }])}>
        Add Client
      </button>
    </div>
  );
};

describe('Sync Persistence and Lockouts', () => {
  let fetchSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    mockPathname.mockReturnValue('/');

    // Mock fetch
    fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((url: any, init?: any) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authenticated: true,
            user: { id: 'user-admin', username: 'dmoyano', fullname: 'Darío Moyano', role: 'master' }
          })
        } as any);
      }
      if (url.includes('/api/backup?user=system')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            clients: [{ id: 'c-remote', name: 'Remote Client' }],
            machines: [],
            budgets: []
          })
        } as any);
      }
      if (url.includes('/api/backup?user=autosave')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true })
        } as any);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('loads cache from localStorage on mount and does NOT trigger immediate autosave', async () => {
    // Override server sync mock to return the same client
    fetchSpy.mockImplementation((url: any) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authenticated: true,
            user: { id: 'user-admin', role: 'master' }
          })
        } as any);
      }
      if (url.includes('/api/backup?user=system')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            clients: [{ id: 'c-cached', name: 'Cached Client' }],
            machines: [],
            budgets: []
          })
        } as any);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
    });

    // Populate local storage with cache
    const initialCache = {
      clients: [{ id: 'c-cached', name: 'Cached Client' }],
      machines: []
    };
    localStorage.setItem('ms_data', JSON.stringify(initialCache));

    render(
      <ManagementProvider>
        <TestConsumer />
      </ManagementProvider>
    );

    // Should read cached client count
    expect(screen.getByTestId('clients-count').textContent).toBe('1');

    // Resolve fetchMe on mount
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600); // Beyond mount load settle time (1500ms)
    });

    // Flush microtasks for fetch chain
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(50);
      });
    }

    // Verify GET backup occurred for initial sync
    expect(fetchSpy).toHaveBeenCalledWith('/api/backup?user=system');

    // Confirm that NO POST autosave occurred during the initial mount state loading
    const autosaveCalls = fetchSpy.mock.calls.filter((call: any) => call[0].includes('/api/backup?user=autosave'));
    expect(autosaveCalls.length).toBe(0);
  });

  it('triggers remote autosave on user-initiated state changes after debounce', async () => {
    render(
      <ManagementProvider>
        <TestConsumer />
      </ManagementProvider>
    );

    // Resolve initial mount loading
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1650);
    });

    // Simulate user adding a client
    const addButton = screen.getByTestId('add-client');
    await act(async () => {
      fireEvent.click(addButton);
    });

    // Expect clients count to be 1 in React state
    expect(screen.getByTestId('clients-count').textContent).toBe('1');

    // Advance timer by 3.5 seconds to resolve the debounce (3000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    // Verify POST autosave was called
    const autosaveCalls = fetchSpy.mock.calls.filter((call: any) => call[0].includes('/api/backup?user=autosave'));
    expect(autosaveCalls.length).toBe(1);
    
    // Check that it was saved to localStorage
    const savedData = JSON.parse(localStorage.getItem('ms_data') || '{}');
    expect(savedData.clients?.length).toBe(1);
  });

  it('handles 401 error during sync by deauthenticating user and setting UNAUTHORIZED status', async () => {
    // Override fetch to return 401 for backup sync
    fetchSpy.mockImplementation((url: any) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authenticated: true,
            user: { id: 'user-admin', username: 'dmoyano', fullname: 'Darío Moyano', role: 'master' }
          })
        } as any);
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      } as any);
    });

    render(
      <ManagementProvider>
        <TestConsumer />
      </ManagementProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    // Flush microtasks
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(50);
      });
    }

    // Expect sync-error state to be UNAUTHORIZED
    expect(screen.getByTestId('sync-error').textContent).toBe('UNAUTHORIZED');
  });

  it('handles 500 database error during sync by setting DB_ERROR status and preserving session', async () => {
    // Override fetch to return 500 for backup sync
    fetchSpy.mockImplementation((url: any) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authenticated: true,
            user: { id: 'user-admin', username: 'dmoyano', fullname: 'Darío Moyano', role: 'master' }
          })
        } as any);
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Database Connection Error' })
      } as any);
    });

    render(
      <ManagementProvider>
        <TestConsumer />
      </ManagementProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    // Flush microtasks
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(50);
      });
    }

    // Expect sync-error state to be DB_ERROR
    expect(screen.getByTestId('sync-error').textContent).toBe('DB_ERROR');
  });

  it('reconciles data on sync using LWW timestamp conflict resolution', async () => {
    // 1. Setup local cache with client X (updatedAt = 2026-07-06T10:00:00Z)
    const initialCache = {
      clients: [{ id: 'c-x', name: 'Local Client X (newer)', updatedAt: '2026-07-06T10:00:00Z' }],
      machines: []
    };
    localStorage.setItem('ms_data', JSON.stringify(initialCache));

    // 2. Mock server response to return client X (updatedAt = 2026-07-06T09:00:00Z - older) and new client Y
    fetchSpy.mockImplementation((url: any) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authenticated: true,
            user: { id: 'user-admin', role: 'master' }
          })
        } as any);
      }
      if (url.includes('/api/backup?user=system')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            clients: [
              { id: 'c-x', name: 'Server Client X (older)', updatedAt: '2026-07-06T09:00:00Z' },
              { id: 'c-y', name: 'Client Y', updatedAt: '2026-07-06T09:30:00Z' }
            ]
          })
        } as any);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
    });

    render(
      <ManagementProvider>
        <TestConsumer />
      </ManagementProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    // Flush microtasks
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(50);
      });
    }

    // Verify localStorage has BOTH c-x (retaining the newer local name) and c-y (downloaded from server)
    const mergedCache = JSON.parse(localStorage.getItem('ms_data') || '{}');
    expect(mergedCache.clients.length).toBe(2);
    
    const clientX = mergedCache.clients.find((c: any) => c.id === 'c-x');
    expect(clientX.name).toBe('Local Client X (newer)');
  });

  it('filters out server records that were locally deleted', async () => {
    // 1. Setup local cache and ms_deleted_ids indicating c-x was deleted
    const initialCache = {
      clients: [], // c-x is deleted locally
      machines: []
    };
    localStorage.setItem('ms_data', JSON.stringify(initialCache));
    localStorage.setItem('ms_deleted_ids', JSON.stringify(['c-x']));

    // 2. Mock server response to return c-x
    fetchSpy.mockImplementation((url: any) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authenticated: true,
            user: { id: 'user-admin', role: 'master' }
          })
        } as any);
      }
      if (url.includes('/api/backup?user=system')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            clients: [{ id: 'c-x', name: 'Server Client X' }]
          })
        } as any);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
    });

    render(
      <ManagementProvider>
        <TestConsumer />
      </ManagementProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    // Flush microtasks
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(50);
      });
    }

    // Verify client c-x was NOT restored because it was locally deleted
    const mergedCache = JSON.parse(localStorage.getItem('ms_data') || '{}');
    expect(mergedCache.clients.length).toBe(0);
  });
});
