'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
    Client,
    Machine,
    Reading,
    Ticket,
    User,
    Abono,
    Rental,
    mockClients,
    mockMachines,
    mockReadings,
    mockTickets,
    mockUsers,
    mockAbonos,
    mockRentals
} from './mockData';
import { Budget, BudgetTemplate, MachinePreset } from '@/domain/budget/types';
import { BRANDING } from '@/config/branding';
import { defaultMachinePresets, defaultBudgetTemplates } from '@/domain/budget/presets';

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
    syncFromDatabase: () => Promise<void>;
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

const mergeData = (local: any, server: any) => {
    const merged = { ...local };
    const tables = ['clients', 'machines', 'readings', 'tickets', 'abonos', 'users', 'rentals', 'budgets'];
    
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
                mergedList.push(localItem);
            } else {
                const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
                const serverTime = new Date(serverItem.updatedAt || serverItem.createdAt || 0).getTime();
                if (localTime >= serverTime) {
                    mergedList.push(localItem);
                } else {
                    mergedList.push(serverItem);
                }
            }
        }
        
        // 2. Process server items
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

    const isSyncingRef = useRef(false);
    const isInitialLoadRef = useRef(true);

    // Fetch snapshot from backend database
    const syncFromDatabase = async (forceUser?: User | null) => {
        const activeUser = forceUser !== undefined ? forceUser : currentUser;
        if (!activeUser) {
            return;
        }

        if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            if (path.startsWith('/login') || path.startsWith('/forgot-password') || path.startsWith('/reset-password')) {
                return;
            }
        }

        isSyncingRef.current = true;
        setIsSyncing(true);
        try {
            const response = await fetch('/api/backup?user=system');
            if (response.ok) {
                const parsed = await response.json();
                
                // Only overwrite if remote database contains actual data
                const hasServerData = 
                    (parsed.clients && parsed.clients.length > 0) || 
                    (parsed.budgets && parsed.budgets.length > 0) ||
                    (parsed.machines && parsed.machines.length > 0);
                    
                if (hasServerData) {
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
                    if (typeof window !== 'undefined') {
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

                    const merged = mergeData(currentLocalState, parsed);

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
                    
                    setLastSyncTime(new Date());
                    setSyncError(null);

                    const stateToSave = {
                        clients: merged.clients || [],
                        machines: merged.machines || [],
                        readings: merged.readings || [],
                        tickets: merged.tickets || [],
                        abonos: merged.abonos || [],
                        users: merged.users || [],
                        rentals: merged.rentals || [],
                        budgets: merged.budgets || [],
                        templates: parsed.templates || [],
                        machinePresets: parsed.machinePresets || [],
                        gestiones: parsed.gestiones || [],
                        cobranzaConfig: parsed.cobranzaConfig || defaultCobranzaConfig
                    };
                    localStorage.setItem('ms_data', JSON.stringify(stateToSave));

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
                if (response.status === 401) {
                    setSyncError("UNAUTHORIZED");
                    setCurrentUser(null);
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
            } else if (err.message?.includes("HTTP error 500")) {
                setSyncError("DB_ERROR");
            } else {
                setSyncError("OFFLINE");
            }
        } finally {
            setIsSyncing(false);
            // Allow state updates to settle before resetting sync ref
            setTimeout(() => {
                isSyncingRef.current = false;
            }, 1000);
        }
    };

    useEffect(() => {
        async function fetchMe() {
            if (typeof window !== 'undefined') {
                const path = window.location.pathname;
                if (path.startsWith('/login') || path.startsWith('/forgot-password') || path.startsWith('/reset-password')) {
                    setCurrentUser(null);
                    return;
                }
            }
            try {
                const res = await fetch('/api/auth/me');
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
                        // Solo sincronizar si está autenticado (pasando el usuario directamente para evitar delay del batch update)
                        syncFromDatabase(u);
                    } else {
                        setCurrentUser(null);
                    }
                } else {
                    setCurrentUser(null);
                }
            } catch (err) {
                console.error('Error al recuperar sesión en ManagementProvider:', err);
                setCurrentUser(null);
            }
        }

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        setCurrentMonth(`${yyyy}-${mm}`);

        let localData = localStorage.getItem('ms_data');
        if (!localData) {
            const legacyData = localStorage.getItem('copyrent_data');
            if (legacyData) {
                localStorage.setItem('ms_data', legacyData);
                localData = legacyData;
            }
        }
        
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                setClients(parsed.clients || mockClients);
                setMachines(parsed.machines || mockMachines);
                setReadings(parsed.readings || mockReadings);
                setTickets(parsed.tickets || mockTickets);
                setAbonos(parsed.abonos || mockAbonos);
                setUsers(parsed.users || mockUsers);
                setRentals(parsed.rentals || mockRentals);
                setBudgets(parsed.budgets || []);
                
                const loadedTemplates = parsed.templates || [];
                const defaultIds = defaultBudgetTemplates.map(t => t.id);
                const customTemplates = loadedTemplates.filter((t: any) => !defaultIds.includes(t.id));
                setTemplates([...defaultBudgetTemplates, ...customTemplates]);

                setMachinePresets(parsed.machinePresets || defaultMachinePresets);
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
            setClients(mockClients);
            setMachines(mockMachines);
            setReadings(mockReadings);
            setTickets(mockTickets);
            setAbonos(mockAbonos);
            setUsers(mockUsers);
            setRentals(mockRentals);
            setBudgets([]);
            setTemplates(defaultBudgetTemplates);
            setMachinePresets(defaultMachinePresets);
            setGestiones(defaultGestiones);
            setCobranzaConfig(defaultCobranzaConfig);
        }

        fetchMe();

        // Release initial load lock after states are populated and settled
        setTimeout(() => {
            isInitialLoadRef.current = false;
        }, 1500);
    }, []);

    // Re-sync when page refocuses, tab changes or network goes online
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

        return () => {
            window.removeEventListener('focus', handleSyncTrigger);
            window.removeEventListener('online', handleSyncTrigger);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Save changes to localStorage immediately, and debounced save to remote database
    useEffect(() => {
        // Prevent saving if no authenticated user or if the app is during initial load or synchronizing from backend
        if (!currentUser || isInitialLoadRef.current || isSyncingRef.current) {
            return;
        }
        if (clients.length === 0 && budgets.length === 0 && machines.length === 0) {
            return;
        }

        const stateToSave = { 
            clients, 
            machines, 
            readings, 
            tickets, 
            plans: abonos,
            abonos,
            users,
            rentals,
            budgets,
            templates,
            machinePresets,
            gestiones,
            cobranzaConfig
        };

        // Track deletions first by comparing with the existing localStorage state
        trackDeletions(stateToSave);

        // Sync local storage write
        localStorage.setItem('ms_data', JSON.stringify(stateToSave));

        // Debounced remote cloud save
        const delayDebounceFn = setTimeout(async () => {
            try {
                const response = await fetch('/api/backup?user=autosave', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(stateToSave)
                });
                if (!response.ok) {
                    if (response.status === 401) {
                        setSyncError("UNAUTHORIZED");
                        setCurrentUser(null);
                        return;
                    }
                    if (response.status === 500) {
                        setSyncError("DB_ERROR");
                        return;
                    }
                    throw new Error("HTTP error " + response.status);
                }
                setLastSyncTime(new Date());
                setSyncError(null);
                localStorage.removeItem('ms_deleted_ids');
            } catch (err: any) {
                console.error("Error auto-guardando en la nube:", err);
                if (err.message?.includes("HTTP error 401")) {
                    setSyncError("UNAUTHORIZED");
                    setCurrentUser(null);
                } else if (err.message?.includes("HTTP error 500")) {
                    setSyncError("DB_ERROR");
                } else {
                    setSyncError("OFFLINE");
                }
            }
        }, 3000); // 3 seconds debounce

        return () => clearTimeout(delayDebounceFn);
    }, [clients, machines, readings, tickets, abonos, users, rentals, budgets, templates, machinePresets, gestiones, cobranzaConfig]);

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
                syncFromDatabase
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
