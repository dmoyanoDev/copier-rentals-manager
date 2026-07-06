'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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

    // Fetch snapshot from backend database
    const syncFromDatabase = async () => {
        if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            if (path.startsWith('/login') || path.startsWith('/forgot-password') || path.startsWith('/reset-password')) {
                return;
            }
        }

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
                    setClients(parsed.clients || []);
                    setMachines(parsed.machines || []);
                    setReadings(parsed.readings || []);
                    setTickets(parsed.tickets || []);
                    setAbonos(parsed.plans || parsed.abonos || []);
                    setUsers(parsed.users || []);
                    if (parsed.rentals) setRentals(parsed.rentals);
                    setBudgets(parsed.budgets || []);
                    
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

                    // Sync localStorage immediately to match
                    const stateToSave = {
                        clients: parsed.clients || [],
                        machines: parsed.machines || [],
                        readings: parsed.readings || [],
                        tickets: parsed.tickets || [],
                        abonos: parsed.plans || parsed.abonos || [],
                        users: parsed.users || [],
                        rentals: parsed.rentals || [],
                        budgets: parsed.budgets || [],
                        templates: parsed.templates || [],
                        machinePresets: parsed.machinePresets || [],
                        gestiones: parsed.gestiones || [],
                        cobranzaConfig: parsed.cobranzaConfig || defaultCobranzaConfig
                    };
                    localStorage.setItem('ms_data', JSON.stringify(stateToSave));
                }
            } else {
                throw new Error("HTTP error " + response.status);
            }
        } catch (err) {
            console.error("Error sincronizando de la base de datos:", err);
            setSyncError("Error de sincronización (Modo Offline)");
        } finally {
            setIsSyncing(false);
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
                        setCurrentUser({
                            id: parsed.user.id,
                            username: parsed.user.username,
                            fullname: parsed.user.fullname,
                            email: parsed.data?.email || parsed.user.email || '',
                            role: parsed.user.role,
                        });
                        // Solo sincronizar si está autenticado
                        syncFromDatabase();
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
        // Prevent saving if no authenticated user or empty state lists on mount
        if (!currentUser) {
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
                    throw new Error("HTTP error " + response.status);
                }
                setLastSyncTime(new Date());
                setSyncError(null);
            } catch (err) {
                console.error("Error auto-guardando en la nube:", err);
                setSyncError("Sin conexión (Trabajando en modo local)");
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
