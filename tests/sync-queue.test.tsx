import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ManagementProvider, useManagement } from '../src/lib/context';

const SyncQueueTestConsumer: React.FC = () => {
  const { clients, setClients, isSyncing, syncError, lastSyncTime, syncQueue, processSyncQueue } = useManagement();
  return (
    <div>
      <span data-testid="clients-count">{clients.length}</span>
      <span data-testid="queue-count">{syncQueue ? syncQueue.length : 0}</span>
      <span data-testid="pending-count">
        {syncQueue ? syncQueue.filter((i: any) => i.status === 'pending' || i.status === 'failed').length : 0}
      </span>
      <span data-testid="syncing-count">
        {syncQueue ? syncQueue.filter((i: any) => i.status === 'syncing').length : 0}
      </span>
      <span data-testid="sync-error">{syncError || 'none'}</span>
      <button data-testid="add-client" onClick={() => setClients([{ id: 'c-test', name: 'Client Test', updatedAt: new Date().toISOString() }])}>
        Add Client
      </button>
      <button data-testid="manual-sync" onClick={() => processSyncQueue()}>
        Manual Sync
      </button>
    </div>
  );
};

describe('Robust Sync Queue and Persistence Tests', () => {
  let fetchSpy: any;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();

    // Prevent loading mock database fallback data by writing empty lists to localStorage on mount
    const emptyCache = {
      clients: [],
      machines: [],
      readings: [],
      tickets: [],
      abonos: [],
      users: [],
      rentals: [],
      budgets: []
    };
    localStorage.setItem('ms_data', JSON.stringify(emptyCache));

    // Mock fetch default implementation
    fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((url: any, init?: any) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authenticated: true,
            user: { id: 'user-admin', username: 'dmoyano', role: 'master' }
          })
        } as any);
      }
      if (url.includes('/api/backup')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            clients: [],
            machines: [],
            budgets: []
          })
        } as any);
      }
      if (url.includes('/api/sync/process')) {
        const body = JSON.parse(init.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            results: body.items.map((item: any) => ({ id: item.id, status: 'synced' }))
          })
        } as any);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('enqueues a change when local state is updated', async () => {
    render(
      <ManagementProvider>
        <SyncQueueTestConsumer />
      </ManagementProvider>
    );

    // Settle mounting, fetchMe and syncing status settle timer
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // Simulate user adding a client
    const addButton = screen.getByTestId('add-client');
    await act(async () => {
      fireEvent.click(addButton);
    });

    // Advance timer to let background sync processing fetch chain resolve
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Verify UI reflects the change locally
    expect(screen.getByTestId('clients-count').textContent).toBe('1');

    // Verify Drizzle sync route was called with the enqueued item payload
    const syncCalls = fetchSpy.mock.calls.filter((call: any) => call[0].includes('/api/sync/process'));
    expect(syncCalls.length).toBe(1);
  });

  it('keeps changes as pending in the queue if the remote sync fails', async () => {
    // Mock sync/process route to fail with offline error
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
      if (url.includes('/api/sync/process')) {
        return Promise.reject(new Error("Network Error"));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
    });

    render(
      <ManagementProvider>
        <SyncQueueTestConsumer />
      </ManagementProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // Add a client to trigger enqueuing and processing attempt
    const addButton = screen.getByTestId('add-client');
    await act(async () => {
      fireEvent.click(addButton);
    });

    // Advance timer to let request resolve/fail
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // The item should still be in the queue with status 'failed' (counted as pending)
    expect(screen.getByTestId('pending-count').textContent).toBe('1');
    expect(screen.getByTestId('sync-error').textContent).toBe('OFFLINE');
  });

  it('synchronizes pending queue when sync triggers again successfully', async () => {
    // 1. Setup fetch to reject sync/process initially (offline)
    fetchSpy.mockImplementation((url: any, init?: any) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authenticated: true,
            user: { id: 'user-admin', role: 'master' }
          })
        } as any);
      }
      if (url.includes('/api/sync/process')) {
        return Promise.reject(new Error("Network Error"));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
    });

    // Write failed queue item directly into localStorage to simulate previous offline session
    const failedQueueItem = [{
      id: 'q-offline-1',
      entityId: 'c-offline-1',
      entityType: 'clients',
      operation: 'create',
      payload: { id: 'c-offline-1', name: 'Offline Client' },
      updatedAt: new Date().toISOString(),
      status: 'failed',
      retryCount: 1
    }];
    localStorage.setItem('ms_sync_queue', JSON.stringify(failedQueueItem));

    render(
      <ManagementProvider>
        <SyncQueueTestConsumer />
      </ManagementProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // Verify item was loaded from cache and is marked as pending
    expect(screen.getByTestId('pending-count').textContent).toBe('1');
    expect(screen.getByTestId('sync-error').textContent).toBe('OFFLINE');

    // 2. Restore connectivity (mock sync/process succeeds)
    fetchSpy.mockImplementation((url: any, init?: any) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authenticated: true,
            user: { id: 'user-admin', role: 'master' }
          })
        } as any);
      }
      if (url.includes('/api/sync/process')) {
        const body = JSON.parse(init.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            results: body.items.map((item: any) => ({ id: item.id, status: 'synced' }))
          })
        } as any);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
    });

    // Trigger manual sync to flush queue
    const syncButton = screen.getByTestId('manual-sync');
    await act(async () => {
      fireEvent.click(syncButton);
    });

    // Wait for async processing
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Queue should now be empty (flushed successfully)
    expect(screen.getByTestId('queue-count').textContent).toBe('0');
    expect(screen.getByTestId('sync-error').textContent).toBe('none');
  });
});
