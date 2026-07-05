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
    plantillaEmail: 'Estimado cliente,\n\nLe recordamos que posee un saldo pendiente de {monto_saldo} de los cuales {monto_vencido} se encuentran vencidos.\n\nPor favor regularice su cuenta.\n\nCopyRent',
    plantillaWhatsapp: 'Hola! Te compartimos el aviso de cuenta corriente CopyRent. Tu saldo pendiente es {monto_saldo}. Comprobantes impagos: {cant_impagos}.',
    
    plantillaPreventivoEmail: 'Estimado cliente,\n\nLe recordamos preventivamente que posee facturas próximas a vencer por un total de {monto_saldo}.\n\nAtentamente,\nCopyRent',
    plantillaPreventivoWhatsapp: 'Hola! Te recordamos preventivamente que tu factura CopyRent por {monto_saldo} está próxima a vencer. ¡Que tengas un buen día!',
    plantillaDeudaVencidaEmail: 'Estimado cliente,\n\nLe informamos que registra comprobantes vencidos impagos por un total de {monto_vencido}. Solicitamos regularizar su situación a la brevedad.\n\nAtentamente,\nCopyRent',
    plantillaDeudaVencidaWhatsapp: 'Hola! Tu cuenta presenta un saldo vencido de {monto_vencido}. Agradecemos coordinar el pago a la brevedad para evitar recargos.',
    plantillaSegundoAvisoEmail: 'IMPORTANTE: SEGUNDO AVISO DE DEUDA\n\nEstimado cliente,\n\nReiteramos aviso por saldo impago de {monto_vencido} con mora acumulada. Por favor, comuníquese con administración.\n\nAtentamente,\nCopyRent',
    plantillaSegundoAvisoWhatsapp: '⚠️ SEGUNDO AVISO: Aún no registramos el pago de tu saldo de {monto_vencido}. Por favor, envíanos el comprobante si ya transferiste.',
    plantillaPagoRecibidoEmail: 'Estimado cliente,\n\nConfirmamos la recepción del pago por un importe de {monto_pago}. Agradecemos su puntualidad.\n\nAtentamente,\nCopyRent',
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

    useEffect(() => {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        setCurrentMonth(`${yyyy}-${mm}`);

        const localData = localStorage.getItem('copyrent_data');
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

                // Load collection states
                setGestiones(parsed.gestiones || defaultGestiones);
                
                // Merge default keys for multiple templates if older settings exist
                if (parsed.cobranzaConfig) {
                    setCobranzaConfig({
                        ...defaultCobranzaConfig,
                        ...parsed.cobranzaConfig
                    });
                } else {
                    setCobranzaConfig(defaultCobranzaConfig);
                }

                const uList = parsed.users || mockUsers;
                setCurrentUser(uList[0]);
                return;
            } catch (e) {
                console.error(e);
            }
        }
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
        setCurrentUser(mockUsers[0]);
    }, []);

    // Save to localStorage when state changes
    useEffect(() => {
        if (clients.length > 0) {
            const stateToSave = { 
                clients, 
                machines, 
                readings, 
                tickets, 
                abonos, 
                users,
                rentals,
                budgets,
                templates,
                machinePresets,
                gestiones,
                cobranzaConfig
            };
            localStorage.setItem('copyrent_data', JSON.stringify(stateToSave));
        }
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
                setCobranzaConfig
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
