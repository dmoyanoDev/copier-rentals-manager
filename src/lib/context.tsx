'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
    Client,
    Machine,
    Reading,
    Ticket,
    User,
    Abono,
    Rental
} from './mockData';
import { Budget, BudgetTemplate, MachinePreset } from '@/domain/budget/types';
import { BRANDING } from '@/config/branding';
import { defaultMachinePresets, defaultBudgetTemplates } from '@/domain/budget/presets';
import type { SyncQueueItem, SyncEntityType } from '@/domain/types';
import { MAX_SYNC_QUEUE_SIZE, MAX_SYNC_RETRIES, SYNC_DEBOUNCE_MS, SYNC_POLL_INTERVAL_MS } from '@/domain/types';
import { showSaveSuccess, showSaveError, showOffline } from '@/components/ui/toast';

// Extend Client interface locally
export interface LocalClient extends Client {
    cobranzaNotas?: string;
}

export interface Gestion {
    id: string;
    clientId: string;
    date: string;
    type: 'WhatsApp' | 'Email' | 'Llamado' | 'Pago registrado' | 'Promesa de pago' | 'Regularización' | 'Auditoría';
    user: string;
    channel: string;
    result: string;
    observations: string;
}

export interface CobranzaConfig {
    diasAvisoVencimiento: number;
    montoMinimoAlerta: number;
    diasMoraCritica: number;
    plantillaEmail: string;
    plantillaWhatsapp: string;
    
    // Multiple templates additions
    plantillaPreventivoEmail: string;
    plantillaPreventivoWhatsapp: string;
    plantillaDeudaVencidaEmail: string;
    plantillaDeudaVencidaWhatsapp: string;
    plantillaSegundoAvisoEmail: string;
    plantillaSegundoAvisoWhatsapp: string;
    plantillaPagoRecibidoEmail: string;
    plantillaPagoRecibidoWhatsapp: string;

    sonidosActivos: boolean;
    volumenSonidos: number;
    autoAlertasActivas: boolean;
}

const defaultCobranzaConfig: CobranzaConfig = {
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
    setTemplates: React.Dispatch<React.SetStateAction<BudgetTemplate[]>>;
    machinePresets: MachinePreset[];
    setMachinePresets: React.Dispatch<React.SetStateAction<MachinePreset[]>>;

    // Cobranza Additions
    gestiones: Gestion[];
    setGestiones: React.Dispatch<React.SetStateAction<Gestion[]>>;
    cobranzaConfig: CobranzaConfig;
    setCobranzaConfig: React.Dispatch<React.SetStateAction<CobranzaConfig>>;

    // Cloud Database Sync Additions
    isSyncing: boolean;
    syncError: string | null;
    lastSyncTime: Date | null;
    syncFromDatabase: (forceUser?: User | null, forceRetry?: boolean) => Promise<void>;
    syncQueue: SyncQueueItem[];
    processSyncQueue: (passedQueue?: SyncQueueItem[]) => Promise<void>;
    resetSyncAction: () => Promise<void>;

    // Action-Driven mutations
    addRentalAction: (rental: Rental, machineUpdates: { id: string; clientId: string | null; abonoId: string | null; status: any }[]) => void;
    updateRentalAction: (rental: Rental, machineUpdates?: { id: string; clientId: string | null; abonoId: string | null; status: any }[]) => void;
    updateTicketAction: (ticket: Ticket, machineUpdate?: { id: string; status: any }) => void;
    addReadingAction: (reading: Reading, machineUpdate?: { id: string; currentCounter: number }) => void;
    updateClientAction: (client: Client, operation?: 'create' | 'update' | 'delete') => void;
    updateMachineAction: (machine: Machine, operation?: 'create' | 'update' | 'delete') => void;
    updateAbonoAction: (abono: Abono, operation?: 'create' | 'update' | 'delete') => void;
    addBudgetAction: (budget: Budget, operation?: 'create' | 'update' | 'delete') => void;
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

const mergeData = (local: any, server: any, lastSyncTime: Date | null, isIncremental: boolean = false) => {
    const merged = { ...local };
    const tables = ['clients', 'machines', 'readings', 'tickets', 'abonos', 'users', 'rentals', 'budgets'];
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
        
        const mergedList = [];
        
        // 1. Process all local items
        for (const localItem of localList) {
            const serverItem: any = serverMap.get(localItem.id);
            if (!serverItem) {
                // Only exists locally.
                if (isIncremental) {
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
            } else {
                // Exists in both.
                if (isIncremental) {
                    // CRITICAL FIX: On incremental sync the server item ALWAYS wins.
                    // The server only returns items changed since lastSyncTime —
                    // these are confirmed writes from other devices and must override local state.
                    mergedList.push(serverItem);
                } else {
                    // Full sync: Last-Write-Wins based on timestamps
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
        currentUser: null as User | null,
        lastSyncTime: null as Date | null,
    });

    // Keep stateRef current
    useEffect(() => {
        stateRef.current = {
            clients, machines, readings, tickets, abonos, users, rentals, budgets,
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
        
        const queueToProcess = passedQueue || getStoredQueue();
        const pendingItems = queueToProcess.filter((item) => 
            (item.status === 'pending' || item.status === 'failed') && item.retryCount < MAX_SYNC_RETRIES
        );
        
        if (pendingItems.length === 0) return;
        
        isProcessingQueueRef.current = true;
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

        try {
            const response = await fetch('/api/sync/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ items: pendingItems })
            });

            if (response.status === 401) {
                setSyncError("UNAUTHORIZED");
                setCurrentUser(null);
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
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
        } finally {
            isProcessingQueueRef.current = false;
        }

    }, []);

    // Fetch snapshot from backend database — uses stateRef to avoid stale closures
    const syncFromDatabase = useCallback(async (forceUser?: User | null, forceRetry: boolean = false) => {
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
        }

        isSyncingRef.current = true;
        setIsSyncing(true);
        try {
            let storedLastSync = stateRef.current.lastSyncTime;
            if (!storedLastSync && typeof window !== 'undefined') {
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
                
                // Always mark sync as successful if API returns 200
                const now = new Date();
                setLastSyncTime(now);
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.setItem('ms_last_sync_time', now.toISOString());
                    } catch (e) {}
                }
                setSyncError(null);
                
                // Only overwrite if remote database contains actual data or it is an incremental sync
                const hasServerData = 
                    isIncremental ||
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
                        budgets: stateRef.current.budgets || []
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
                                    budgets: parsedLocal.budgets || []
                                };
                            }
                        } catch (e) {
                            console.error("Error reading localStorage in syncFromDatabase:", e);
                        }
                    }

                    const merged = mergeData(currentLocalState, parsed, stateRef.current.lastSyncTime, isIncremental);

                    setClients(merged.clients || []);
                    setMachines(merged.machines || []);
                    setReadings(merged.readings || []);
                    setTickets(merged.tickets || []);
                    setAbonos(merged.abonos || []);
                    setUsers(merged.users || []);
                    if (merged.rentals) setRentals(merged.rentals);
                    setBudgets(merged.budgets || []);
                    
                    const loadedTemplates = parsed.templates || [];
                    const defaultIds = defaultBudgetTemplates.map(t => t.id);
                    const customTemplates = loadedTemplates.filter((t: any) => !defaultIds.includes(t.id));
                    setTemplates([...defaultBudgetTemplates, ...customTemplates]);
                    
                    if (parsed.machinePresets) setMachinePresets(parsed.machinePresets);
                    if (parsed.gestiones) setGestiones(parsed.gestiones);
                    
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
                        templates: parsed.templates || templates || [],
                        machinePresets: parsed.machinePresets || machinePresets || [],
                        gestiones: parsed.gestiones || gestiones || [],
                        cobranzaConfig: parsed.cobranzaConfig || cobranzaConfig || defaultCobranzaConfig
                    };
                    try {
                        localStorage.setItem('ms_data', JSON.stringify(stateToSave));
                    } catch (e) {}

                    // Compare only key business tables to decide if a server sync is needed
                    const tablesToCompare = ['clients', 'machines', 'readings', 'tickets', 'abonos', 'users', 'rentals', 'budgets'];
                    let localChangesExist = false;
                    for (const table of tablesToCompare) {
                        const serverList = parsed[table] || (table === 'abonos' ? parsed.plans || [] : []);
                        const mergedList = merged[table] || [];
                        if (JSON.stringify(serverList) !== JSON.stringify(mergedList)) {
                            localChangesExist = true;
                            break;
                        }
                    }

                    const isMaster = (stateRef.current.currentUser as any)?.role === 'master' || 
                                     (stateRef.current.currentUser as any)?.isMaster || 
                                     stateRef.current.currentUser?.username === 'dmoyano';

                    if (localChangesExist && isMaster) {
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
            if (typeof window !== 'undefined') {
                localStorage.removeItem('ms_sync_queue');
                localStorage.removeItem('ms_last_sync_time');
                localStorage.removeItem('ms_deleted_ids');
            }
            setSyncQueue([]);
            setLastSyncTime(null);
            setSyncError(null);
            
            await syncFromDatabase(stateRef.current.currentUser);
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
                
                const loadedTemplates = parsed.templates || [];
                const defaultIds = defaultBudgetTemplates.map(t => t.id);
                const customTemplates = loadedTemplates.filter((t: any) => !defaultIds.includes(t.id));
                setTemplates([...defaultBudgetTemplates, ...customTemplates]);

                setMachinePresets(parsed.machinePresets && parsed.machinePresets.length > 0 ? parsed.machinePresets : defaultMachinePresets);
                setGestiones(parsed.gestiones || defaultGestiones);
                
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
            setTemplates(defaultBudgetTemplates);
            setMachinePresets(defaultMachinePresets);
            setGestiones([]);
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
    const saveStateToLocalStorage = (customState?: any) => {
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
            cobranzaConfig
        };
        try {
            localStorage.setItem('ms_data', JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Error saving state to localStorage:", e);
        }
    };

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
    const addRentalAction = useCallback((rental: Rental, machineUpdates: { id: string; clientId: string | null; abonoId: string | null; status: any }[]) => {
        const nowStr = new Date().toISOString();
        const rentalWithTime = { ...rental, createdAt: rental.createdAt || nowStr, updatedAt: nowStr };
        
        // Update rentals state
        const updatedRentals = [rentalWithTime, ...stateRef.current.rentals];
        setRentals(updatedRentals);

        // Update machines state
        const updatedMachines = stateRef.current.machines.map(m => {
            const up = machineUpdates.find(u => u.id === m.id);
            if (up) {
                return { ...m, clientId: up.clientId, abonoId: up.abonoId, status: up.status, updatedAt: nowStr };
            }
            return m;
        });
        setMachines(updatedMachines);

        // Save state to storage
        saveStateToLocalStorage({ rentals: updatedRentals, machines: updatedMachines });

        // Enqueue sync actions
        enqueueSyncItem(rentalWithTime.id, 'rentals', 'create', rentalWithTime);
        machineUpdates.forEach(up => {
            const fullMachine = updatedMachines.find(m => m.id === up.id);
            if (fullMachine) {
                enqueueSyncItem(fullMachine.id, 'machines', 'update', fullMachine);
            }
        });
    }, [enqueueSyncItem]);

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
                    return { ...m, clientId: up.clientId, abonoId: up.abonoId, status: up.status, updatedAt: nowStr };
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
    }, [enqueueSyncItem]);

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
                    return { ...m, status: machineUpdate.status, updatedAt: nowStr };
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
    }, [enqueueSyncItem]);

    const addReadingAction = useCallback((reading: Reading, machineUpdate?: { id: string; currentCounter: number }) => {
        const nowStr = new Date().toISOString();
        const readingWithTime = { ...reading, updatedAt: nowStr, createdAt: reading.createdAt || nowStr };

        const exists = stateRef.current.readings.some(r => r.id === reading.id);
        const operation = exists ? 'update' : 'create';

        const updatedReadings = exists
            ? stateRef.current.readings.map(r => r.id === reading.id ? readingWithTime : r)
            : [...stateRef.current.readings.filter(r => !(r.machineId === reading.machineId && r.month === reading.month)), readingWithTime];
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

        enqueueSyncItem(readingWithTime.id, 'readings', operation, readingWithTime);
        if (machineUpdate) {
            const fullMachine = updatedMachines.find(m => m.id === machineUpdate.id);
            if (fullMachine) {
                enqueueSyncItem(fullMachine.id, 'machines', 'update', fullMachine);
            }
        }
    }, [enqueueSyncItem]);

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
    }, [enqueueSyncItem]);

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
    }, [enqueueSyncItem]);

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
    }, [enqueueSyncItem]);

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
    }, [enqueueSyncItem]);

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
                setTemplates,
                machinePresets,
                setMachinePresets,
                gestiones,
                setGestiones,
                cobranzaConfig,
                setCobranzaConfig,
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
