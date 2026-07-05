'use client';

import React, { useState, useEffect } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Ticket, User } from '@/lib/mockData';
import { 
    Plus, Edit, User as UserIcon, Calendar, Settings, AlertTriangle, 
    Search, Filter, Shield, Wrench, X, Clock, DollarSign, Activity, 
    CheckCircle, HelpCircle, Check, ArrowRight, Phone, Mail, MapPin
} from 'lucide-react';

export default function TechnicalPage() {
    const { tickets, setTickets, currentUser, users, clients, machines } = useManagement();
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isTechListOpen, setIsTechListOpen] = useState(false);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTech, setFilterTech] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterSla, setFilterSla] = useState(''); // 'vencido' | 'por_vencer' | 'ok'
    const [activeTab, setActiveTab] = useState<string>('todos'); // KPI category filter

    // Edit Form temporary states (for detail drawer)
    const [editStatus, setEditStatus] = useState<Ticket['status']>('nuevo');
    const [editDiagnostic, setEditDiagnostic] = useState('');
    const [editActionTaken, setEditActionTaken] = useState('');
    const [editPartsUsed, setEditPartsUsed] = useState('');
    const [editPartsNeeded, setEditPartsNeeded] = useState('');
    const [editAssignedTechId, setEditAssignedTechId] = useState('');
    const [editTechnicalCost, setEditTechnicalCost] = useState('0');
    const [editObservations, setEditObservations] = useState('');

    // Creation Form states
    const [newClientType, setNewClientType] = useState<'existente' | 'externo'>('existente');
    const [newClientId, setNewClientId] = useState('');
    
    // Externo client manual inputs
    const [newClientName, setNewClientName] = useState('');
    const [newClientAddress, setNewClientAddress] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientEmail, setNewClientEmail] = useState('');
    const [newClientContact, setNewClientContact] = useState('');
    const [newMachineDesc, setNewMachineDesc] = useState('');
    const [newSerialNumber, setNewSerialNumber] = useState('');

    const [newMachineId, setNewMachineId] = useState('');
    const [newCategory, setNewCategory] = useState('Servicio');
    const [newPriority, setNewPriority] = useState<'baja' | 'media' | 'alta' | 'urgente'>('media');
    const [newDescription, setNewDescription] = useState('');
    const [newAssignedTechId, setNewAssignedTechId] = useState('');

    // Load URL ticket query if any
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const ticketId = params.get('ticketId');
            if (ticketId) {
                const t = tickets.find(x => x.id === ticketId);
                if (t) handleOpenDetail(t);
            }
        }
    }, [tickets]);

    // SLA automatic calculation based on priority
    const calculateSlaDate = (priority: 'baja' | 'media' | 'alta' | 'urgente'): Date => {
        const now = new Date();
        if (priority === 'urgente' || priority === 'alta') {
            now.setHours(now.getHours() + 4); // 4 horas
        } else if (priority === 'media') {
            now.setDate(now.getDate() + 1); // 24 horas
        } else {
            now.setDate(now.getDate() + 2); // 48 horas
        }
        return now;
    };

    // Helper to calculate SLA label and status
    const getSlaStatus = (slaDateStr: string, status: string) => {
        if (status === 'resuelto' || status === 'cerrado') {
            return { text: 'Cumplido', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', status: 'ok' };
        }
        const now = new Date();
        const sla = new Date(slaDateStr);
        if (isNaN(sla.getTime())) {
            return { text: 'Sin definir', color: 'text-slate-400 bg-slate-900 border-slate-800', status: 'ok' };
        }

        const diffMs = sla.getTime() - now.getTime();
        if (diffMs < 0) {
            return { text: 'VENCIDO', color: 'text-red-500 bg-red-500/10 border-red-500/20 font-extrabold animate-pulse', status: 'vencido', overdue: true };
        }
        const diffHours = diffMs / (1000 * 60 * 60);
        if (diffHours < 4) {
            return { text: 'Por vencer (<4h)', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20 font-bold', status: 'por_vencer', warning: true };
        }
        return { 
            text: `Vence: ${sla.toLocaleDateString('es-AR')} ${sla.toLocaleTimeString('es-AR').slice(0, 5)}`, 
            color: 'text-slate-400 bg-slate-900 border-slate-800', 
            status: 'ok' 
        };
    };

    // Client-side helper to post notification request to backend
    const notifyTech = async (event: string, ticket: Ticket, tech: User) => {
        try {
            const response = await fetch('/api/tickets/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event, ticket, tech }),
            });
            const data = await response.json();
            return data.result?.logAction || `Notificación enviada por el evento: ${event}`;
        } catch (e) {
            console.error('Error al enviar la notificación técnica:', e);
            return `Aviso técnico fallido para el evento: ${event}`;
        }
    };

    // Select ticket for detail drawer
    const handleOpenDetail = (t: Ticket) => {
        setSelectedTicket(t);
        setEditStatus(t.status);
        setEditDiagnostic(t.diagnostic || '');
        setEditActionTaken(t.actionTaken || '');
        setEditPartsUsed(t.partsUsed || '');
        setEditPartsNeeded(t.partsNeeded || '');
        setEditAssignedTechId(t.assignedTechId || '');
        setEditTechnicalCost(String(t.technicalCost || 0));
        setEditObservations(t.observations || '');
    };

    // Handle saving ticket changes from the details sidebar
    const handleSaveTicketDetails = async () => {
        if (!selectedTicket) return;

        // 1. VALIDACIÓN: Obligatorio técnico si el estado es diferente de 'nuevo'
        if (editStatus !== 'nuevo' && !editAssignedTechId) {
            alert('¡Atención! Para cambiar el estado del ticket a uno diferente de "Nuevo", debe asignar un técnico responsable.');
            return;
        }

        const currentTech = users.find(u => u.id === editAssignedTechId);
        const originalTech = users.find(u => u.id === selectedTicket.assignedTechId);
        
        let newHistory = [...(selectedTicket.history || [])];

        // Reglas de historial y notificaciones
        let notificationPromise: Promise<string> | null = null;

        // A. Cambio de estado
        if (selectedTicket.status !== editStatus) {
            newHistory.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: `Cambio de estado a: ${editStatus.toUpperCase()}`,
                user: currentUser?.fullname || 'Sistema'
            });

            // Disparar alertas de estado (esperando repuesto o resuelto)
            if (editStatus === 'esperando-repuesto' && currentTech) {
                notificationPromise = notifyTech('esperando_repuesto', selectedTicket, currentTech);
            } else if (editStatus === 'resuelto' && currentTech) {
                notificationPromise = notifyTech('resuelto', selectedTicket, currentTech);
            }
        }

        // B. Asignación / Reasignación de técnico
        if (selectedTicket.assignedTechId !== editAssignedTechId && editAssignedTechId) {
            const actionText = originalTech 
                ? `Reasignado de ${originalTech.fullname} a ${currentTech?.fullname}`
                : `Asignado al técnico ${currentTech?.fullname}`;
            
            newHistory.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: actionText,
                user: currentUser?.fullname || 'Sistema'
            });

            if (currentTech) {
                const eventType = originalTech ? 'reasignado' : 'asignado';
                notificationPromise = notifyTech(eventType, selectedTicket, currentTech);
            }
        }

        const isResolvedState = editStatus === 'resuelto';
        const isClosedState = editStatus === 'cerrado';

        // Estructurar ticket actualizado
        const updated: Ticket = {
            ...selectedTicket,
            status: editStatus,
            diagnostic: editDiagnostic,
            actionTaken: editActionTaken,
            partsUsed: editPartsUsed,
            partsNeeded: editPartsNeeded,
            assignedTechId: editAssignedTechId || null,
            technicalCost: Number(editTechnicalCost) || 0,
            observations: editObservations,
            history: newHistory,
            resolvedAt: isResolvedState ? Date.now() : selectedTicket.resolvedAt,
            closedAt: isClosedState ? Date.now() : selectedTicket.closedAt
        };

        // Si se disparó una notificación en el backend, esperar su resultado para ingresarlo en el historial
        if (notificationPromise) {
            const logActionText = await notificationPromise;
            updated.history?.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: logActionText,
                user: 'Sistema'
            });
        }

        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updated : t));
        setSelectedTicket(updated);
        alert('¡Ticket técnico guardado y actualizado con éxito!');
    };

    // Open creation modal
    const handleOpenCreate = () => {
        setNewClientType('existente');
        setNewClientId('');
        setNewClientName('');
        setNewClientAddress('');
        setNewClientPhone('');
        setNewClientEmail('');
        setNewClientContact('');
        setNewMachineId('');
        setNewMachineDesc('');
        setNewSerialNumber('');
        setNewCategory('Servicio');
        setNewPriority('media');
        setNewDescription('');
        setNewAssignedTechId('');
        setIsCreating(true);
    };

    // Handle ticket creation logic
    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        
        let clientNameVal = '';
        let clientAddressVal = '';
        let clientPhoneVal = '';
        let clientEmailVal = '';
        let clientContactVal = '';
        let machineDescVal = '';
        let serialVal = '';

        if (newClientType === 'existente') {
            const client = clients.find(c => c.id === newClientId);
            const machine = machines.find(m => m.id === newMachineId);

            if (!client || !machine) {
                alert('Por favor selecciona un cliente y un equipo del inventario.');
                return;
            }
            clientNameVal = client.name;
            clientAddressVal = client.address;
            clientPhoneVal = client.phone || '';
            clientEmailVal = client.email || '';
            clientContactVal = client.name;
            machineDescVal = `${machine.brand} ${machine.model}`;
            serialVal = machine.serial;
        } else {
            // Externo manual fields
            if (!newClientName || !newMachineDesc) {
                alert('Por favor ingresa al menos el Nombre del Cliente y la Descripción de la Máquina.');
                return;
            }
            clientNameVal = newClientName;
            clientAddressVal = newClientAddress;
            clientPhoneVal = newClientPhone;
            clientEmailVal = newClientEmail;
            clientContactVal = newClientContact;
            machineDescVal = newMachineDesc;
            serialVal = newSerialNumber;
        }

        // Calular SLA automáticamente por prioridad
        const computedSla = calculateSlaDate(newPriority);

        // Crear objeto ticket inicial
        const initialTicket: Ticket = {
            id: 'ticket-' + Date.now(),
            machineId: newClientType === 'existente' ? newMachineId : null,
            clientId: newClientType === 'existente' ? newClientId : null,
            clientName: clientNameVal,
            clientAddress: clientAddressVal,
            clientPhone: clientPhoneVal,
            clientEmail: clientEmailVal,
            clientContact: clientContactVal,
            machineDesc: machineDescVal,
            serialNumber: serialVal,
            clientType: newClientType,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
            priority: newPriority,
            status: newAssignedTechId ? 'asignado' : 'nuevo',
            category: newCategory,
            description: newDescription,
            diagnostic: '',
            actionTaken: '',
            partsNeeded: '',
            partsUsed: '',
            internalNotes: '',
            assignedTechId: newAssignedTechId || null,
            slaDate: computedSla.toISOString(),
            createdAt: Date.now(),
            history: [
                {
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                    action: 'Ticket de soporte técnico registrado en el sistema.',
                    user: currentUser?.fullname || 'Sistema'
                }
            ]
        };

        const assignedTech = users.find(u => u.id === newAssignedTechId);
        
        // Si tiene técnico asignado desde la creación, añadir log e invocar notificador
        if (assignedTech) {
            initialTicket.history?.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: `Asignado en creación al técnico ${assignedTech.fullname}`,
                user: currentUser?.fullname || 'Sistema'
            });

            // Disparar notificador
            const logText = await notifyTech('creado', initialTicket, assignedTech);
            initialTicket.history?.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: logText,
                user: 'Sistema'
            });
        }

        setTickets(prev => [...prev, initialTicket]);
        setIsCreating(false);
        handleOpenDetail(initialTicket);
    };

    // KPIs Calculations
    const totalCount = tickets.length;
    const newCount = tickets.filter(t => t.status === 'nuevo').length;
    const activeCount = tickets.filter(t => ['asignado', 'en-camino', 'en-proceso'].includes(t.status)).length;
    const partsWaitCount = tickets.filter(t => t.status === 'esperando-repuesto').length;
    const resolvedCount = tickets.filter(t => ['resuelto', 'cerrado'].includes(t.status)).length;
    const criticalCount = tickets.filter(t => {
        const slaState = getSlaStatus(t.slaDate, t.status);
        return slaState.status === 'vencido' || slaState.status === 'por_vencer';
    }).length;

    // Filters and search logic
    const filteredTickets = tickets.filter(t => {
        // Search query
        const query = searchQuery.toLowerCase();
        const matchesQuery = 
            t.clientName.toLowerCase().includes(query) ||
            t.machineDesc.toLowerCase().includes(query) ||
            (t.serialNumber && t.serialNumber.toLowerCase().includes(query)) ||
            t.id.toLowerCase().includes(query);

        // Tech filter
        const matchesTech = !filterTech || t.assignedTechId === filterTech;

        // Priority filter
        const matchesPriority = !filterPriority || t.priority === filterPriority;

        // Status filter
        const matchesStatus = !filterStatus || t.status === filterStatus;

        // SLA status filter
        const slaState = getSlaStatus(t.slaDate, t.status);
        const matchesSla = !filterSla || slaState.status === filterSla;

        // KPI active tab filter
        let matchesTab = true;
        if (activeTab === 'nuevos') matchesTab = t.status === 'nuevo';
        else if (activeTab === 'activos') matchesTab = ['asignado', 'en-camino', 'en-proceso'].includes(t.status);
        else if (activeTab === 'esperando') matchesTab = t.status === 'esperando-repuesto';
        else if (activeTab === 'resueltos') matchesTab = ['resuelto', 'cerrado'].includes(t.status);
        else if (activeTab === 'criticos') matchesTab = slaState.status === 'vencido' || slaState.status === 'por_vencer';

        return matchesQuery && matchesTech && matchesPriority && matchesStatus && matchesSla && matchesTab;
    });

    const isTech = currentUser?.role === 'tecnico';
    const clientMachines = machines.filter(m => m.clientId === newClientId);

    return (
        <div className="space-y-6 animate-fade-in relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                    <h2 className="text-base font-semibold text-slate-100 uppercase tracking-wider">Módulo de Asistencia Técnica</h2>
                    <p className="text-[10px] text-slate-400">Seguimiento de incidencias, SLA y despacho técnico de copiadoras M&S.</p>
                </div>
                {!isTech && (
                    <Button variant="primary" size="sm" onClick={handleOpenCreate}>
                        <Plus size={16} className="mr-1.5" /> Abrir Nuevo Ticket
                    </Button>
                )}
            </div>

            {/* KPIs Grid Toolbar */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 pt-1">
                <button 
                    onClick={() => setActiveTab('todos')}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                        activeTab === 'todos' 
                            ? 'bg-slate-900 border-indigo-500/50 shadow-lg shadow-indigo-950/20' 
                            : 'bg-slate-950 border-slate-850/60 hover:bg-slate-900/60'
                    }`}
                >
                    <span className="block text-[9px] uppercase font-bold text-slate-450">Total Tickets</span>
                    <span className="block text-lg font-extrabold text-slate-100 mt-1">{totalCount}</span>
                </button>
                <button 
                    onClick={() => setActiveTab('nuevos')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                        activeTab === 'nuevos' 
                            ? 'bg-slate-900 border-violet-500/50 shadow-lg shadow-violet-950/20' 
                            : 'bg-slate-950 border-slate-850/60 hover:bg-slate-900/60'
                    }`}
                >
                    <span className="block text-[9px] uppercase font-bold text-slate-450">Nuevos (Triage)</span>
                    <span className="block text-lg font-extrabold text-violet-400 mt-1">{newCount}</span>
                </button>
                <button 
                    onClick={() => setActiveTab('activos')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                        activeTab === 'activos' 
                            ? 'bg-slate-900 border-amber-500/50 shadow-lg shadow-amber-950/20' 
                            : 'bg-slate-950 border-slate-850/60 hover:bg-slate-900/60'
                    }`}
                >
                    <span className="block text-[9px] uppercase font-bold text-slate-450">Activos / En Proceso</span>
                    <span className="block text-lg font-extrabold text-amber-400 mt-1">{activeCount}</span>
                </button>
                <button 
                    onClick={() => setActiveTab('esperando')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                        activeTab === 'esperando' 
                            ? 'bg-slate-900 border-orange-500/50 shadow-lg shadow-orange-950/20' 
                            : 'bg-slate-950 border-slate-850/60 hover:bg-slate-900/60'
                    }`}
                >
                    <span className="block text-[9px] uppercase font-bold text-slate-450">Esperando Repuesto</span>
                    <span className="block text-lg font-extrabold text-orange-450 mt-1">{partsWaitCount}</span>
                </button>
                <button 
                    onClick={() => setActiveTab('resueltos')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                        activeTab === 'resueltos' 
                            ? 'bg-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-950/20' 
                            : 'bg-slate-950 border-slate-850/60 hover:bg-slate-900/60'
                    }`}
                >
                    <span className="block text-[9px] uppercase font-bold text-slate-450">Resueltos / Cerrados</span>
                    <span className="block text-lg font-extrabold text-emerald-450 mt-1">{resolvedCount}</span>
                </button>
                <button 
                    onClick={() => setActiveTab('criticos')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                        activeTab === 'criticos' 
                            ? 'bg-slate-900 border-red-500/50 shadow-lg shadow-red-950/20' 
                            : 'bg-slate-950 border-slate-850/60 hover:bg-slate-900/60'
                    }`}
                >
                    <span className="block text-[9px] uppercase font-bold text-slate-450 flex items-center gap-1">
                        SLA Críticos {criticalCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />}
                    </span>
                    <span className="block text-lg font-extrabold text-red-500 mt-1">{criticalCount}</span>
                </button>
            </div>

            {/* Filters Toolbar */}
            <div className="p-4 bg-slate-950 border border-slate-850/60 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Filter size={14} /> Filtros de Asistencia
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                            <Search size={14} />
                        </span>
                        <input
                            type="text"
                            placeholder="Buscar cliente, modelo, serie..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                    <select
                        value={filterTech}
                        onChange={(e) => setFilterTech(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-350 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="">Técnico Responsable: Todos</option>
                        {users.filter(u => u.role === 'tecnico').map(u => (
                            <option key={u.id} value={u.id}>{u.fullname}</option>
                        ))}
                    </select>
                    <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-350 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="">Prioridad: Todas</option>
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                        <option value="urgente">Urgente</option>
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-350 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="">Estado: Todos</option>
                        <option value="nuevo">Nuevo</option>
                        <option value="asignado">Asignado</option>
                        <option value="en-camino">En Camino</option>
                        <option value="en-proceso">En Proceso</option>
                        <option value="esperando-repuesto">Esperando Repuesto</option>
                        <option value="resuelto">Resuelto</option>
                        <option value="cerrado">Cerrado</option>
                    </select>
                    <select
                        value={filterSla}
                        onChange={(e) => setFilterSla(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-350 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="">Estado SLA: Todos</option>
                        <option value="vencido">Vencido</option>
                        <option value="por_vencer">Por vencer (menor a 4h)</option>
                        <option value="ok">A tiempo / Cumplido</option>
                    </select>
                </div>
                {(searchQuery || filterTech || filterPriority || filterStatus || filterSla || activeTab !== 'todos') && (
                    <div className="flex justify-end">
                        <button 
                            onClick={() => {
                                setSearchQuery('');
                                setFilterTech('');
                                setFilterPriority('');
                                setFilterStatus('');
                                setFilterSla('');
                                setActiveTab('todos');
                            }}
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                            Limpiar todos los filtros y pestañas
                        </button>
                    </div>
                )}
            </div>

            {/* Main Tickets Table */}
            <TableContainer>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell>ID / Prioridad</TableHeaderCell>
                            <TableHeaderCell>Cliente</TableHeaderCell>
                            <TableHeaderCell>Equipo / Serie</TableHeaderCell>
                            <TableHeaderCell>Categoría / Falla</TableHeaderCell>
                            <TableHeaderCell>Técnico</TableHeaderCell>
                            <TableHeaderCell>Fecha Límite (SLA)</TableHeaderCell>
                            <TableHeaderCell>Estado</TableHeaderCell>
                            <TableHeaderCell className="text-right">Acción</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTickets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-12 text-slate-500 text-xs italic">
                                    No se encontraron tickets con los filtros actuales.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredTickets.map(t => {
                                const tech = users.find(u => u.id === t.assignedTechId);
                                const sla = getSlaStatus(t.slaDate, t.status);

                                return (
                                    <TableRow key={t.id} className="hover:bg-slate-900/45 cursor-pointer transition-colors" onClick={() => handleOpenDetail(t)}>
                                        <TableCell className="text-xs">
                                            <span className="block font-mono text-[10px] text-slate-500 mb-1">
                                                TCK-{t.id.replace('ticket-', '')}
                                            </span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider ${
                                                t.priority === 'urgente' || t.priority === 'alta' ? 'bg-red-500/10 text-red-500' :
                                                t.priority === 'media' ? 'bg-amber-500/10 text-amber-500' :
                                                'bg-emerald-500/10 text-emerald-500'
                                            }`}>
                                                {t.priority.toUpperCase()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-bold text-slate-100 max-w-[160px] truncate">
                                            {t.clientName}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-350">
                                            <strong>{t.machineDesc}</strong>
                                            <span className="block text-slate-500 text-[10px] font-mono mt-0.5">{t.serialNumber || 'Sin Nro Serie'}</span>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-350 max-w-[180px] truncate">
                                            <span className="font-bold text-indigo-400 block text-[10px]">{t.category}</span>
                                            <span className="text-slate-400 block mt-0.5">{t.description}</span>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {tech ? (
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-5 h-5 rounded-full bg-slate-800 text-[9px] font-bold text-indigo-450 flex items-center justify-center border border-slate-700">
                                                        {tech.fullname.split(' ').map(n => n[0]).join('')}
                                                    </div>
                                                    <span className="text-slate-300 font-semibold">{tech.fullname}</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500 italic">Sin asignar</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <span className={`px-2 py-0.5 rounded-xl border text-[9px] font-semibold ${sla.color}`}>
                                                {sla.text}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                                t.status === 'nuevo' ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/50' :
                                                t.status === 'asignado' ? 'bg-blue-950/60 text-blue-400 border border-blue-900/50' :
                                                t.status === 'en-camino' ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-900/50' :
                                                t.status === 'en-proceso' ? 'bg-amber-950/60 text-amber-400 border border-amber-900/50' :
                                                t.status === 'esperando-repuesto' ? 'bg-orange-950/60 text-orange-400 border border-orange-900/50' :
                                                t.status === 'resuelto' ? 'bg-emerald-950/60 text-emerald-450 border border-emerald-900/50' :
                                                'bg-slate-900 text-slate-500 border border-slate-800' // cerrado
                                            }`}>
                                                {t.status.replace('-', ' ')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenDetail(t); }}>
                                                Detalles →
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* DETAIL SLIDE-OVER DRAWER (PANEL LATERAL) */}
            {selectedTicket && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-xs animate-fade-in print:hidden">
                    <div className="absolute inset-0" onClick={() => setSelectedTicket(null)} />
                    <div className="relative max-w-md w-full bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col z-10 animate-slide-in">
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                            <div>
                                <span className="text-[10px] font-mono text-indigo-400 font-extrabold uppercase tracking-wider">Ficha Técnica</span>
                                <h3 className="font-bold text-sm text-slate-100 mt-0.5">Ticket TCK-{selectedTicket.id.replace('ticket-', '')}</h3>
                            </div>
                            <button className="text-slate-400 hover:text-white p-1" onClick={() => setSelectedTicket(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
                            {/* Priority and Category block */}
                            <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-850/60">
                                <div>
                                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Prioridad</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold mt-1 uppercase ${
                                        selectedTicket.priority === 'urgente' || selectedTicket.priority === 'alta' ? 'bg-red-500/10 text-red-500' :
                                        selectedTicket.priority === 'media' ? 'bg-amber-500/10 text-amber-500' :
                                        'bg-emerald-500/10 text-emerald-500'
                                    }`}>
                                        {selectedTicket.priority}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Categoría</span>
                                    <span className="font-bold text-slate-200 mt-1 block capitalize">{selectedTicket.category}</span>
                                </div>
                            </div>

                            {/* Client & Contact information */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-850 pb-1.5 uppercase text-[9px] tracking-wider">Datos del Cliente</h4>
                                <div className="space-y-2 bg-slate-950/20 p-3 rounded-xl border border-slate-850/30">
                                    <div className="flex items-start gap-2">
                                        <UserIcon size={14} className="text-slate-500 mt-0.5 shrink-0" />
                                        <div>
                                            <span className="font-bold text-slate-200 block">{selectedTicket.clientName}</span>
                                            {selectedTicket.clientContact && <span className="text-[10px] text-slate-400 block mt-0.5">Atención: {selectedTicket.clientContact}</span>}
                                        </div>
                                    </div>
                                    {selectedTicket.clientAddress && (
                                        <div className="flex items-start gap-2 text-[10px]">
                                            <MapPin size={14} className="text-slate-500 mt-0.5 shrink-0" />
                                            <span>{selectedTicket.clientAddress}</span>
                                        </div>
                                    )}
                                    <div className="flex gap-4 pt-1.5 border-t border-slate-850/50 mt-1.5 text-[10px]">
                                        {selectedTicket.clientPhone && (
                                            <a 
                                                href={`https://wa.me/${selectedTicket.clientPhone.replace(/[^0-9]/g, '')}`} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="flex items-center gap-1.5 text-emerald-500 hover:underline"
                                            >
                                                <Phone size={12} /> WhatsApp/Tel
                                            </a>
                                        )}
                                        {selectedTicket.clientEmail && (
                                            <a href={`mailto:${selectedTicket.clientEmail}`} className="flex items-center gap-1.5 text-indigo-400 hover:underline">
                                                <Mail size={12} /> Enviar Mail
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Machine Equipment description */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-850 pb-1.5 uppercase text-[9px] tracking-wider">Equipo Relacionado</h4>
                                <div className="bg-slate-950/20 p-3 rounded-xl border border-slate-850/30 space-y-1">
                                    <span className="font-bold text-slate-200 block text-xs">{selectedTicket.machineDesc}</span>
                                    <span className="text-[10px] text-slate-450 block font-mono">Nro Serie: {selectedTicket.serialNumber || 'Sin número registrado'}</span>
                                </div>
                            </div>

                            {/* Ticket Description */}
                            <div className="space-y-2">
                                <span className="text-[9px] uppercase font-bold text-slate-500 block">Falla Reportada / Solicitud</span>
                                <p className="p-3 bg-slate-900 border border-slate-850 rounded-xl leading-relaxed text-slate-250 font-medium">
                                    {selectedTicket.description}
                                </p>
                            </div>

                            {/* Quick Update Settings */}
                            <div className="space-y-4 pt-2 border-t border-slate-800">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-850 pb-1.5 uppercase text-[9px] tracking-wider">Formulario de Resolución y Control</h4>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Estado</label>
                                        <select
                                            value={editStatus}
                                            onChange={(e) => setEditStatus(e.target.value as Ticket['status'])}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none"
                                        >
                                            <option value="nuevo">Nuevo</option>
                                            <option value="asignado">Asignado</option>
                                            <option value="en-camino">En Camino</option>
                                            <option value="en-proceso">En Proceso</option>
                                            <option value="esperando-repuesto">Esperando Repuesto</option>
                                            <option value="resuelto">Resuelto</option>
                                            <option value="cerrado">Cerrado</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Técnico Asignado</label>
                                        <select
                                            disabled={isTech}
                                            value={editAssignedTechId}
                                            onChange={(e) => setEditAssignedTechId(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none disabled:opacity-50"
                                        >
                                            <option value="">Sin Asignar</option>
                                            {users.filter(u => u.role === 'tecnico').map(t => (
                                                <option key={t.id} value={t.id}>{t.fullname}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Diagnóstico de Falla</label>
                                    <textarea
                                        value={editDiagnostic}
                                        onChange={(e) => setEditDiagnostic(e.target.value)}
                                        placeholder="Detalla el problema técnico encontrado..."
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-200 text-xs h-16 resize-none outline-none focus:border-indigo-500/50"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Acción Realizada</label>
                                    <textarea
                                        value={editActionTaken}
                                        onChange={(e) => setEditActionTaken(e.target.value)}
                                        placeholder="Detalles sobre el trabajo correctivo..."
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-200 text-xs h-16 resize-none outline-none focus:border-indigo-500/50"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block">Repuestos Necesarios</label>
                                        <input
                                            type="text"
                                            value={editPartsNeeded}
                                            onChange={(e) => setEditPartsNeeded(e.target.value)}
                                            placeholder="Pieza a comprar/solicitar"
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-slate-200 text-xs outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block">Repuestos Utilizados</label>
                                        <input
                                            type="text"
                                            value={editPartsUsed}
                                            onChange={(e) => setEditPartsUsed(e.target.value)}
                                            placeholder="Repuestos instalados"
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-slate-200 text-xs outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block">Costo de Mano de Obra ($)</label>
                                        <input
                                            type="number"
                                            value={editTechnicalCost}
                                            onChange={(e) => setEditTechnicalCost(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-slate-200 text-xs outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 block">Fecha Límite SLA</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={selectedTicket.slaDate ? new Date(selectedTicket.slaDate).toLocaleString('es-AR') : 'No asignada'}
                                            className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-slate-500 text-xs outline-none disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Observaciones del Servicio</label>
                                    <textarea
                                        value={editObservations}
                                        onChange={(e) => setEditObservations(e.target.value)}
                                        placeholder="Comentarios adicionales del servicio técnico..."
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-200 text-xs h-16 resize-none outline-none"
                                    />
                                </div>

                                <Button variant="primary" size="md" className="w-full" onClick={handleSaveTicketDetails}>
                                    Actualizar y Notificar Cambios
                                </Button>
                            </div>

                            {/* Chronological History Timeline */}
                            <div className="space-y-3 pt-4 border-t border-slate-800">
                                <h4 className="font-bold text-indigo-400 border-b border-slate-850 pb-1.5 uppercase text-[9px] tracking-wider">Historial e Envíos del Ticket</h4>
                                <div className="space-y-3 pl-2 border-l border-slate-850 mt-2">
                                    {selectedTicket.history && selectedTicket.history.map((h, i) => (
                                        <div key={i} className="relative pl-4 space-y-0.5">
                                            <div className="absolute -left-[14.5px] top-1 w-2.5 h-2.5 rounded-full bg-slate-800 border-2 border-indigo-500" />
                                            <div className="flex justify-between items-center text-[9px] text-slate-500">
                                                <span>📅 {h.date} - {h.time}</span>
                                                <span className="font-bold text-slate-400">{h.user}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-300 font-medium">{h.action}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATION SUPPORT TICKET MODAL */}
            <Modal
                isOpen={isCreating}
                onClose={() => setIsCreating(false)}
                title="Registrar Nuevo Ticket Técnico"
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleCreateTicket}>
                            Registrar Asistencia
                        </Button>
                    </>
                }
            >
                <form className="space-y-4" onSubmit={handleCreateTicket}>
                    <div className="grid grid-cols-2 gap-4">
                        <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${
                            newClientType === 'existente' 
                                ? 'bg-slate-900 border-indigo-500 text-slate-100 font-bold' 
                                : 'bg-slate-950 border-slate-850 hover:bg-slate-900/50 text-slate-400'
                        }`}>
                            <input 
                                type="radio" 
                                name="clientType" 
                                checked={newClientType === 'existente'} 
                                onChange={() => setNewClientType('existente')} 
                                className="hidden" 
                            />
                            <span>Cliente Existente</span>
                        </label>
                        <label className={`flex items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${
                            newClientType === 'externo' 
                                ? 'bg-slate-900 border-indigo-500 text-slate-100 font-bold' 
                                : 'bg-slate-950 border-slate-850 hover:bg-slate-900/50 text-slate-400'
                        }`}>
                            <input 
                                type="radio" 
                                name="clientType" 
                                checked={newClientType === 'externo'} 
                                onChange={() => setNewClientType('externo')} 
                                className="hidden" 
                            />
                            <span>Cliente Manual / Externo</span>
                        </label>
                    </div>

                    {newClientType === 'existente' ? (
                        <>
                            <Select
                                label="Cliente *"
                                value={newClientId}
                                onChange={(e) => {
                                    setNewClientId(e.target.value);
                                    setNewMachineId('');
                                }}
                                options={[
                                    { value: '', label: 'Seleccionar Cliente...' },
                                    ...clients.map(c => ({ value: c.id, label: c.name }))
                                ]}
                            />

                            {newClientId && (
                                <Select
                                    label="Equipo en Alquiler *"
                                    value={newMachineId}
                                    onChange={(e) => setNewMachineId(e.target.value)}
                                    options={[
                                        { value: '', label: 'Seleccionar Copiadora...' },
                                        ...clientMachines.map(m => ({ value: m.id, label: `${m.brand} ${m.model} (S/N: ${m.serial})` }))
                                    ]}
                                />
                            )}
                        </>
                    ) : (
                        <div className="space-y-3 animate-fade-in border border-slate-850 p-3 rounded-xl bg-slate-950/20">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">Datos de Contacto del Cliente Técnico</span>
                            <Input
                                label="Nombre / Razón Social del Cliente *"
                                value={newClientName}
                                onChange={(e) => setNewClientName(e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Dirección Completa"
                                    value={newClientAddress}
                                    onChange={(e) => setNewClientAddress(e.target.value)}
                                />
                                <Input
                                    label="Contacto Responsable"
                                    value={newClientContact}
                                    onChange={(e) => setNewClientContact(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Teléfono / WhatsApp"
                                    value={newClientPhone}
                                    onChange={(e) => setNewClientPhone(e.target.value)}
                                    placeholder="Ej: 381-4567890"
                                />
                                <Input
                                    label="Email"
                                    type="email"
                                    value={newClientEmail}
                                    onChange={(e) => setNewClientEmail(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 border-t border-slate-850 pt-3 mt-1">
                                <Input
                                    label="Modelo del Equipo *"
                                    value={newMachineDesc}
                                    onChange={(e) => setNewMachineDesc(e.target.value)}
                                    placeholder="Ej: Ricoh IM 430"
                                />
                                <Input
                                    label="Número de Serie / Interno"
                                    value={newSerialNumber}
                                    onChange={(e) => setNewSerialNumber(e.target.value)}
                                    placeholder="Ej: S/N: W8912345"
                                />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Categoría *"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            options={[
                                { value: 'Servicio', label: 'Servicio / Falla Técnica' },
                                { value: 'Repuesto', label: 'Repuesto' },
                                { value: 'Insumo', label: 'Insumo / Tóner' }
                            ]}
                        />
                        <Select
                            label="Prioridad *"
                            value={newPriority}
                            onChange={(e) => setNewPriority(e.target.value as any)}
                            options={[
                                { value: 'baja', label: 'Baja (SLA 48h)' },
                                { value: 'media', label: 'Media (SLA 24h)' },
                                { value: 'alta', label: 'Alta (SLA 4h)' },
                                { value: 'urgente', label: 'Urgente (SLA 4h)' }
                            ]}
                        />
                    </div>

                    <Input
                        label="Descripción del Problema *"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Ej: El papel se traba en el fusor / Código de error SC340..."
                    />

                    <Select
                        label="Asignar Técnico Responsable"
                        value={newAssignedTechId}
                        onChange={(e) => setNewAssignedTechId(e.target.value)}
                        options={[
                            { value: '', label: 'Sin Asignar (Pendiente Triage)' },
                            ...users.filter(u => u.role === 'tecnico').map(t => ({ value: t.id, label: t.fullname }))
                        ]}
                    />

                    <p className="text-[10px] text-slate-500 italic">
                        * El Límite de Resolución (SLA) se calculará automáticamente en función de la prioridad elegida al emitir el ticket.
                    </p>
                </form>
            </Modal>
        </div>
    );
}
