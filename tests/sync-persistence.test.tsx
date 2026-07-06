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
});
