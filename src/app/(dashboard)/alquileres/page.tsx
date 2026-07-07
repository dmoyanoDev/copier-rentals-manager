'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatPeriod, getClientIvaRate } from '@/lib/utils';
import { Machine, Rental, Client, Abono } from '@/lib/mockData';
import { Search, Filter, PlusCircle, CheckCircle, HelpCircle, XCircle, RefreshCw, Calendar, FileText, Layers, Trash2, Edit2, ShieldAlert } from 'lucide-react';

export default function RentalsPage() {
    const { 
        clients, setClients, machines, setMachines, abonos, setAbonos, rentals, setRentals, readings, currentUser,
        updateClientAction, updateAbonoAction, updateMachineAction, addRentalAction, updateRentalAction
    } = useManagement();
    
    // Core states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [quickTab, setQuickTab] = useState<'all' | 'activo' | 'vencido' | 'finalizado'>('all');

    // Drawer / Detail states
    const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
    const [detailTab, setDetailTab] = useState<'info' | 'readings' | 'logs'>('info');

    // Create contract states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [rentalClientMode, setRentalClientMode] = useState<'select' | 'create'>('select');
    const [rentalClientId, setRentalClientId] = useState('');
    const [newClientName, setNewClientName] = useState('');
    const [newClientCuit, setNewClientCuit] = useState('');
    const [newClientTax, setNewClientTax] = useState<'Responsable Inscripto' | 'Monotributista' | 'Exento'>('Responsable Inscripto');
    
    const [rentalMachineMode, setRentalMachineMode] = useState<'select' | 'create'>('select');
    const [rentalMachineId, setRentalMachineId] = useState('');
    const [newMachineBrand, setNewMachineBrand] = useState('');
    const [newMachineModel, setNewMachineModel] = useState('');
    const [newMachineSerial, setNewMachineSerial] = useState('');
    const [newMachineCounter, setNewMachineCounter] = useState('0');

    const [rentalPlanMode, setRentalPlanMode] = useState<'select' | 'create'>('select');
    const [rentalPlanId, setRentalPlanId] = useState('');
    const [newPlanName, setNewPlanName] = useState('');
    const [newPlanLimit, setNewPlanLimit] = useState('2000');
    const [newPlanPrice, setNewPlanPrice] = useState('20000');
    const [newPlanExcess, setNewPlanExcess] = useState('15');

    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [observations, setObservations] = useState('');
    const [createError, setCreateError] = useState('');

    // Operations states
    const [showChangeMachineModal, setShowChangeMachineModal] = useState(false);
    const [selectedNewMachineId, setSelectedNewMachineId] = useState('');
    const [showChangePlanModal, setShowChangePlanModal] = useState(false);
    const [selectedNewPlanId, setSelectedNewPlanId] = useState('');

    // Available and rented machines filter (only allow 'Disponible' status)
    const availableMachines = machines.filter(m => m.status === 'Disponible' && m.clientId === null);

    const addTimelineLog = (r: Rental, action: string) => {
        const dateStr = new Date().toISOString().split('T')[0];
        const timeStr = new Date().toTimeString().split(' ')[0].substring(0, 5);
        return [
            ...(r.history || []),
            { date: dateStr, time: timeStr, action, user: currentUser?.fullname || 'Administrativo' }
        ];
    };

    // 1. Alta de Alquiler
    const handleCreateRental = () => {
        setCreateError('');
        let finalClientId = rentalClientId;
        let finalMachineId = rentalMachineId;
        let finalPlanId = rentalPlanId;

        // Validations
        if (rentalClientMode === 'select' && !finalClientId) {
            setCreateError('Selecciona un cliente.');
            return;
        }
        if (rentalClientMode === 'create' && (!newClientName.trim() || !newClientCuit.trim())) {
            setCreateError('El nombre y CUIT del cliente son obligatorios.');
            return;
        }
        if (rentalMachineMode === 'select' && !finalMachineId) {
            setCreateError('Selecciona un equipo.');
            return;
        }
        if (rentalMachineMode === 'create' && (!newMachineBrand.trim() || !newMachineModel.trim() || !newMachineSerial.trim())) {
            setCreateError('Completa marca, modelo y número de serie.');
            return;
        }
        if (rentalPlanMode === 'select' && !finalPlanId) {
            setCreateError('Selecciona un plan de abono.');
            return;
        }
        if (rentalPlanMode === 'create' && !newPlanName.trim()) {
            setCreateError('Ingresa el nombre del abono.');
            return;
        }

        // Check if CUIT already exists
        if (rentalClientMode === 'create') {
            const cleanCuit = newClientCuit.replace(/-/g, '').trim();
            const duplicateCuit = clients.find(c => c.cuit.replace(/-/g, '').trim() === cleanCuit);
            if (duplicateCuit) {
                setCreateError(`El CUIT ${newClientCuit} ya pertenece al cliente "${duplicateCuit.name}".`);
                return;
            }
        }

        // Check if Serial already exists
        if (rentalMachineMode === 'create') {
            const cleanSerial = newMachineSerial.trim().toLowerCase();
            const duplicateSerial = machines.find(m => m.serial.trim().toLowerCase() === cleanSerial);
            if (duplicateSerial) {
                setCreateError(`El número de serie ${newMachineSerial} ya pertenece al equipo "${duplicateSerial.brand} ${duplicateSerial.model}".`);
                return;
            }
        }

        // 1. Create client if new
        if (rentalClientMode === 'create') {
            const nClient: Client = {
                id: `c-${Date.now()}`,
                name: newClientName,
                cuit: newClientCuit,
                taxCategory: newClientTax,
                address: 'Dirección no especificada',
                phone: 'Sin teléfono',
                email: `${newClientName.toLowerCase().replace(/ /g, '')}@example.com`,
                debt: 0,
                active: true
            };
            updateClientAction(nClient, 'create');
            finalClientId = nClient.id;
        }

        // 2. Create Plan if new
        if (rentalPlanMode === 'create') {
            const nPlan: Abono = {
                id: `p-${Date.now()}`,
                name: newPlanName,
                limit: parseInt(newPlanLimit, 10) || 2000,
                price: parseInt(newPlanPrice, 10) || 20000,
                excessPrice: parseFloat(newPlanExcess) || 15,
                active: true
            };
            updateAbonoAction(nPlan, 'create');
            finalPlanId = nPlan.id;
        }

        // 3. Create or update Machine
        if (rentalMachineMode === 'create') {
            const nMachine: Machine = {
                id: `m-${Date.now()}`,
                brand: newMachineBrand,
                model: newMachineModel,
                serial: newMachineSerial,
                type: 'B&N',
                currentCounter: parseInt(newMachineCounter, 10) || 0,
                lastServiceCounter: 0,
                preventiveInterval: 15000,
                status: 'Alquilada',
                applyIva: true,
                clientId: finalClientId,
                abonoId: finalPlanId
            };
            updateMachineAction(nMachine, 'create');
            finalMachineId = nMachine.id;
        }

        // 4. Create Rental Contract
        const nRental: Rental = {
            id: `rental-${Date.now()}`,
            clientId: finalClientId,
            machineId: finalMachineId,
            abonoId: finalPlanId,
            startDate,
            status: 'activo',
            observations: observations || undefined,
            history: [
                {
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
                    action: 'Contrato de alquiler activado y máquinas asignadas',
                    user: currentUser?.fullname || 'Administrativo'
                }
            ]
        };

        // Invoke context addRentalAction
        addRentalAction(nRental, [{
            id: finalMachineId,
            clientId: finalClientId,
            abonoId: finalPlanId,
            status: 'Alquilada'
        }]);

        setShowCreateModal(false);
        // Reset inputs
        setRentalClientId('');
        setRentalMachineId('');
        setRentalPlanId('');
        setNewClientName('');
        setNewClientCuit('');
        setNewMachineBrand('');
        setNewMachineModel('');
        setNewMachineSerial('');
        setNewPlanName('');
        setObservations('');
        alert('¡Contrato de alquiler creado y activado con éxito!');
    };

    // 2. Renovar Alquiler
    const handleRenewRental = () => {
        if (!selectedRental) return;
        const extendedHistory = addTimelineLog(selectedRental, 'Contrato renovado por 12 meses adicionales');
        const updated: Rental = {
            ...selectedRental,
            startDate: new Date().toISOString().split('T')[0],
            history: extendedHistory
        };
        updateRentalAction(updated);
        setSelectedRental(updated);
        alert('Contrato renovado con éxito.');
    };

    // 3. Reemplazar Máquina
    const handleChangeMachine = () => {
        if (!selectedRental || !selectedNewMachineId) return;
        
        const oldMachine = machines.find(m => m.id === selectedRental.machineId);
        const newMachine = machines.find(m => m.id === selectedNewMachineId);
        if (!newMachine) return;

        // Prepare machine updates payload
        const machineUpdates = [
            { id: selectedRental.machineId, clientId: null, abonoId: null, status: 'Disponible' as const },
            { id: selectedNewMachineId, clientId: selectedRental.clientId, abonoId: selectedRental.abonoId, status: 'Alquilada' as const }
        ];

        // Update rental
        const logAction = `Reemplazo de equipo: se retira S/N ${oldMachine ? oldMachine.serial : 'N/A'} y se instala S/N ${newMachine.serial}`;
        const nextHistory = addTimelineLog(selectedRental, logAction);
        const updated: Rental = {
            ...selectedRental,
            machineId: selectedNewMachineId,
            history: nextHistory
        };

        updateRentalAction(updated, machineUpdates);
        setSelectedRental(updated);
        setShowChangeMachineModal(false);
        setSelectedNewMachineId('');
        alert('Equipo reemplazado con éxito.');
    };

    // 4. Cambiar Abono / Plan
    const handleChangePlan = () => {
        if (!selectedRental || !selectedNewPlanId) return;

        const oldPlan = abonos.find(a => a.id === selectedRental.abonoId);
        const newPlan = abonos.find(a => a.id === selectedNewPlanId);
        if (!newPlan) return;

        const machineUpdates = [
            { id: selectedRental.machineId, clientId: selectedRental.clientId, abonoId: selectedNewPlanId, status: 'Alquilada' as const }
        ];

        // Update rental plan link
        const logAction = `Cambio de abono: del plan "${oldPlan ? oldPlan.name : 'N/A'}" al plan "${newPlan.name}"`;
        const nextHistory = addTimelineLog(selectedRental, logAction);
        const updated: Rental = {
            ...selectedRental,
            abonoId: selectedNewPlanId,
            history: nextHistory
        };

        updateRentalAction(updated, machineUpdates);
        setSelectedRental(updated);
        setShowChangePlanModal(false);
        setSelectedNewPlanId('');
        alert('Plan de abono actualizado con éxito.');
    };

    // 5. Finalizar Alquiler
    const handleCloseRental = () => {
        if (!selectedRental) return;
        if (confirm('¿Estás seguro de que deseas finalizar este contrato de alquiler? El equipo asociado volverá a estar disponible.')) {
            // Free machine
            const machineUpdates = [
                { id: selectedRental.machineId, clientId: null, abonoId: null, status: 'Disponible' as const }
            ];
            
            // Set rental to finalized
            const nextHistory = addTimelineLog(selectedRental, 'Contrato finalizado y equipo liberado a stock');
            const updated: Rental = {
                ...selectedRental,
                status: 'finalizado',
                endDate: new Date().toISOString().split('T')[0],
                history: nextHistory
            };

            updateRentalAction(updated, machineUpdates);
            setSelectedRental(updated);
            alert('Contrato finalizado con éxito.');
        }
    };

    // Filters and tabs search logic
    const filteredRentals = rentals.filter(r => {
        const client = clients.find(c => c.id === r.clientId);
        const mach = machines.find(m => m.id === r.machineId);
        const ab = abonos.find(a => a.id === r.abonoId);

        // Search text matching client or serial
        const q = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
            (client && client.name.toLowerCase().includes(q)) ||
            (mach && mach.brand.toLowerCase().includes(q)) ||
            (mach && mach.model.toLowerCase().includes(q)) ||
            (mach && mach.serial.toLowerCase().includes(q));

        const matchesStatus = !filterStatus || r.status === filterStatus;

        // Quick Tabs
        let matchesTab = true;
        if (quickTab === 'activo') {
            matchesTab = r.status === 'activo';
        } else if (quickTab === 'vencido') {
            matchesTab = r.status === 'vencido';
        } else if (quickTab === 'finalizado') {
            matchesTab = r.status === 'finalizado';
        }

        return matchesSearch && matchesStatus && matchesTab;
    });

    return (
        <div className="space-y-6 animate-fade-in text-slate-100 pb-12">
            
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-base font-semibold text-slate-100 uppercase tracking-wider">Control Operativo de Alquileres</h2>
                    <p className="text-[10px] text-slate-400">Administración de contratos de locación activos, reemplazos de equipos y auditoría.</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
                    <PlusCircle size={14} className="mr-1" /> Nuevo Alquiler
                </Button>
            </div>

            {/* Quick Filters Tab */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-2">
                <button 
                    onClick={() => setQuickTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickTab === 'all' ? 'bg-indigo-650 text-white font-bold' : 'text-slate-450 hover:bg-slate-800/40'}`}
                >
                    Todos ({rentals.length})
                </button>
                <button 
                    onClick={() => setQuickTab('activo')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickTab === 'activo' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 font-bold' : 'text-slate-450 hover:bg-slate-800/40'}`}
                >
                    Contratos Activos ({rentals.filter(r => r.status === 'activo').length})
                </button>
                <button 
                    onClick={() => setQuickTab('vencido')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickTab === 'vencido' ? 'bg-amber-500/10 text-amber-405 border border-amber-500/20 font-bold' : 'text-slate-450 hover:bg-slate-800/40'}`}
                >
                    Contratos Vencidos ({rentals.filter(r => r.status === 'vencido').length})
                </button>
                <button 
                    onClick={() => setQuickTab('finalizado')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickTab === 'finalizado' ? 'bg-red-500/10 text-red-405 border border-red-500/20 font-bold' : 'text-slate-450 hover:bg-slate-800/40'}`}
                >
                    Finalizados ({rentals.filter(r => r.status === 'finalizado').length})
                </button>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-slate-950 border border-slate-850 rounded-xl">
                {/* Search */}
                <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                        <Search size={14} />
                    </span>
                    <input
                        type="text"
                        placeholder="Buscar por cliente, modelo o serie..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-slate-200 text-xs focus:outline-none"
                    />
                </div>

                {/* Status select */}
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300 text-xs focus:outline-none"
                >
                    <option value="">Estado Contrato: Todos</option>
                    <option value="activo">Activo</option>
                    <option value="pausado">Pausado</option>
                    <option value="vencido">Vencido</option>
                    <option value="finalizado">Finalizado</option>
                </select>
            </div>

            {/* Split layout: List vs Drawer detail */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                
                {/* Left Area: List Table */}
                <div className={selectedRental ? "xl:col-span-2 space-y-4" : "xl:col-span-3 space-y-4"}>
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Cliente</TableHeaderCell>
                                    <TableHeaderCell>Modelo / Serie</TableHeaderCell>
                                    <TableHeaderCell>Plan</TableHeaderCell>
                                    <TableHeaderCell>Fecha Inicio</TableHeaderCell>
                                    <TableHeaderCell>Fecha Fin</TableHeaderCell>
                                    <TableHeaderCell>Estado</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Acción</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRentals.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-slate-500 text-xs italic">
                                            No se encontraron contratos de alquileres registrados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRentals.map(r => {
                                        const cl = clients.find(c => c.id === r.clientId);
                                        const mach = machines.find(m => m.id === r.machineId);
                                        const ab = abonos.find(a => a.id === r.abonoId);

                                        return (
                                            <TableRow key={r.id} className={selectedRental?.id === r.id ? "bg-indigo-950/20" : "hover:bg-slate-900/40"}>
                                                <TableCell className="font-bold text-slate-100">{cl ? cl.name : 'Desconocido'}</TableCell>
                                                <TableCell className="text-xs text-slate-300">
                                                    <strong>{mach ? `${mach.brand} ${mach.model}` : 'Equipo Retirado'}</strong>
                                                    {mach && <span className="block text-[10px] text-slate-500">S/N: {mach.serial}</span>}
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-350">{ab ? ab.name : 'Abono N/A'}</TableCell>
                                                <TableCell className="text-xs text-slate-350 font-mono-tabular">{r.startDate}</TableCell>
                                                <TableCell className="text-xs text-slate-400 font-mono-tabular">{r.endDate || <span className="italic">Vigente</span>}</TableCell>
                                                <TableCell className="text-xs">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                                        r.status === 'activo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                        r.status === 'pausado' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                        r.status === 'vencido' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                                        'bg-slate-500/10 text-slate-400 border border-slate-800'
                                                    }`}>
                                                        {r.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="secondary" size="sm" onClick={() => {
                                                        setSelectedRental(r);
                                                        setDetailTab('info');
                                                    }}>
                                                        Ver Expediente
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>

                {/* Right Drawer Contract Details */}
                {selectedRental && (
                    <div className="xl:col-span-1 space-y-4 animate-fade-in">
                        <Card className="border-indigo-650/30 bg-slate-950/60 sticky top-24 shadow-xl">
                            <div className="p-4 bg-slate-900 text-white flex items-center justify-between rounded-t-2xl border-b border-slate-800">
                                <div>
                                    <h3 className="font-extrabold text-xs uppercase tracking-wider">Expediente Contractual</h3>
                                    <span className="text-[9px] text-slate-500 font-mono">ID: {selectedRental.id}</span>
                                </div>
                                <button className="text-slate-400 hover:text-white" onClick={() => setSelectedRental(null)}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            
                            <CardContent className="p-4 space-y-4 text-xs">
                                
                                {/* Client and plan details */}
                                <div className="space-y-1">
                                    <span className="text-[9px] uppercase font-bold text-slate-550 block tracking-wider">Cliente de Locación</span>
                                    <span className="font-bold text-slate-205">
                                        {clients.find(c => c.id === selectedRental.clientId)?.name}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 border-t border-slate-850 pt-3">
                                    <div>
                                        <span className="text-[9px] uppercase font-bold text-slate-550 block tracking-wider">Equipo</span>
                                        <span className="font-bold text-slate-300">
                                            {machines.find(m => m.id === selectedRental.machineId)?.brand} {machines.find(m => m.id === selectedRental.machineId)?.model}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] uppercase font-bold text-slate-550 block tracking-wider">Número de Serie</span>
                                        <span className="font-bold text-slate-300 font-mono-tabular">
                                            {machines.find(m => m.id === selectedRental.machineId)?.serial}
                                        </span>
                                    </div>
                                </div>

                                {/* Tabs Navigation inside drawer */}
                                <div className="flex gap-2 border-b border-slate-805 pb-1 pt-2">
                                    <button 
                                        onClick={() => setDetailTab('info')}
                                        className={`pb-1 text-[10px] uppercase font-extrabold tracking-wider ${detailTab === 'info' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-500'}`}
                                    >
                                        Abono
                                    </button>
                                    <button 
                                        onClick={() => setDetailTab('readings')}
                                        className={`pb-1 text-[10px] uppercase font-extrabold tracking-wider ${detailTab === 'readings' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-500'}`}
                                    >
                                        Consumos
                                    </button>
                                    <button 
                                        onClick={() => setDetailTab('logs')}
                                        className={`pb-1 text-[10px] uppercase font-extrabold tracking-wider ${detailTab === 'logs' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-500'}`}
                                    >
                                        Historial
                                    </button>
                                </div>

                                {/* TAB 1: INFO ABONO */}
                                {detailTab === 'info' && (
                                    <div className="space-y-3 pt-1">
                                        <span className="text-[9px] uppercase font-bold text-slate-550 block tracking-wider">Plan Vigente</span>
                                        {selectedRental.abonoId ? (
                                            <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-850 space-y-1">
                                                <span className="font-extrabold text-indigo-405 block">
                                                    {abonos.find(a => a.id === selectedRental.abonoId)?.name}
                                                </span>
                                                <div className="flex justify-between text-[11px] text-slate-400">
                                                    <span>Abono Mensual:</span>
                                                    <span className="font-bold text-slate-300 font-mono-tabular">
                                                        {formatCurrency(abonos.find(a => a.id === selectedRental.abonoId)?.price || 0)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-[11px] text-slate-400">
                                                    <span>Límite Incluido:</span>
                                                    <span className="font-bold text-slate-300">
                                                        {abonos.find(a => a.id === selectedRental.abonoId)?.limit.toLocaleString('es-AR')} copias
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-[11px] text-slate-400">
                                                    <span>Costo Excedente:</span>
                                                    <span className="font-bold text-slate-300 font-mono-tabular">
                                                        {formatCurrency(abonos.find(a => a.id === selectedRental.abonoId)?.excessPrice || 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-500 italic">Sin abono contratado</span>
                                        )}
                                        {selectedRental.observations && (
                                            <div className="pt-2">
                                                <span className="text-[9px] uppercase font-bold text-slate-550 block">Observaciones</span>
                                                <p className="text-slate-400 block pt-0.5">{selectedRental.observations}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 2: LECTURAS Y CONSUMOS */}
                                {detailTab === 'readings' && (
                                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                        {readings.filter(r => r.machineId === selectedRental.machineId).length === 0 ? (
                                            <p className="text-slate-500 italic py-2 text-[10px]">No se han registrado lecturas en el equipo actual.</p>
                                        ) : (
                                            readings.filter(r => r.machineId === selectedRental.machineId).sort((a,b) => b.month.localeCompare(a.month)).map(r => (
                                                <div key={r.id} className="p-2.5 bg-slate-900 border border-slate-850 rounded-xl flex justify-between items-center text-[10px]">
                                                    <div>
                                                        <span className="font-bold text-slate-200 block">{formatPeriod(r.month)}</span>
                                                        <span className="text-slate-500 text-[9px]">Lectura: {r.initial.toLocaleString()} a {r.final.toLocaleString()}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-bold text-slate-205 font-mono-tabular block">{formatCurrency(r.totalAmount)}</span>
                                                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase ${
                                                            r.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                                        }`}>
                                                            {r.status === 'paid' ? 'COBRADO' : 'PENDIENTE'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* TAB 3: TIMELINE / HISTORIAL */}
                                {detailTab === 'logs' && (
                                    <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                                        <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                                            {(selectedRental.history || []).map((log, idx) => (
                                                <div key={idx} className="relative pl-6 text-[10px] space-y-0.5">
                                                    <span className="absolute left-0.5 top-1 w-3 h-3 rounded-full bg-indigo-650 border border-slate-950"></span>
                                                    <span className="text-[9px] text-slate-550 font-mono block">{log.date} {log.time}</span>
                                                    <p className="font-semibold text-slate-300">{log.action}</p>
                                                    <span className="text-[9px] text-slate-500 block">Por: {log.user}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Contractual Actions */}
                                {selectedRental.status === 'activo' && (
                                    <div className="border-t border-slate-850 pt-3 space-y-2">
                                        <span className="text-[9px] uppercase font-bold text-slate-550 block tracking-wider">Gestión Contractual</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button variant="secondary" size="sm" onClick={handleRenewRental}>
                                                Renovar Alquiler
                                            </Button>
                                            <Button variant="secondary" size="sm" onClick={() => setShowChangePlanModal(true)}>
                                                Cambiar Abono
                                            </Button>
                                            <Button variant="secondary" size="sm" className="col-span-2" onClick={() => setShowChangeMachineModal(true)}>
                                                Reemplazar Copiadora (Reasignar)
                                            </Button>
                                            <button 
                                                onClick={handleCloseRental}
                                                className="col-span-2 px-3 py-1.5 bg-red-955/20 border border-red-900/30 hover:bg-red-900/20 text-red-400 rounded-xl text-xs font-bold transition-all text-center"
                                            >
                                                Finalizar Contrato
                                            </button>
                                        </div>
                                    </div>
                                )}

                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* MODAL: REGISTRAR NUEVO ALQUILER */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg border-slate-800 bg-slate-900 text-slate-100 max-h-[85vh] overflow-y-auto">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
                            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5"><Calendar size={16} className="text-indigo-400" /> Registrar Nuevo Contrato de Alquiler</h3>
                            <button className="text-slate-400 hover:text-slate-200" onClick={() => setShowCreateModal(false)}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <CardContent className="p-5 space-y-6">
                            
                            {/* STEP 1: CLIENTE */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">1. Cliente Beneficiario</span>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setRentalClientMode('select')}
                                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${rentalClientMode === 'select' ? 'bg-indigo-600 text-white' : 'bg-slate-850 text-slate-400'}`}
                                        >
                                            Seleccionar
                                        </button>
                                        <button 
                                            onClick={() => setRentalClientMode('create')}
                                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${rentalClientMode === 'create' ? 'bg-indigo-600 text-white' : 'bg-slate-850 text-slate-400'}`}
                                        >
                                            Crear Nuevo
                                        </button>
                                    </div>
                                </div>

                                {rentalClientMode === 'select' ? (
                                    <select
                                        value={rentalClientId}
                                        onChange={(e) => setRentalClientId(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="">-- Selecciona un Cliente --</option>
                                        {clients.filter(c => c.active !== false).map(c => (
                                            <option key={c.id} value={c.id}>{c.name} ({c.cuit})</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <input
                                            type="text"
                                            placeholder="Nombre / Razón Social"
                                            value={newClientName}
                                            onChange={(e) => setNewClientName(e.target.value)}
                                            className="bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="CUIT (Sin guiones)"
                                            value={newClientCuit}
                                            onChange={(e) => setNewClientCuit(e.target.value)}
                                            className="bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                        <select
                                            value={newClientTax}
                                            onChange={(e) => setNewClientTax(e.target.value as any)}
                                            className="col-span-2 bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        >
                                            <option value="Responsable Inscripto">Responsable Inscripto</option>
                                            <option value="Monotributista">Monotributista</option>
                                            <option value="Exento">Exento / Consumidor Final</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* STEP 2: PLAN / ABONO */}
                            <div className="space-y-3 pt-3 border-t border-slate-850">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">2. Plan / Abono Asociado</span>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setRentalPlanMode('select')}
                                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${rentalPlanMode === 'select' ? 'bg-indigo-600 text-white' : 'bg-slate-850 text-slate-400'}`}
                                        >
                                            Seleccionar
                                        </button>
                                        <button 
                                            onClick={() => setRentalPlanMode('create')}
                                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${rentalPlanMode === 'create' ? 'bg-indigo-600 text-white' : 'bg-slate-850 text-slate-400'}`}
                                        >
                                            Crear Nuevo
                                        </button>
                                    </div>
                                </div>

                                {rentalPlanMode === 'select' ? (
                                    <select
                                        value={rentalPlanId}
                                        onChange={(e) => setRentalPlanId(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="">-- Selecciona un Abono --</option>
                                        {abonos.filter(a => a.active !== false).map(a => (
                                            <option key={a.id} value={a.id}>{a.name} (Base: {formatCurrency(a.price)})</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <input
                                            type="text"
                                            placeholder="Nombre del Abono (Ej: Plan Pro 5k)"
                                            value={newPlanName}
                                            onChange={(e) => setNewPlanName(e.target.value)}
                                            className="col-span-2 bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Copias Incluidas"
                                            value={newPlanLimit}
                                            onChange={(e) => setNewPlanLimit(e.target.value)}
                                            className="bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Precio Abono Base ($)"
                                            value={newPlanPrice}
                                            onChange={(e) => setNewPlanPrice(e.target.value)}
                                            className="bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Copia Excedente ($)"
                                            value={newPlanExcess}
                                            onChange={(e) => setNewPlanExcess(e.target.value)}
                                            className="col-span-2 bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* STEP 3: COPIADORA / MÁQUINA */}
                            <div className="space-y-3 pt-3 border-t border-slate-850">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">3. Equipo / Copiadora</span>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setRentalMachineMode('select')}
                                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${rentalMachineMode === 'select' ? 'bg-indigo-600 text-white' : 'bg-slate-850 text-slate-400'}`}
                                        >
                                            Seleccionar Disponible
                                        </button>
                                        <button 
                                            onClick={() => setRentalMachineMode('create')}
                                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${rentalMachineMode === 'create' ? 'bg-indigo-600 text-white' : 'bg-slate-850 text-slate-400'}`}
                                        >
                                            Cargar Nueva
                                        </button>
                                    </div>
                                </div>

                                {rentalMachineMode === 'select' ? (
                                    <select
                                        value={rentalMachineId}
                                        onChange={(e) => setRentalMachineId(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="">-- Selecciona una Copiadora Disponible --</option>
                                        {availableMachines.map(m => (
                                            <option key={m.id} value={m.id}>{m.brand} {m.model} (S/N: {m.serial})</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <input
                                            type="text"
                                            placeholder="Marca (Ej: Ricoh, Konica)"
                                            value={newMachineBrand}
                                            onChange={(e) => setNewMachineBrand(e.target.value)}
                                            className="bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Modelo (Ej: MP 301, C224)"
                                            value={newMachineModel}
                                            onChange={(e) => setNewMachineModel(e.target.value)}
                                            className="bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Número de Serie"
                                            value={newMachineSerial}
                                            onChange={(e) => setNewMachineSerial(e.target.value)}
                                            className="bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Contador Inicial"
                                            value={newMachineCounter}
                                            onChange={(e) => setNewMachineCounter(e.target.value)}
                                            className="bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* STEP 4: DETALLES CONTRATO */}
                            <div className="space-y-3 pt-3 border-t border-slate-850 grid grid-cols-2 gap-3 text-xs">
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Fecha de Inicio Contrato</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                    />
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block font-bold">Observaciones / Anotaciones Contrato</label>
                                    <textarea
                                        value={observations}
                                        onChange={(e) => setObservations(e.target.value)}
                                        placeholder="Ej: Contrato a 12 meses. Incluye mantenimiento preventivo mensual sin cargo."
                                        rows={3}
                                        className="w-full bg-slate-955 border border-slate-850 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none"
                                    />
                                </div>
                            </div>

                            {createError && (
                                <p className="text-red-500 text-[10px] font-bold bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">{createError}</p>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-slate-850">
                                <Button variant="secondary" size="md" className="flex-1" onClick={() => setShowCreateModal(false)}>
                                    Cancelar
                                </Button>
                                <Button variant="primary" size="md" className="flex-1" onClick={handleCreateRental}>
                                    Generar Contrato de Alquiler
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* MODAL: CAMBIAR MÁQUINA */}
            {showChangeMachineModal && selectedRental && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md border-slate-850 bg-slate-900 text-slate-100 animate-fade-in">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5"><RefreshCw size={15} className="text-indigo-400 animate-spin" /> Reemplazar Copiadora en Alquiler</h3>
                            <button className="text-slate-400 hover:text-slate-205" onClick={() => setShowChangeMachineModal(false)}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <CardContent className="p-5 space-y-4">
                            <div className="text-xs bg-slate-955 p-3 rounded-xl border border-slate-850 space-y-1">
                                <span className="text-slate-500">Copiadora Actual:</span>
                                <span className="font-bold text-slate-200 block">
                                    {machines.find(m => m.id === selectedRental.machineId)?.brand} {machines.find(m => m.id === selectedRental.machineId)?.model}
                                </span>
                                <span className="text-[10px] text-slate-500 block">S/N: {machines.find(m => m.id === selectedRental.machineId)?.serial}</span>
                            </div>

                            <Select
                                label="Seleccionar Nueva Copiadora Disponible *"
                                value={selectedNewMachineId}
                                onChange={(e) => setSelectedNewMachineId(e.target.value)}
                                options={[
                                    { value: '', label: 'Seleccionar equipo...' },
                                    ...availableMachines.map(m => ({ value: m.id, label: `${m.brand} ${m.model} (S/N: ${m.serial})` }))
                                ]}
                            />

                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" size="md" className="flex-1" onClick={() => setShowChangeMachineModal(false)}>
                                    Cancelar
                                </Button>
                                <Button variant="primary" size="md" className="flex-1" onClick={handleChangeMachine} disabled={!selectedNewMachineId}>
                                    Confirmar Reemplazo
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* MODAL: CAMBIAR PLAN DE ABONO */}
            {showChangePlanModal && selectedRental && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md border-slate-850 bg-slate-900 text-slate-100 animate-fade-in">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5"><Layers size={15} className="text-indigo-400" /> Modificar Plan de Abono</h3>
                            <button className="text-slate-400 hover:text-slate-205" onClick={() => setShowChangePlanModal(false)}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <CardContent className="p-5 space-y-4">
                            <div className="text-xs bg-slate-955 p-3 rounded-xl border border-slate-850 space-y-1">
                                <span className="text-slate-500">Plan Actual:</span>
                                <span className="font-bold text-indigo-400 block">
                                    {abonos.find(a => a.id === selectedRental.abonoId)?.name}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                    Base: {formatCurrency(abonos.find(a => a.id === selectedRental.abonoId)?.price || 0)}
                                </span>
                            </div>

                            <Select
                                label="Seleccionar Nuevo Plan de Abono *"
                                value={selectedNewPlanId}
                                onChange={(e) => setSelectedNewPlanId(e.target.value)}
                                options={[
                                    { value: '', label: 'Seleccionar plan...' },
                                    ...abonos.filter(a => a.active !== false && a.id !== selectedRental.abonoId).map(a => ({ value: a.id, label: `${a.name} ($${a.price})` }))
                                ]}
                            />

                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" size="md" className="flex-1" onClick={() => setShowChangePlanModal(false)}>
                                    Cancelar
                                </Button>
                                <Button variant="primary" size="md" className="flex-1" onClick={handleChangePlan} disabled={!selectedNewPlanId}>
                                    Confirmar Cambio
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

        </div>
    );
}
