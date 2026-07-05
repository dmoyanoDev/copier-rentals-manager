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

interface ManagementContextType {
    currentMonth: string;
    setCurrentMonth: (month: string) => void;
    currentUser: User | null;
    setCurrentUser: (user: User | null) => void;
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
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
}

const ManagementContext = createContext<ManagementContextType | undefined>(undefined);

export const ManagementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentMonth, setCurrentMonth] = useState('');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [clients, setClients] = useState<Client[]>([]);
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

    useEffect(() => {
        // Dynamic initial month YYYY-MM
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        setCurrentMonth(`${yyyy}-${mm}`);

        // Load mock data or local storage
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
                
                // Budgets loaded states
                setBudgets(parsed.budgets || []);
                
                const loadedTemplates = parsed.templates || [];
                const defaultIds = defaultBudgetTemplates.map(t => t.id);
                const customTemplates = loadedTemplates.filter((t: any) => !defaultIds.includes(t.id));
                setTemplates([...defaultBudgetTemplates, ...customTemplates]);

                setMachinePresets(parsed.machinePresets || defaultMachinePresets);

                // Set default admin user initially from loaded list
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
                machinePresets
            };
            localStorage.setItem('copyrent_data', JSON.stringify(stateToSave));
        }
    }, [clients, machines, readings, tickets, abonos, users, rentals, budgets, templates, machinePresets]);

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
                setMachinePresets
            }}
        >
            {children}
        </ManagementContext.Provider>
    );
};

export const useManagement = () => {
    const context = useContext(ManagementContext);
    if (context === undefined) {
        throw new Error('useManagement must be used within a ManagementProvider');
    }
    return context;
};
