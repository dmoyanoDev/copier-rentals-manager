'use client';
// M&S Tecnología Digital - Management Provider - Sync Engine and State Core

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
    Client,
    Machine,
    Reading,
    Ticket,
    User,
    Abono,
    Rental
} from '@/domain/types';
import { Budget, BudgetTemplate, MachinePreset } from '@/domain/budget/types';
import { BRANDING } from '@/config/branding';
import type { SyncQueueItem, SyncEntityType } from '@/domain/types';
import { MAX_SYNC_QUEUE_SIZE, MAX_SYNC_RETRIES, SYNC_DEBOUNCE_MS, SYNC_POLL_INTERVAL_MS } from '@/domain/types';
import { showSaveSuccess, showSaveError, showOffline } from '@/components/ui/toast';
// Import shared domain types — single source of truth
export type { Gestion, CobranzaConfig, Payment } from '@/domain/types';
import type { Gestion, CobranzaConfig, Payment } from '@/domain/types';

// Extend Client interface locally
export interface LocalClient extends Client {
    cobranzaNotas?: string;
}



export const defaultCobranzaConfig: CobranzaConfig = {
    diasAvisoVencimiento: 3,
    montoMinimoAlerta: 50000,
    diasMoraCritica: 15,
    plantillaEmail: `Estimado cliente,\n\nLe recordamos que posee un saldo pendiente de {monto_saldo} de los cuales {monto_vencido} se encuentran vencidos.\n\nPor favor regularice su cuenta.\n\n${BRANDING.commercialName}`,
    plantillaWhatsapp: `Hola! Te compartimos el aviso de cuenta corriente de ${BRANDING.commercialName}. Tu saldo pendiente es {monto_saldo}. Comprobantes impagos: {cant_impagos}.`,
    
    plantillaPreventivoEmail: `Estimado cliente,\n\nLe recordamos preventivamente que posee facturas próximas a vencer por un total de {monto_saldo}.\n\nAtentamente,\n${BRANDING.commercialName}`,
    plantillaPreventivoWhatsapp: `Hola! Te recordamos preventivamente que tu factura de ${BRANDING.commercialName} por {monto_saldo} está próxima a vencer. ¡Que tengas un buen día!`,
    plantillaDeudaVencidaEmail: `Estimado cliente,\n\nLe informamos que registra comprobantes vencidos impagos por un total de {monto_vencido}. Solicitamos regularizar su situación a la brevedad.\n\nAtentamente,\n${BRANDING.commercialName}`,
    plantillaDeudaVencidaWhatsapp: 'Hola! Tu cuenta presenta un saldo vencido de {monto_vencido}. Agradecemos coordinar el pago a la brevedad para evitar recargos.',
    plantillaSegundoAvisoEmail: `IMPORTANTE: SEGUNDO AVISO DE DEUDA\n\nEstimado cliente,\n\nReiteramos aviso por saldo impago de {monto_vencido} con mora acumulada. Por favor, comuníquese con administración.\n\nAtentamente,\n${BRANDING.commercialName}`,
    plantillaSegundoAvisoWhatsapp: '⚠️ SEGUNDO AVISO: Aún no registramos el pago de tu saldo de {monto_vencido}. Por favor, envíanos el comprobante si ya transferiste.',
    plantillaPagoRecibidoEmail: `Estimado cliente,\n\nConfirmamos la recepción del pago por un importe de {monto_pago}. Agradecemos su puntualidad.\n\nAtentamente,\n${BRANDING.commercialName}`,
    plantillaPagoRecibidoWhatsapp: '✅ Pago recibido! Confirmamos la acreditación de tu pago por {monto_pago}. Muchas gracias por tu confianza.',

    sonidosActivos: true,
    volumenSonidos: 50,
    autoAlertasActivas: true
};

const defaultGestiones: Gestion[] = [
    {
        id: 'g-1',
        clientId: 'c-2',
        date: '2026-07-01',
        type: 'WhatsApp',
        user: 'Administrador',
        channel: 'WhatsApp Web',
        result: 'Enviado',
        observations: 'Aviso preventivo de cuenta corriente.'
    },
    {
        id: 'g-2',
        clientId: 'c-4',
        date: '2026-07-02',
        type: 'Llamado',
        user: 'Administrador',
        channel: 'Teléfono',
        result: 'Promesa de pago',
        observations: 'El cliente se comprometió a pagar la totalidad la semana entrante.'
    }
];

interface ManagementContextType {
    currentMonth: string;
    setCurrentMonth: (month: string) => void;
    currentUser: User | null;
    setCurrentUser: (user: User | null) => void;
    clients: LocalClient[];
    setClients: React.Dispatch<React.SetStateAction<LocalClient[]>>;
    machines: Machine[];
    setMachines: React.Dispatch<React.SetStateAction<Machine[]>>;
    readings: Reading[];
    setReadings: React.Dispatch<React.SetStateAction<Reading[]>>;
    tickets: Ticket[];
    setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>;
    abonos: Abono[];
    setAbonos: React.Dispatch<React.SetStateAction<Abono[]>>;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    rentals: Rental[];
    setRentals: React.Dispatch<React.SetStateAction<Rental[]>>;
    
    // Budgets layer
    budgets: Budget[];
    setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>;
    templates: BudgetTemplate[];
    machinePresets: MachinePreset[];

    // Cobranza Additions
    gestiones: Gestion[];
    setGestiones: React.Dispatch<React.SetStateAction<Gestion[]>>;
    cobranzaConfig: CobranzaConfig;
    payments: Payment[];
    setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;

    // Cloud Database Sync Additions
    isSyncing: boolean;
    syncError: string | null;
    lastSyncTime: Date | null;
    syncFromDatabase: (forceUser?: User | null, forceRetry?: boolean) => Promise<void>;
    syncQueue: SyncQueueItem[];
    processSyncQueue: (passedQueue?: SyncQueueItem[]) => Promise<void>;
    resetSyncAction: () => Promise<void>;

    // Action-Driven mutations
    addRentalAction: (rental: Rental, machineUpdates: { id: string; clientId: string | null; abonoId: string | null; status: Machine['status'] }[], finalizeRentalIds?: string[]) => void;
    updateRentalAction: (rental: Rental, machineUpdates?: { id: string; clientId: string | null; abonoId: string | null; status: Machine['status'] }[]) => void;
    updateTicketAction: (ticket: Ticket, machineUpdate?: { id: string; status: Machine['status'] }) => void;
    addReadingAction: (reading: Reading, machineUpdate?: { id: string; currentCounter: number }, operation?: 'create' | 'update' | 'delete') => void;
    updateClientAction: (client: Client, operation?: 'create' | 'update' | 'delete') => void;
    updateMachineAction: (machine: Machine, operation?: 'create' | 'update' | 'delete') => void;
    updateAbonoAction: (abono: Abono, operation?: 'create' | 'update' | 'delete') => void;
    addBudgetAction: (budget: Budget, operation?: 'create' | 'update' | 'delete') => void;
    updateUserAction: (user: User, operation?: 'create' | 'update' | 'delete') => void;
    // Cobranza actions — backed by Turso
    addGestionAction: (gestion: Gestion, operation?: 'create' | 'update' | 'delete') => void;
    updateCobranzaConfigAction: (config: CobranzaConfig) => void;
    addPaymentAction: (payment: Payment, operation?: 'create' | 'update' | 'delete') => void;
    // Budget catalog actions — backed by Turso (antes vivían solo en localStorage)
    addMachinePresetAction: (preset: MachinePreset, operation?: 'create' | 'update' | 'delete') => void;
    addTemplateAction: (template: BudgetTemplate, operation?: 'create' | 'update' | 'delete') => void;
    // For bulk operations (e.g. CSV import) that already computed and set their own local
    // array via setClients/setMachines/etc — enqueues each item's sync individually instead
    // of going through the single-item *Action helpers, which would each redundantly
    // recompute the whole array from stateRef.current (stale until next render) and end up
    // only keeping the LAST item of the batch in local state until the next sync poll.
    bulkSyncAction: (
        items: { id: string; entityType: SyncEntityType; operation: 'create' | 'update' | 'delete'; payload: any }[],
        localStorageUpdate?: Partial<{ clients: Client[]; machines: Machine[]; readings: Reading[]; tickets: Ticket[]; abonos: Abono[]; users: User[]; rentals: Rental[]; budgets: Budget[]; }>
    ) => void;
}

const trackDeletions = (newState: any) => {
    if (typeof window === 'undefined') return;
    try {
        const rawLocal = localStorage.getItem('ms_data');
        if (!rawLocal) return;
        const oldState = JSON.parse(rawLocal);
        
        const tables = ['clients', 'machines', 'readings', 'tickets', 'abonos', 'users', 'rentals', 'budgets'];
        let deletedIds: string[] = [];
        try {
            deletedIds = JSON.parse(localStorage.getItem('ms_deleted_ids') || '[]');
        } catch (e) {
            deletedIds = [];
        }
        
        let changed = false;
        for (const table of tables) {
            const oldList = oldState[table] || [];
            const newList = newState[table] || [];
            
            const newIds = new Set(newList.map((item: any) => item.id));
            for (const oldItem of oldList) {
                if (oldItem.id && !newIds.has(oldItem.id)) {
                    if (!deletedIds.includes(oldItem.id)) {
                        deletedIds.push(oldItem.id);
                        changed = true;
                    }
                }
            }
        }
        
        if (changed) {
            localStorage.setItem('ms_deleted_ids', JSON.stringify(deletedIds));
        }
    } catch (e) {
        console.error("Error tracking deletions:", e);
    }
};

const autoTimestampState = (newState: any) => {
    if (typeof window === 'undefined') return newState;
    try {
        const rawLocal = localStorage.getItem('ms_data');
        if (!rawLocal) return newState;
        const oldState = JSON.parse(rawLocal);
        
        const tables = ['clients', 'machines', 'readings', 'tickets', 'abonos', 'users', 'rentals', 'budgets'];
        const updatedState = { ...newState };
        
        for (const table of tables) {
            const oldList = oldState[table] || [];
            const newList = newState[table] || [];
            
            const oldMap = new Map<string, any>(oldList.map((item: any) => [item.id, item]));
            
            const updatedList = newList.map((newItem: any) => {
                const oldItem = oldMap.get(newItem.id);
                if (!oldItem) {
                    return {
                        ...newItem,
                        createdAt: newItem.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                }
                
                const newItemCompare = { ...newItem, updatedAt: undefined, createdAt: undefined };
                const oldItemCompare = { ...oldItem, updatedAt: undefined, createdAt: undefined };
                
                if (JSON.stringify(newItemCompare) !== JSON.stringify(oldItemCompare)) {
                    return {
                        ...newItem,
                        updatedAt: new Date().toISOString()
                    };
                }
                
                return newItem;
            });
            
            updatedState[table] = updatedList;
        }
        
        return updatedState;
    } catch (e) {
        console.error("Error auto-timestamping state:", e);
        return newState;
    }
};

// GET /api/backup always returns the COMPLETE list for these two tables, never filtered
// by `since` (see backup/route.ts) — they're small catalogs that can be seeded with a
// fixed past timestamp, so an incremental filter would let an already-advanced device's
// cursor permanently miss rows seeded/changed before it. Because their server list is
// always the full truth, "missing from it" always means genuinely gone, never "just not
// in this delta" — the isIncremental fallback below must not apply to them (see its
// comment for what breaks otherwise: a delete resurrected by one stale in-flight poll
// becomes permanent once the tombstone's short incremental window passes).
const FULLY_FETCHED_TABLES = new Set(['templates', 'machinePresets']);

const mergeData = (local: any, server: any, lastSyncTime: Date | null, isIncremental: boolean = false, tombstonesByTable: Record<string, string[]> = {}, discardLocalOnly: boolean = false) => {
    const merged = { ...local };
    const tables = ['clients', 'machines', 'readings', 'tickets', 'abonos', 'users', 'rentals', 'budgets', 'gestiones', 'payments', 'templates', 'machinePresets'];
    const lastSync = lastSyncTime ? lastSyncTime.getTime() : 0;

    let deletedIds: string[] = [];
    if (typeof window !== 'undefined') {
        try {
            deletedIds = JSON.parse(localStorage.getItem('ms_deleted_ids') || '[]');
        } catch (e) {
            deletedIds = [];
        }
    }
    const deletedSet = new Set(deletedIds);

    for (const table of tables) {
        const localList = local[table] || [];
        let serverList = server[table] || [];
        if (table === 'abonos' && !server.abonos && server.plans) {
            serverList = server.plans;
        }

        const localMap = new Map<string, any>(localList.map((item: any) => [item.id, item]));
        const serverMap = new Map<string, any>(serverList.map((item: any) => [item.id, item]));
        const tombstoneSet = new Set(tombstonesByTable[table] || []);

        const mergedList = [];

        // 1. Process all local items
        for (const localItem of localList) {
            const serverItem: any = serverMap.get(localItem.id);
            if (!serverItem) {
                if (tombstoneSet.has(localItem.id)) {
                    // Another device deleted this entity — the server confirmed it via
                    // a tombstone, so drop it locally instead of assuming "unchanged".
                    continue;
                }
                // Only exists locally.
                if (discardLocalOnly) {
                    // Explicit "Restablecer": the user asked to discard unsynced local
                    // changes and trust the cloud as-is. Without this, a row deleted
                    // server-side through a path that skipped the tombstone table (e.g.
                    // a manual DB fix) would look identical to a genuine unsynced local
                    // edit and survive every future reset forever.
                    continue;
                } else if (isIncremental && !FULLY_FETCHED_TABLES.has(table)) {
                    // Incremental sync: keep local item — server didn't return it so it hasn't changed remotely
                    mergedList.push(localItem);
                } else {
                    const localTime = localItem.updatedAt || localItem.createdAt
                        ? new Date(localItem.updatedAt || localItem.createdAt).getTime()
                        : 0;
                    if (localTime > lastSync) {
                        mergedList.push(localItem);
                    }
                }
            } else if (discardLocalOnly) {
                // Exists in both, but this is an explicit reset — trust the cloud
                // version outright instead of Last-Write-Wins, matching the "discard
                // local changes" promise the user already confirmed.
                mergedList.push(serverItem);
            } else {
                // Exists in both. Use Last-Write-Wins based on timestamps.
                const localTime = localItem.updatedAt || localItem.createdAt
                    ? new Date(localItem.updatedAt || localItem.createdAt).getTime()
                    : 0;
                const serverTime = new Date(serverItem.updatedAt || serverItem.createdAt || 0).getTime();
                if (localTime > serverTime) {
                    mergedList.push(localItem);
                } else {
                    mergedList.push(serverItem);
                }
            }
        }
        
        // 2. Add server items not present locally
        for (const serverItem of serverList) {
            if (!localMap.has(serverItem.id)) {
                if (!deletedSet.has(serverItem.id)) {
                    mergedList.push(serverItem);
                }
            }
        }
        
        merged[table] = mergedList;
    }
    
    return merged;
};

const ManagementContext = createContext<ManagementContextType | undefined>(undefined);


export const ManagementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentMonth, setCurrentMonth] = useState('');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [clients, setClients] = useState<LocalClient[]>([]);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [readings, setReadings] = useState<Reading[]>([]);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [abonos, setAbonos] = useState<Abono[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [rentals, setRentals] = useState<Rental[]>([]);
    
    // Budgets states
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [templates, setTemplates] = useState<BudgetTemplate[]>([]);
    const [machinePresets, setMachinePresets] = useState<MachinePreset[]>([]);

    // Cobranza states
    const [gestiones, setGestiones] = useState<Gestion[]>([]);
    const [cobranzaConfig, setCobranzaConfig] = useState<CobranzaConfig>(defaultCobranzaConfig);
    const [payments, setPayments] = useState<Payment[]>([]);

    // Sync States
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);

    const isSyncingRef = useRef(false);
    const isInitialLoadDoneRef = useRef(false);
    const isProcessingQueueRef = useRef(false);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const hasSyncQueueFailedRef = useRef(false);

    // Use refs to always have current state values available to callbacks without stale closures
    const stateRef = useRef({
        clients: [] as LocalClient[],
        machines: [] as Machine[],
        readings: [] as Reading[],
        tickets: [] as Ticket[],
        abonos: [] as Abono[],
        users: [] as User[],
        rentals: [] as Rental[],
        budgets: [] as Budget[],
        gestiones: [] as Gestion[],
        payments: [] as Payment[],
        templates: [] as BudgetTemplate[],
        machinePresets: [] as MachinePreset[],
        currentUser: null as User | null,
        lastSyncTime: null as Date | null,
    });

    // Keep stateRef current
    useEffect(() => {
        stateRef.current = {
            clients, machines, readings, tickets, abonos, users, rentals, budgets, gestiones, payments,
            templates, machinePresets,
            currentUser, lastSyncTime,
        };
    });

    const getStoredQueue = (): SyncQueueItem[] => {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem('ms_sync_queue');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    };

    const saveStoredQueue = (queue: SyncQueueItem[]) => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem('ms_sync_queue', JSON.stringify(queue));
        } catch (e) {
            // localStorage full — evict oldest synced items and retry
            console.error("localStorage quota exceeded, evicting old queue items:", e);
            const trimmed = queue.filter(item => item.status !== 'synced').slice(-MAX_SYNC_QUEUE_SIZE);
            localStorage.setItem('ms_sync_queue', JSON.stringify(trimmed));
        }
    };

    const processSyncQueue = useCallback(async (passedQueue?: SyncQueueItem[]) => {
        if (isProcessingQueueRef.current) return;
        hasSyncQueueFailedRef.current = false;
        
        const queueToProcess = passedQueue || getStoredQueue();
        const pendingItems = queueToProcess.filter((item) => 
            (item.status === 'pending' || item.status === 'failed') && item.retryCount < MAX_SYNC_RETRIES
        );
        
        if (pendingItems.length === 0) return;
        
        isProcessingQueueRef.current = true;
        let succeeded = false;
        setSyncError(null);
        
        // Update items to 'syncing' status
        const updatedQueue = queueToProcess.map((item) => {
            if ((item.status === 'pending' || item.status === 'failed') && item.retryCount < MAX_SYNC_RETRIES) {
                return { ...item, status: 'syncing' as const };
            }
            return item;
        });
        saveStoredQueue(updatedQueue);
        setSyncQueue(updatedQueue);

        // Sort items by relational dependency order before sending
        const ENTITY_TYPE_ORDER: Record<string, number> = {
            users: 0,
            clients: 1,
            plans: 2,
            abonos: 2,
            machines: 3,
            readings: 4,
            rentals: 5,
            tickets: 6,
            budgets: 7,
            payments: 8,        // must be after clients and readings (FK on both)
            gestiones: 9,       // must be after clients (FK on client_id)
            cobranzaConfig: 10, // standalone singleton
        };

        const getOrder = (item: SyncQueueItem) => {
            const baseOrder = ENTITY_TYPE_ORDER[item.entityType] ?? 99;
            if (item.operation === 'delete') {
                return 100 - baseOrder;
            }
            return baseOrder;
        };

        const sortedPendingItems = [...pendingItems].sort((a, b) => {
            if (a.entityType === b.entityType && a.entityId === b.entityId) {
                return queueToProcess.indexOf(a) - queueToProcess.indexOf(b);
            }
            const orderA = getOrder(a);
            const orderB = getOrder(b);
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return queueToProcess.indexOf(a) - queueToProcess.indexOf(b);
        });

        try {
            const response = await fetch('/api/sync/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ items: sortedPendingItems })
            });

            if (response.status === 401) {
                setSyncError("UNAUTHORIZED");
                setCurrentUser(null);
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
                hasSyncQueueFailedRef.current = true;
                return;
            }

            if (!response.ok) {
                throw new Error("Sync API failed with status " + response.status);
            }

            const data = await response.json();
            if (data.success && Array.isArray(data.results)) {
                const resultsMap = new Map<string, any>(data.results.map((r: any) => [r.id, r]));
                
                const failedResults = data.results.filter((r: any) => r.status === 'failed');
                const syncedCount  = data.results.filter((r: any) => r.status === 'synced').length;

                const finalQueue = getStoredQueue().map((item) => {
                    const result: any = resultsMap.get(item.id);
                    if (result) {
                        if (result.status === 'synced') {
                            return { ...item, status: 'synced' as const };
                        } else {
                            return {
                                ...item,
                                status: 'failed' as const,
                                retryCount: item.retryCount + 1
                            };
                        }
                    }
                    return item;
                }).filter((item) => item.status !== 'synced');

                // Enforce queue size limit
                const trimmedQueue = finalQueue.slice(-MAX_SYNC_QUEUE_SIZE);
                
                saveStoredQueue(trimmedQueue);
                setSyncQueue(trimmedQueue);

                // Notify user of sync result
                if (failedResults.length > 0) {
                    const firstError = failedResults[0];
                    const reason = firstError.reason === 'validation_error'
                        ? 'Error de validacion de datos'
                        : firstError.message || firstError.reason || 'Error desconocido';
                    showSaveError(reason);
                } else if (syncedCount > 0) {
                    showSaveSuccess();
                }
                succeeded = true;
            } else {
                throw new Error("Invalid sync response format");
            }
        } catch (err: any) {
            console.error("Error processing sync queue:", err);
            const revertedQueue = getStoredQueue().map((item) => {
                if (item.status === 'syncing') {
                    return { ...item, status: 'failed' as const, retryCount: item.retryCount + 1 };
                }
                return item;
            });
            saveStoredQueue(revertedQueue);
            setSyncQueue(revertedQueue);
            setSyncError("OFFLINE");
            showOffline();
            hasSyncQueueFailedRef.current = true;
        } finally {
            isProcessingQueueRef.current = false;
            // Only retry immediately if the last processing was successful (to handle parallel insertions)
            if (succeeded) {
                const remainingQueue = getStoredQueue();
                const hasPending = remainingQueue.some(item => 
                    (item.status === 'pending' || item.status === 'failed') && item.retryCount < MAX_SYNC_RETRIES
                );
                if (hasPending) {
                    setTimeout(() => {
                        processSyncQueue();
                    }, 100);
                }
            }
        }
    }, []);

    // Fetch snapshot from backend database — uses stateRef to avoid stale closures
    const syncFromDatabase = useCallback(async (forceUser?: User | null, forceRetry: boolean = false, discardLocalOnly: boolean = false) => {
        const activeUser = forceUser !== undefined ? forceUser : stateRef.current.currentUser;
        if (!activeUser) {
            return;
        }

        if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            if (path.startsWith('/login') || path.startsWith('/forgot-password') || path.startsWith('/reset-password')) {
                return;
            }
        }

        // Prevent concurrent syncs
        if (isSyncingRef.current) return;

        // 1. Process pending items first if there are any to maintain strict sequential order
        let currentQueue = getStoredQueue();
        if (forceRetry) {
            currentQueue = currentQueue.map(item => {
                if (item.status === 'failed' || item.retryCount >= MAX_SYNC_RETRIES) {
                    return { ...item, status: 'pending' as const, retryCount: 0 };
                }
                return item;
            });
            saveStoredQueue(currentQueue);
            setSyncQueue(currentQueue);
        }

        const pendingItems = currentQueue.filter((item) =>
            (item.status === 'pending' || item.status === 'failed') && item.retryCount < MAX_SYNC_RETRIES
        );
        if (pendingItems.length > 0) {
            await processSyncQueue(currentQueue);
            // NOTE: previously this bailed out of the whole function (`return`) when the local
            // push failed, which meant a SINGLE stuck/failing item in this device's own write
            // queue permanently blocked it from ever pulling other devices' changes again — the
            // only way out was clearing localStorage (wiping the queue) to unblock it. Pushing
            // and pulling are independent concerns: a failed push already surfaces its own error
            // (processSyncQueue already called setSyncError/showOffline above), so it must not
            // also prevent the read-only GET refresh below from running.
        }

        isSyncingRef.current = true;
        setIsSyncing(true);
        try {
            // discardLocalOnly (an explicit "Restablecer") must always fetch the FULL
            // backup, never an incremental one — stateRef can still hold the previous
            // (stale) lastSyncTime for one tick after resetSyncAction's setLastSyncTime(null)
            // since it only updates via a useEffect, and an incremental fetch here would
            // return a partial dataset that then looks like everything else was deleted.
            let storedLastSync = discardLocalOnly ? null : stateRef.current.lastSyncTime;
            if (!storedLastSync && !discardLocalOnly && typeof window !== 'undefined') {
                try {
                    const raw = localStorage.getItem('ms_last_sync_time');
                    if (raw) storedLastSync = new Date(raw);
                } catch (e) {}
            }
            const sinceQuery = storedLastSync ? `&since=${encodeURIComponent(storedLastSync.toISOString())}` : '';
            const response = await fetch(`/api/backup?user=system${sinceQuery}`, {
                // Bypass browser cache entirely — critical for cross-device real-time sync
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store',
                    'Pragma': 'no-cache',
                }
            });
            const isIncremental = !!sinceQuery;

            if (response.ok) {
                const parsed = await response.json();
                
                // Always mark sync as successful if API returns 200.
                // Use the SERVER's clock for the sync cursor, not the browser's: every row's
                // updatedAt is stamped with server time (see sync/process/route.ts), so a
                // cursor built from this device's own Date() silently drifts by however much
                // its system clock is skewed. A client clock even slightly ahead of the server
                // meant this device's *next* incremental pull would ask for
                // `since=<a moment after the row's real server timestamp>` and permanently miss
                // it — refreshing never helps, because the bad cursor is what's persisted and
                // reused (ms_last_sync_time survives F5/Ctrl+F5, it's localStorage). Confirmed
                // as the cause of a real report: a rental created on the phone never appeared
                // on a notebook even after a hard refresh, despite being correctly saved.
                const now = parsed.backupMeta?.exportDate ? new Date(parsed.backupMeta.exportDate) : new Date();
                setLastSyncTime(now);
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.setItem('ms_last_sync_time', now.toISOString());
                    } catch (e) {}
                }
                // A successful PULL must not blindly erase a PUSH failure from the queue-processing
                // step above — they're independent requests, and this one succeeding says nothing
                // about whether this device's own pending edit actually reached the server. Only
                // clear the error if the queue is genuinely caught up; otherwise a stuck edit goes
                // completely invisible the moment the next ~1.5s poll's read half succeeds, which it
                // usually does even while the write half keeps failing.
                const stillPendingAfterPush = getStoredQueue().some(item =>
                    (item.status === 'pending' || item.status === 'failed') && item.retryCount < MAX_SYNC_RETRIES
                );
                if (!stillPendingAfterPush) {
                    setSyncError(null);
                }

                // Only overwrite if remote database contains actual data or it is an incremental sync
                const hasServerData =
                    isIncremental ||
                    discardLocalOnly ||
                    (parsed.clients && parsed.clients.length > 0) ||
                    (parsed.budgets && parsed.budgets.length > 0) ||
                    (parsed.machines && parsed.machines.length > 0);
                    
                if (hasServerData) {
                    // FIX: Use stateRef to get current state, not stale closure values
                    let currentLocalState: any = {
                        clients: stateRef.current.clients || [],
                        machines: stateRef.current.machines || [],
                        readings: stateRef.current.readings || [],
                        tickets: stateRef.current.tickets || [],
                        abonos: stateRef.current.abonos || [],
                        users: stateRef.current.users || [],
                        rentals: stateRef.current.rentals || [],
                        budgets: stateRef.current.budgets || [],
                        gestiones: stateRef.current.gestiones || [],
                        payments: stateRef.current.payments || [],
                        templates: stateRef.current.templates || [],
                        machinePresets: stateRef.current.machinePresets || []
                    };
                    if (!isInitialLoadDoneRef.current && typeof window !== 'undefined') {
                        try {
                            const raw = localStorage.getItem('ms_data');
                            if (raw) {
                                const parsedLocal = JSON.parse(raw);
                                currentLocalState = {
                                    clients: parsedLocal.clients || [],
                                    machines: parsedLocal.machines || [],
                                    readings: parsedLocal.readings || [],
                                    tickets: parsedLocal.tickets || [],
                                    abonos: parsedLocal.abonos || parsedLocal.plans || [],
                                    users: parsedLocal.users || [],
                                    rentals: parsedLocal.rentals || [],
                                    budgets: parsedLocal.budgets || [],
                                    gestiones: parsedLocal.gestiones || [],
                                    payments: parsedLocal.payments || [],
                                    templates: parsedLocal.templates || [],
                                    machinePresets: parsedLocal.machinePresets || []
                                };
                            }
                        } catch (e) {
                            console.error("Error reading localStorage in syncFromDatabase:", e);
                        }
                    }

                    // Group tombstones (entities hard-deleted since `since`) by table so
                    // mergeData can drop them locally instead of assuming "unchanged".
                    const tombstonesByTable: Record<string, string[]> = {};
                    for (const t of (parsed.tombstones || [])) {
                        const key = t.entityType === 'plans' ? 'abonos' : t.entityType;
                        (tombstonesByTable[key] ||= []).push(t.entityId);
                    }

                    const merged = mergeData(currentLocalState, parsed, stateRef.current.lastSyncTime, isIncremental, tombstonesByTable, discardLocalOnly);

                    setClients(merged.clients || []);
                    // Normalize DB field name 'machineCounter' → frontend field 'currentCounter'
                    setMachines((merged.machines || []).map((m: Machine & { machineCounter?: number }) => ({
                        ...m,
                        currentCounter: m.currentCounter ?? m.machineCounter ?? 0,
                    })));
                    setReadings(merged.readings || []);
                    setTickets(merged.tickets || []);
                    setAbonos(merged.abonos || []);
                    setUsers(merged.users || []);
                    if (merged.rentals) setRentals(merged.rentals);
                    setBudgets(merged.budgets || []);
                    setGestiones(merged.gestiones || []);
                    setPayments(merged.payments || []);
                    setTemplates(merged.templates || []);
                    setMachinePresets(merged.machinePresets || []);

                    if (parsed.cobranzaConfig) {
                        setCobranzaConfig({
                            ...defaultCobranzaConfig,
                            ...parsed.cobranzaConfig
                        });
                    }

                    const stateToSave = {
                        clients: merged.clients || [],
                        machines: merged.machines || [],
                        readings: merged.readings || [],
                        tickets: merged.tickets || [],
                        plans: merged.abonos || [],
                        abonos: merged.abonos || [],
                        users: merged.users || [],
                        rentals: merged.rentals || [],
                        budgets: merged.budgets || [],
                        templates: merged.templates || [],
                        machinePresets: merged.machinePresets || [],
                        gestiones: merged.gestiones || [],
                        payments: merged.payments || [],
                        cobranzaConfig: parsed.cobranzaConfig || cobranzaConfig || defaultCobranzaConfig
                    };
                    try {
                        localStorage.setItem('ms_data', JSON.stringify(stateToSave));
                    } catch (e) {}

                    // Reconciliation safety-net: only meaningful on a FULL sync. During an
                    // incremental sync, `parsed[table]` is just the tiny delta since last
                    // poll (often []), so comparing it against the full merged list would
                    // almost always "detect" a difference — triggering a full delete+reinsert
                    // of every table on every ~1.5s poll from every open device. That was
                    // hammering Turso and could resurrect items another device just deleted
                    // (this device's stale full snapshot overwriting the real deletion).
                    // Regular create/update/delete already goes through the per-item sync
                    // queue (processSyncQueue) regardless of this block.
                    if (!isIncremental) {
                        const tablesToCompare = ['clients', 'machines', 'readings', 'tickets', 'abonos', 'users', 'rentals', 'budgets', 'templates', 'machinePresets'];
                        let localChangesExist = false;
                        for (const table of tablesToCompare) {
                            const serverList = parsed[table] || (table === 'abonos' ? parsed.plans || [] : []);
                            const mergedList = merged[table] || [];
                            if (JSON.stringify(serverList) !== JSON.stringify(mergedList)) {
                                localChangesExist = true;
                                break;
                            }
                        }

                        // Push merged state back to server for all authenticated users.
                        // This ensures cross-device data is consistent regardless of user role.
                        if (localChangesExist) {
                            const mergedRaw = JSON.stringify(stateToSave);
                            fetch('/api/backup?user=autosave', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: mergedRaw
                            }).then((res) => {
                                if (res.ok) {
                                    localStorage.removeItem('ms_deleted_ids');
                                }
                            }).catch((err) => {
                                console.error("Error al persistir fusión en el servidor:", err);
                            });
                        }
                    }
                } else {
                    // The server database is clean/empty (hasServerData is false).
                    // If this client has local cache, automatically enqueue everything as 'create' to seed the remote DB.
                    const hasLocalCache = typeof window !== 'undefined' && localStorage.getItem('ms_data') !== null;
                    if (hasLocalCache) {
                        let currentLocalState: any = {
                            clients: [],
                            machines: [],
                            readings: [],
                            tickets: [],
                            abonos: [],
                            users: [],
                            rentals: [],
                            budgets: []
                        };
                        try {
                            const raw = localStorage.getItem('ms_data');
                            if (raw) {
                                const parsedLocal = JSON.parse(raw);
                                currentLocalState = {
                                    clients: parsedLocal.clients || [],
                                    machines: parsedLocal.machines || [],
                                    readings: parsedLocal.readings || [],
                                    tickets: parsedLocal.tickets || [],
                                    abonos: parsedLocal.abonos || parsedLocal.plans || [],
                                    users: parsedLocal.users || [],
                                    rentals: parsedLocal.rentals || [],
                                    budgets: parsedLocal.budgets || []
                                };
                            }
                        } catch (e) {}

                        if (currentLocalState.clients.length > 0 || currentLocalState.machines.length > 0 || currentLocalState.abonos.length > 0) {
                            const initialQueue: SyncQueueItem[] = [];
                            const nowStr = new Date().toISOString();
                            const tables: SyncEntityType[] = ['clients', 'machines', 'readings', 'tickets', 'abonos', 'users', 'rentals', 'budgets'];

                            for (const table of tables) {
                                const list = currentLocalState[table] || [];
                                for (const item of list) {
                                    if (table === 'users' && (item.id.startsWith('mock-') || item.id === 'user-admin' || item.username === 'dmoyano')) {
                                        continue;
                                    }
                                    initialQueue.push({
                                        id: crypto.randomUUID ? crypto.randomUUID() : 'q-seed-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
                                        entityId: item.id,
                                        entityType: table,
                                        operation: 'create',
                                        payload: item,
                                        updatedAt: item.updatedAt || nowStr,
                                        status: 'pending',
                                        retryCount: 0
                                    });
                                }
                            }

                            if (initialQueue.length > 0) {
                                const currentQueueStored = getStoredQueue();
                                const existingEntityIds = new Set(currentQueueStored.map((q) => q.entityId));
                                const itemsToAdd = initialQueue.filter(q => !existingEntityIds.has(q.entityId));

                                if (itemsToAdd.length > 0) {
                                    const updatedQueue = [...currentQueueStored, ...itemsToAdd].slice(-MAX_SYNC_QUEUE_SIZE);
                                    saveStoredQueue(updatedQueue);
                                    setSyncQueue(updatedQueue);
                                    processSyncQueue(updatedQueue);
                                }
                            }
                        }
                    }
                }
            } else {
                if (response.status === 401) {
                    setSyncError("UNAUTHORIZED");
                    setCurrentUser(null);
                    if (typeof window !== 'undefined') {
                        window.location.href = '/login';
                    }
                    return;
                }
                if (response.status === 500) {
                    setSyncError("DB_ERROR");
                    return;
                }
                throw new Error("HTTP error " + response.status);
            }
        } catch (err: any) {
            console.error("Error sincronizando de la base de datos:", err);
            if (err.message?.includes("HTTP error 401")) {
                setSyncError("UNAUTHORIZED");
                setCurrentUser(null);
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
            } else if (err.message?.includes("HTTP error 500")) {
                setSyncError("DB_ERROR");
            } else {
                setSyncError("OFFLINE");
            }
        } finally {
            setIsSyncing(false);
            // FIX: Reset immediately instead of using fragile setTimeout
            isSyncingRef.current = false;
        }
    }, [processSyncQueue]);

    const resetSyncAction = useCallback(async () => {
        setIsSyncing(true);
        try {
            // syncFromDatabase silently no-ops (isSyncingRef.current guard) if another
            // sync is already running — and the background poll fires every 1.5s, so
            // there's a real chance one is. isSyncingRef flips to true synchronously,
            // but the `disabled` prop on the Restablecer button only reflects it after
            // React re-renders, so a click can land in that gap and slip through to
            // here anyway. Without waiting it out, the call below would return
            // immediately having done nothing — local-only rows survive untouched —
            // while resetSyncAction still reports success. Confirmed live: a reset
            // that raced a background poll left stale local machines in place.
            const maxWaitMs = 5000;
            const waitStart = Date.now();
            while (isSyncingRef.current && Date.now() - waitStart < maxWaitMs) {
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            if (typeof window !== 'undefined') {
                localStorage.removeItem('ms_sync_queue');
                localStorage.removeItem('ms_last_sync_time');
                localStorage.removeItem('ms_deleted_ids');
            }
            setSyncQueue([]);
            setLastSyncTime(null);
            setSyncError(null);

            await syncFromDatabase(stateRef.current.currentUser, false, true);
            showSaveSuccess();
        } catch (e) {
            console.error("Error resetting sync:", e);
            showSaveError("No se pudo restablecer la base de datos local");
        } finally {
            setIsSyncing(false);
        }
    }, [syncFromDatabase]);

    // Initial load effect
    useEffect(() => {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        async function fetchMe() {
            if (typeof window !== 'undefined') {
                const path = window.location.pathname;
                if (path.startsWith('/login') || path.startsWith('/forgot-password') || path.startsWith('/reset-password')) {
                    setCurrentUser(null);
                    try {
                        localStorage.removeItem('ms_user');
                    } catch (e) {}
                    return;
                }
            }
            try {
                const res = await fetch('/api/auth/me', { signal: controller.signal });
                if (controller.signal.aborted) return;

                if (res.ok) {
                    const parsed = await res.json();
                    if (parsed.authenticated && parsed.user) {
                        const u = {
                            id: parsed.user.id,
                            username: parsed.user.username,
                            fullname: parsed.user.fullname,
                            email: parsed.data?.email || parsed.user.email || '',
                            role: parsed.user.role,
                        };
                        setCurrentUser(u);
                        try {
                            localStorage.setItem('ms_user', JSON.stringify(u));
                        } catch (e) {}
                        // Solo sincronizar si está autenticado (pasando el usuario directamente para evitar delay del batch update)
                        syncFromDatabase(u);
                    } else {
                        setCurrentUser(null);
                        try {
                            localStorage.removeItem('ms_user');
                        } catch (e) {}
                        setSyncError("UNAUTHORIZED");
                        if (typeof window !== 'undefined') {
                            window.location.href = '/login';
                        }
                    }
                } else {
                    if (res.status === 401) {
                        setCurrentUser(null);
                        try {
                            localStorage.removeItem('ms_user');
                        } catch (e) {}
                        setSyncError("UNAUTHORIZED");
                        if (typeof window !== 'undefined') {
                            window.location.href = '/login';
                        }
                    } else {
                        // Error de servidor/BD temporal: mantener sesión local y marcar error de base de datos
                        setSyncError("DB_ERROR");
                    }
                }
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error('Error al recuperar sesión en ManagementProvider:', err);
                // Keep local user session fallback on network connection failure
                setSyncError("OFFLINE");
            }
        }

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        setCurrentMonth(`${yyyy}-${mm}`);

        // Rehydrating currentUser from localStorage for instant mount & hydration
        if (typeof window !== 'undefined') {
            try {
                const savedUser = localStorage.getItem('ms_user');
                if (savedUser) {
                    setCurrentUser(JSON.parse(savedUser));
                }
            } catch (e) {}
        }

        let localData = null;
        if (typeof window !== 'undefined') {
            try {
                localData = localStorage.getItem('ms_data');
                if (!localData) {
                    const legacyData = localStorage.getItem('copyrent_data');
                    if (legacyData) {
                        localStorage.setItem('ms_data', legacyData);
                        localStorage.removeItem('copyrent_data'); // Clean up legacy key after migration
                        localData = legacyData;
                    }
                }
            } catch (e) {}
        }
        
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                // FIX: Use empty arrays as fallback instead of mock data in production
                setClients(parsed.clients || []);
                setMachines(parsed.machines || []);
                setReadings(parsed.readings || []);
                setTickets(parsed.tickets || []);
                setAbonos(parsed.abonos || []);
                setUsers(parsed.users || []);
                setRentals(parsed.rentals || []);
                setBudgets(parsed.budgets || []);
                setTemplates(parsed.templates || []);
                setMachinePresets(parsed.machinePresets || []);
                setGestiones(parsed.gestiones || defaultGestiones);
                setPayments(parsed.payments || []);

                if (parsed.cobranzaConfig) {
                    setCobranzaConfig({
                        ...defaultCobranzaConfig,
                        ...parsed.cobranzaConfig
                    });
                } else {
                    setCobranzaConfig(defaultCobranzaConfig);
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            // FIX: Empty state instead of mock data for new installs. 
            // Data will be populated from the server on sync.
            setClients([]);
            setMachines([]);
            setReadings([]);
            setTickets([]);
            setAbonos([]);
            setUsers([]);
            setRentals([]);
            setBudgets([]);
            setTemplates([]);
            setMachinePresets([]);
            setGestiones([]);
            setPayments([]);
            setCobranzaConfig(defaultCobranzaConfig);
        }

        if (typeof window !== 'undefined') {
            try {
                const savedSyncTime = localStorage.getItem('ms_last_sync_time');
                if (savedSyncTime) {
                    setLastSyncTime(new Date(savedSyncTime));
                }
            } catch (e) {}
        }

        const initialQueue = getStoredQueue();
        setSyncQueue(initialQueue);

        fetchMe();

        // FIX: Use a flag instead of setTimeout to mark initial load as complete
        // The flag is set after the first successful sync or after localStorage is loaded
        requestAnimationFrame(() => {
            isInitialLoadDoneRef.current = true;
        });

        return () => {
            controller.abort();
            abortControllerRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-sync when page refocuses, tab changes, network goes online, or periodically in background
    // FIX: Uses syncFromDatabase via ref/useCallback to avoid stale closure
    useEffect(() => {
        const handleSyncTrigger = () => {
            syncFromDatabase();
        };

        window.addEventListener('focus', handleSyncTrigger);
        window.addEventListener('online', handleSyncTrigger);
        
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                syncFromDatabase();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Setup background polling interval
        const pollInterval = setInterval(() => {
            if (document.visibilityState === 'visible' && !isSyncingRef.current) {
                syncFromDatabase();
            }
        }, SYNC_POLL_INTERVAL_MS);

        return () => {
            window.removeEventListener('focus', handleSyncTrigger);
            window.removeEventListener('online', handleSyncTrigger);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(pollInterval);
        };
    }, [syncFromDatabase]);

    // Centralized state saver helper
    const saveStateToLocalStorage = useCallback((customState?: Partial<{
        clients: Client[];
        machines: Machine[];
        readings: Reading[];
        tickets: Ticket[];
        abonos: Abono[];
        users: User[];
        rentals: Rental[];
        budgets: Budget[];
    }>) => {
        const stateToSave = {
            clients: customState?.clients ?? stateRef.current.clients,
            machines: customState?.machines ?? stateRef.current.machines,
            readings: customState?.readings ?? stateRef.current.readings,
            tickets: customState?.tickets ?? stateRef.current.tickets,
            plans: customState?.abonos ?? stateRef.current.abonos,
            abonos: customState?.abonos ?? stateRef.current.abonos,
            users: customState?.users ?? stateRef.current.users,
            rentals: customState?.rentals ?? stateRef.current.rentals,
            budgets: customState?.budgets ?? stateRef.current.budgets,
            templates,
            machinePresets,
            gestiones,
            payments,
            cobranzaConfig
        };
        try {
            localStorage.setItem('ms_data', JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Error saving state to localStorage:", e);
        }
    }, [templates, machinePresets, gestiones, payments, cobranzaConfig]);

    // Generic enqueue helper
    const enqueueSyncItem = useCallback((entityId: string, entityType: SyncEntityType, operation: 'create' | 'update' | 'delete', payload: any) => {
        const nowStr = new Date().toISOString();
        
        // Remove circular or system state properties from payloads before enqueuing
        const cleanPayload = { ...payload };
        
        const newItem: SyncQueueItem = {
            id: crypto.randomUUID ? crypto.randomUUID() : 'q-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
            entityId,
            entityType,
            operation,
            payload: cleanPayload,
            updatedAt: nowStr,
            status: 'pending',
            retryCount: 0
        };

        const currentQueue = getStoredQueue();
        const updatedQueue = [...currentQueue, newItem].slice(-MAX_SYNC_QUEUE_SIZE);
        saveStoredQueue(updatedQueue);
        setSyncQueue(updatedQueue);
        
        // Process sync queue in background
        processSyncQueue(updatedQueue);
    }, [processSyncQueue]);

    // Explicit Action methods to mutate state & schedule sync
    const addRentalAction = useCallback((rental: Rental, machineUpdates: { id: string; clientId: string | null; abonoId: string | null; status: any }[], finalizeRentalIds: string[] = []) => {
        const nowStr = new Date().toISOString();
        const rentalWithTime = { ...rental, createdAt: rental.createdAt || nowStr, updatedAt: nowStr };

        // Finalizar contratos existentes (p. ej. al reasignar un equipo a otro cliente) en la
        // MISMA transacción de estado que la creación del nuevo — hacerlo como dos llamadas
        // separadas (updateRentalAction + addRentalAction) compite por stateRef.current.rentals:
        // el ref solo se refresca en un useEffect, un tick después de cada setState, así que la
        // segunda llamada lee la misma foto previa a la primera y su propio setRentals(...) pisa
        // en silencio el cambio recién hecho — confirmado en vivo (el contrato "finalizado" volvía
        // a aparecer como ACTIVO en el estado local, aunque el servidor sí quedaba bien).
        const finalizedNow: Rental[] = [];
        const baseRentals = stateRef.current.rentals.map(r => {
            if (!finalizeRentalIds.includes(r.id)) return r;
            const finalized: Rental = {
                ...r,
                status: 'finalizado',
                endDate: nowStr.split('T')[0],
                updatedAt: nowStr,
                history: [...(r.history || []), {
                    date: nowStr.split('T')[0],
                    time: nowStr.split('T')[1].substring(0, 5),
                    action: 'Contrato finalizado: equipo reasignado',
                    user: rental.history?.[0]?.user || 'Sistema'
                }]
            };
            finalizedNow.push(finalized);
            return finalized;
        });

        // Update rentals state
        const updatedRentals = [rentalWithTime, ...baseRentals];
        setRentals(updatedRentals);

        // Update machines state — only touch it (and only include it in the localStorage
        // write below) when there's actually something to change. Doing this unconditionally
        // meant a caller passing machineUpdates: [] (e.g. because it already updated the
        // machine itself via updateMachineAction moments earlier, in the same handler) would
        // still compute "updatedMachines" from the same stale stateRef.current.machines and
        // overwrite that just-saved machine back to its pre-edit value in local state/
        // localStorage — the server stayed correct (that machine's own enqueueSyncItem call
        // already captured it directly), but this device's own UI would flash the old value
        // until the next sync poll quietly corrected it.
        let updatedMachines = stateRef.current.machines;
        if (machineUpdates.length > 0) {
            updatedMachines = stateRef.current.machines.map(m => {
                const up = machineUpdates.find(u => u.id === m.id);
                if (up) {
                    // Keep isAvailable consistent with status — it was previously only set once at
                    // machine creation and never updated again, leaving it stale for every machine
                    // that got rented or freed afterwards (confirmed against real Turso data).
                    return { ...m, clientId: up.clientId, abonoId: up.abonoId, status: up.status, isAvailable: up.status === 'Disponible', updatedAt: nowStr };
                }
                return m;
            });
            setMachines(updatedMachines);
        }

        // Save state to storage
        saveStateToLocalStorage(machineUpdates.length > 0 ? { rentals: updatedRentals, machines: updatedMachines } : { rentals: updatedRentals });

        // Enqueue sync actions
        enqueueSyncItem(rentalWithTime.id, 'rentals', 'create', rentalWithTime);
        finalizedNow.forEach(r => enqueueSyncItem(r.id, 'rentals', 'update', r));
        machineUpdates.forEach(up => {
            const fullMachine = updatedMachines.find(m => m.id === up.id);
            if (fullMachine) {
                enqueueSyncItem(fullMachine.id, 'machines', 'update', fullMachine);
            }
        });
    }, [enqueueSyncItem, saveStateToLocalStorage]);

    const updateRentalAction = useCallback((rental: Rental, machineUpdates?: { id: string; clientId: string | null; abonoId: string | null; status: any }[]) => {
        const nowStr = new Date().toISOString();
        const rentalWithTime = { ...rental, updatedAt: nowStr, createdAt: rental.createdAt || nowStr };
        
        // Update rentals state
        const updatedRentals = stateRef.current.rentals.map(r => r.id === rental.id ? rentalWithTime : r);
        setRentals(updatedRentals);

        // Update machines state if provided
        let updatedMachines = stateRef.current.machines;
        if (machineUpdates && machineUpdates.length > 0) {
            updatedMachines = stateRef.current.machines.map(m => {
                const up = machineUpdates.find(u => u.id === m.id);
                if (up) {
                    return { ...m, clientId: up.clientId, abonoId: up.abonoId, status: up.status, isAvailable: up.status === 'Disponible', updatedAt: nowStr };
                }
                return m;
            });
            setMachines(updatedMachines);
        }

        saveStateToLocalStorage({ rentals: updatedRentals, machines: updatedMachines });

        enqueueSyncItem(rentalWithTime.id, 'rentals', 'update', rentalWithTime);
        if (machineUpdates) {
            machineUpdates.forEach(up => {
                const fullMachine = updatedMachines.find(m => m.id === up.id);
                if (fullMachine) {
                    enqueueSyncItem(fullMachine.id, 'machines', 'update', fullMachine);
                }
            });
        }
    }, [enqueueSyncItem, saveStateToLocalStorage]);

    const updateTicketAction = useCallback((ticket: Ticket, machineUpdate?: { id: string; status: any }) => {
        const nowStr = new Date().toISOString();
        const ticketWithTime = { ...ticket, updatedAt: nowStr, createdAt: ticket.createdAt || new Date().getTime() };
        
        // Check if ticket exists to determine create vs update
        const exists = stateRef.current.tickets.some(t => t.id === ticket.id);
        const operation = exists ? 'update' : 'create';

        const updatedTickets = exists
            ? stateRef.current.tickets.map(t => t.id === ticket.id ? ticketWithTime : t)
            : [ticketWithTime, ...stateRef.current.tickets];
        setTickets(updatedTickets);

        let updatedMachines = stateRef.current.machines;
        if (machineUpdate) {
            updatedMachines = stateRef.current.machines.map(m => {
                if (m.id === machineUpdate.id) {
                    return { ...m, status: machineUpdate.status, isAvailable: machineUpdate.status === 'Disponible', updatedAt: nowStr };
                }
                return m;
            });
            setMachines(updatedMachines);
        }

        saveStateToLocalStorage({ tickets: updatedTickets, machines: updatedMachines });

        enqueueSyncItem(ticketWithTime.id, 'tickets', operation, ticketWithTime);
        if (machineUpdate) {
            const fullMachine = updatedMachines.find(m => m.id === machineUpdate.id);
            if (fullMachine) {
                enqueueSyncItem(fullMachine.id, 'machines', 'update', fullMachine);
            }
        }
    }, [enqueueSyncItem, saveStateToLocalStorage]);

    const addReadingAction = useCallback((reading: Reading, machineUpdate?: { id: string; currentCounter: number }, operationOverride?: 'create' | 'update' | 'delete') => {
        const nowStr = new Date().toISOString();
        const readingWithTime = { ...reading, updatedAt: nowStr, createdAt: reading.createdAt || nowStr };

        const exists = stateRef.current.readings.some(r => r.id === reading.id);
        const operation = operationOverride || (exists ? 'update' : 'create');

        let updatedReadings = stateRef.current.readings;
        if (operation === 'delete') {
            updatedReadings = stateRef.current.readings.filter(r => r.id !== reading.id);
        } else {
            updatedReadings = exists
                ? stateRef.current.readings.map(r => r.id === reading.id ? readingWithTime : r)
                : [...stateRef.current.readings.filter(r => !(r.machineId === reading.machineId && r.month === reading.month)), readingWithTime];
        }
        setReadings(updatedReadings);

        let updatedMachines = stateRef.current.machines;
        if (machineUpdate) {
            updatedMachines = stateRef.current.machines.map(m => {
                if (m.id === machineUpdate.id) {
                    return { ...m, currentCounter: machineUpdate.currentCounter, updatedAt: nowStr };
                }
                return m;
            });
            setMachines(updatedMachines);
        }

        saveStateToLocalStorage({ readings: updatedReadings, machines: updatedMachines });

        enqueueSyncItem(readingWithTime.id, 'readings', operation, operation === 'delete' ? reading : readingWithTime);
        if (machineUpdate) {
            const fullMachine = updatedMachines.find(m => m.id === machineUpdate.id);
            if (fullMachine) {
                enqueueSyncItem(fullMachine.id, 'machines', 'update', fullMachine);
            }
        }
    }, [enqueueSyncItem, saveStateToLocalStorage]);

    const updateClientAction = useCallback((client: Client, operation: 'create' | 'update' | 'delete' = 'update') => {
        const nowStr = new Date().toISOString();
        const clientWithTime = { ...client, updatedAt: nowStr, createdAt: client.createdAt || nowStr };
        
        let updatedClients = stateRef.current.clients;
        if (operation === 'delete') {
            updatedClients = stateRef.current.clients.filter(c => c.id !== client.id);
        } else if (operation === 'create') {
            updatedClients = [...stateRef.current.clients, clientWithTime];
        } else {
            updatedClients = stateRef.current.clients.map(c => c.id === client.id ? clientWithTime : c);
        }
        setClients(updatedClients);
        saveStateToLocalStorage({ clients: updatedClients });

        enqueueSyncItem(client.id, 'clients', operation, operation === 'delete' ? client : clientWithTime);
    }, [enqueueSyncItem, saveStateToLocalStorage]);

    const updateMachineAction = useCallback((machine: Machine, operation: 'create' | 'update' | 'delete' = 'update') => {
        const nowStr = new Date().toISOString();
        const machineWithTime = { ...machine, updatedAt: nowStr, createdAt: machine.createdAt || nowStr };
        
        let updatedMachines = stateRef.current.machines;
        if (operation === 'delete') {
            updatedMachines = stateRef.current.machines.filter(m => m.id !== machine.id);
        } else if (operation === 'create') {
            updatedMachines = [...stateRef.current.machines, machineWithTime];
        } else {
            updatedMachines = stateRef.current.machines.map(m => m.id === machine.id ? machineWithTime : m);
        }
        setMachines(updatedMachines);
        saveStateToLocalStorage({ machines: updatedMachines });

        enqueueSyncItem(machine.id, 'machines', operation, operation === 'delete' ? machine : machineWithTime);
    }, [enqueueSyncItem, saveStateToLocalStorage]);

    const updateAbonoAction = useCallback((abono: Abono, operation: 'create' | 'update' | 'delete' = 'update') => {
        const nowStr = new Date().toISOString();
        const abonoWithTime = { ...abono, updatedAt: nowStr, createdAt: abono.createdAt || nowStr };

        let updatedAbonos = stateRef.current.abonos;
        if (operation === 'delete') {
            updatedAbonos = stateRef.current.abonos.filter(a => a.id !== abono.id);
        } else if (operation === 'create') {
            updatedAbonos = [...stateRef.current.abonos, abonoWithTime];
        } else {
            updatedAbonos = stateRef.current.abonos.map(a => a.id === abono.id ? abonoWithTime : a);
        }
        setAbonos(updatedAbonos);
        saveStateToLocalStorage({ abonos: updatedAbonos });

        enqueueSyncItem(abono.id, 'abonos', operation, operation === 'delete' ? abono : abonoWithTime);
    }, [enqueueSyncItem, saveStateToLocalStorage]);

    const addBudgetAction = useCallback((budget: Budget, operation: 'create' | 'update' | 'delete' = 'update') => {
        const nowStr = new Date().toISOString();
        const budgetWithTime = { ...budget, updatedAt: nowStr, createdAt: budget.createdAt || nowStr };

        let updatedBudgets = stateRef.current.budgets;
        if (operation === 'delete') {
            updatedBudgets = stateRef.current.budgets.filter(b => b.id !== budget.id);
        } else if (operation === 'create') {
            updatedBudgets = [budgetWithTime, ...stateRef.current.budgets];
        } else {
            updatedBudgets = stateRef.current.budgets.map(b => b.id === budget.id ? budgetWithTime : b);
        }
        setBudgets(updatedBudgets);
        saveStateToLocalStorage({ budgets: updatedBudgets });

        enqueueSyncItem(budget.id, 'budgets', operation, operation === 'delete' ? budget : budgetWithTime);
    }, [enqueueSyncItem, saveStateToLocalStorage]);

    const updateUserAction = useCallback((user: User, operation: 'create' | 'update' | 'delete' = 'update') => {
        const nowStr = new Date().toISOString();
        const userWithTime = { ...user, updatedAt: nowStr, createdAt: user.createdAt || nowStr };

        let updatedUsers = stateRef.current.users;
        if (operation === 'delete') {
            updatedUsers = stateRef.current.users.filter(u => u.id !== user.id);
        } else if (operation === 'create') {
            updatedUsers = [...stateRef.current.users, userWithTime];
        } else {
            updatedUsers = stateRef.current.users.map(u => u.id === user.id ? userWithTime : u);
        }
        setUsers(updatedUsers);
        saveStateToLocalStorage({ users: updatedUsers });

        enqueueSyncItem(user.id, 'users', operation, operation === 'delete' ? user : userWithTime);
    }, [enqueueSyncItem, saveStateToLocalStorage]);

    // Gestion action: creates/updates/deletes a cobranza interaction record in Turso
    const addGestionAction = useCallback((gestion: Gestion, operation: 'create' | 'update' | 'delete' = 'create') => {
        const nowStr = new Date().toISOString();
        const gestionWithTime = { ...gestion, updatedAt: nowStr, createdAt: (gestion as Gestion & { createdAt?: string }).createdAt || nowStr };

        // Lee de stateRef, no de la variable `gestiones` cerrada por closure — igual que
        // las otras 11 acciones. Con la closure, dos llamadas seguidas a esta función
        // dentro del mismo handler (p. ej. registrar dos gestiones en una sola acción)
        // leerían la misma foto y la segunda pisaría en silencio el cambio de la primera
        // en el estado local — el mismo bug ya encontrado y arreglado hoy en addRentalAction.
        let updatedGestiones = stateRef.current.gestiones;
        if (operation === 'delete') {
            updatedGestiones = stateRef.current.gestiones.filter(g => g.id !== gestion.id);
        } else if (operation === 'create') {
            updatedGestiones = [gestionWithTime, ...stateRef.current.gestiones];
        } else {
            updatedGestiones = stateRef.current.gestiones.map(g => g.id === gestion.id ? gestionWithTime : g);
        }
        setGestiones(updatedGestiones);

        // Persist gestiones to localStorage inside ms_data
        try {
            const raw = localStorage.getItem('ms_data');
            const current = raw ? JSON.parse(raw) : {};
            localStorage.setItem('ms_data', JSON.stringify({ ...current, gestiones: updatedGestiones }));
        } catch (e) {}

        enqueueSyncItem(gestion.id, 'gestiones', operation, operation === 'delete' ? gestion : gestionWithTime);
    }, [enqueueSyncItem]);

    // Payments action: registers a cobro (payment/receipt) — backed by Turso
    const addPaymentAction = useCallback((payment: Payment, operation: 'create' | 'update' | 'delete' = 'create') => {
        const nowStr = new Date().toISOString();
        const paymentWithTime = { ...payment, updatedAt: nowStr, createdAt: payment.createdAt || nowStr };

        // Lee de stateRef, no de la variable `payments` cerrada por closure — ver el
        // comentario en addGestionAction.
        let updatedPayments = stateRef.current.payments;
        if (operation === 'delete') {
            updatedPayments = stateRef.current.payments.filter(p => p.id !== payment.id);
        } else if (operation === 'create') {
            updatedPayments = [paymentWithTime, ...stateRef.current.payments];
        } else {
            updatedPayments = stateRef.current.payments.map(p => p.id === payment.id ? paymentWithTime : p);
        }
        setPayments(updatedPayments);

        // Persist payments to localStorage inside ms_data
        try {
            const raw = localStorage.getItem('ms_data');
            const current = raw ? JSON.parse(raw) : {};
            localStorage.setItem('ms_data', JSON.stringify({ ...current, payments: updatedPayments }));
        } catch (e) {}

        enqueueSyncItem(payment.id, 'payments', operation, operation === 'delete' ? payment : paymentWithTime);
    }, [enqueueSyncItem]);

    // Machine preset action: catálogo de equipos preconfigurados para presupuestos —
    // antes vivía solo en localStorage (ver comentario en addGestionAction sobre por
    // qué se lee de stateRef y no de la closure).
    const addMachinePresetAction = useCallback((preset: MachinePreset, operation: 'create' | 'update' | 'delete' = 'create') => {
        const nowStr = new Date().toISOString();
        const presetWithTime = { ...preset, updatedAt: nowStr, createdAt: preset.createdAt || nowStr };

        let updatedPresets = stateRef.current.machinePresets;
        if (operation === 'delete') {
            updatedPresets = stateRef.current.machinePresets.filter(p => p.id !== preset.id);
        } else if (operation === 'create') {
            updatedPresets = [...stateRef.current.machinePresets, presetWithTime];
        } else {
            updatedPresets = stateRef.current.machinePresets.map(p => p.id === preset.id ? presetWithTime : p);
        }
        setMachinePresets(updatedPresets);

        try {
            const raw = localStorage.getItem('ms_data');
            const current = raw ? JSON.parse(raw) : {};
            localStorage.setItem('ms_data', JSON.stringify({ ...current, machinePresets: updatedPresets }));
        } catch (e) {}

        enqueueSyncItem(preset.id, 'machinePresets', operation, operation === 'delete' ? preset : presetWithTime);
    }, [enqueueSyncItem]);

    // Budget template action: plantillas de texto por defecto para presupuestos —
    // mismo problema que addMachinePresetAction, antes solo local.
    const addTemplateAction = useCallback((template: BudgetTemplate, operation: 'create' | 'update' | 'delete' = 'create') => {
        const nowStr = new Date().toISOString();
        const templateWithTime = { ...template, updatedAt: nowStr, createdAt: template.createdAt || nowStr };

        let updatedTemplates = stateRef.current.templates;
        if (operation === 'delete') {
            updatedTemplates = stateRef.current.templates.filter(t => t.id !== template.id);
        } else if (operation === 'create') {
            updatedTemplates = [...stateRef.current.templates, templateWithTime];
        } else {
            updatedTemplates = stateRef.current.templates.map(t => t.id === template.id ? templateWithTime : t);
        }
        setTemplates(updatedTemplates);

        try {
            const raw = localStorage.getItem('ms_data');
            const current = raw ? JSON.parse(raw) : {};
            localStorage.setItem('ms_data', JSON.stringify({ ...current, templates: updatedTemplates }));
        } catch (e) {}

        enqueueSyncItem(template.id, 'templates', operation, operation === 'delete' ? template : templateWithTime);
    }, [enqueueSyncItem]);

    // CobranzaConfig action: saves configuration singleton to Turso
    const updateCobranzaConfigAction = useCallback((config: CobranzaConfig) => {
        const nowStr = new Date().toISOString();
        const configWithTime = { ...config, id: 'singleton', updatedAt: nowStr };
        setCobranzaConfig(config);

        // Persist to localStorage
        try {
            const raw = localStorage.getItem('ms_data');
            const current = raw ? JSON.parse(raw) : {};
            localStorage.setItem('ms_data', JSON.stringify({ ...current, cobranzaConfig: configWithTime }));
        } catch (e) {}

        enqueueSyncItem('singleton', 'cobranzaConfig', 'update', configWithTime);
    }, [enqueueSyncItem]);

    const bulkSyncAction = useCallback((
        items: { id: string; entityType: SyncEntityType; operation: 'create' | 'update' | 'delete'; payload: any }[],
        localStorageUpdate?: Partial<{ clients: Client[]; machines: Machine[]; readings: Reading[]; tickets: Ticket[]; abonos: Abono[]; users: User[]; rentals: Rental[]; budgets: Budget[]; }>
    ) => {
        if (localStorageUpdate) {
            saveStateToLocalStorage(localStorageUpdate);
        }
        items.forEach(item => enqueueSyncItem(item.id, item.entityType, item.operation, item.payload));
    }, [enqueueSyncItem, saveStateToLocalStorage]);

    return (
        <ManagementContext.Provider
            value={{
                currentMonth,
                setCurrentMonth,
                currentUser,
                setCurrentUser,
                clients,
                setClients,
                machines,
                setMachines,
                readings,
                setReadings,
                tickets,
                setTickets,
                abonos,
                setAbonos,
                users,
                setUsers,
                rentals,
                setRentals,
                budgets,
                setBudgets,
                templates,
                machinePresets,
                gestiones,
                setGestiones,
                payments,
                setPayments,
                cobranzaConfig,
                isSyncing,
                syncError,
                lastSyncTime,
                syncFromDatabase,
                syncQueue,
                processSyncQueue,
                addRentalAction,
                updateRentalAction,
                updateTicketAction,
                addReadingAction,
                updateClientAction,
                updateMachineAction,
                updateAbonoAction,
                addBudgetAction,
                updateUserAction,
                addGestionAction,
                updateCobranzaConfigAction,
                addPaymentAction,
                addMachinePresetAction,
                addTemplateAction,
                bulkSyncAction,
                resetSyncAction
            }}
        >
            {children}
        </ManagementContext.Provider>
    );
};

export interface LocalReading extends Reading {
    clientId?: string;
}

export const useManagement = () => {
    const context = useContext(ManagementContext);
    if (context === undefined) {
        throw new Error('useManagement must be used within a ManagementProvider');
    }
    return context;
};
