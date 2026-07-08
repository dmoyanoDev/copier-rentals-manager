'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatPeriod, getClientIvaRate } from '@/lib/utils';
import { Reading, Machine, Client, Abono, Rental } from '@/lib/mockData';
import { Search, Filter, PlusCircle, CheckCircle, AlertTriangle, FileText, UserPlus, FileCheck, Layers, Clipboard } from 'lucide-react';

export default function ReadingsPage() {
    const { 
        clients, setClients, machines, setMachines, readings, setReadings, abonos, setAbonos, currentMonth, currentUser, tickets,
        updateClientAction, updateAbonoAction, updateMachineAction, addRentalAction, addReadingAction
    } = useManagement();
    
    // Core states
    const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [validationError, setValidationError] = useState('');
    const [anomalousWarning, setAnomalousWarning] = useState('');

    // Filter and quick views states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterClient, setFilterClient] = useState('');
    const [filterAudit, setFilterAudit] = useState('');
    const [quickTab, setQuickTab] = useState<'all' | 'pending' | 'observed' | 'ready_to_invoice' | 'invoiced'>('all');

    // "Nuevo Alquiler" dialog states
    const [showNewRentalModal, setShowNewRentalModal] = useState(false);
    // Client selection/creation
    const [rentalClientMode, setRentalClientMode] = useState<'select' | 'create'>('select');
    const [rentalClientId, setRentalClientId] = useState('');
    const [newClientName, setNewClientName] = useState('');
    const [newClientCuit, setNewClientCuit] = useState('');
    const [newClientTax, setNewClientTax] = useState<'Responsable Inscripto' | 'Monotributista' | 'Exento'>('Responsable Inscripto');
    // Machine selection/creation
    const [rentalMachineMode, setRentalMachineMode] = useState<'select' | 'create'>('select');
    const [rentalMachineId, setRentalMachineId] = useState('');
    const [newMachineBrand, setNewMachineBrand] = useState('');
    const [newMachineModel, setNewMachineModel] = useState('');
    const [newMachineSerial, setNewMachineSerial] = useState('');
    const [newMachineCounter, setNewMachineCounter] = useState('0');
    // Plan selection/creation
    const [rentalPlanMode, setRentalPlanMode] = useState<'select' | 'create'>('select');
    const [rentalPlanId, setRentalPlanId] = useState('');
    const [newPlanName, setNewPlanName] = useState('');
    const [newPlanLimit, setNewPlanLimit] = useState('5000');
    const [newPlanPrice, setNewPlanPrice] = useState('25000');
    const [newPlanExcess, setNewPlanExcess] = useState('15');

    // "Facturar" dialog states
    const [showInvoiceModal, setShowInvoiceModal] = useState<Reading | null>(null);
    const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
    const [invoiceError, setInvoiceError] = useState('');

    // Detail Panel/Timeline drawer
    const [viewTimelineReading, setViewTimelineReading] = useState<Reading | null>(null);

    // List of machines under rental contracts
    const rentedMachines = machines.filter(m => m.clientId !== null && m.abonoId !== null);
    // List of available machines (not currently rented)
    const availableMachines = machines.filter(m => m.clientId === null);

    // Dynamic state logs
    const addTimelineLog = (r: Reading, action: string) => {
        const dateStr = new Date().toISOString().split('T')[0];
        const timeStr = new Date().toTimeString().split(' ')[0].substring(0, 5);
        const logEntry = {
            date: dateStr,
            time: timeStr,
            action,
            user: currentUser?.fullname || 'Sistema'
        };
        return [...(r.history || []), logEntry];
    };

    const getInitialCounterForMachine = (machine: Machine, monthStr: string): number => {
        const machineReadings = readings.filter(r => r.machineId === machine.id);
        if (machineReadings.length === 0) {
            return machine.currentCounter || 0;
        }

        // Obtener lecturas de meses anteriores al mes seleccionado, ordenadas de forma descendente
        const pastReadings = machineReadings
            .filter(r => r.month < monthStr)
            .sort((a, b) => b.month.localeCompare(a.month));

        if (pastReadings.length > 0) {
            return pastReadings[0].final || 0;
        }

        // Fallback: si no hay lecturas anteriores, usar la lectura más reciente de cualquier mes cargada
        const anyPast = [...machineReadings].sort((a, b) => b.month.localeCompare(a.month));
        return anyPast[0].final || machine.currentCounter || 0;
    };

    const handleOpenLogModal = (m: Machine) => {
        setSelectedMachine(m);
        setInputValue('');
        setValidationError('');
        setAnomalousWarning('');
    };

    const handleSaveReading = () => {
        if (!selectedMachine) return;
        const finalVal = parseInt(inputValue, 10);
        if (isNaN(finalVal) || finalVal <= 0) {
            setValidationError('Ingresa un valor de contador final válido y mayor a cero.');
            return;
        }

        const initialVal = getInitialCounterForMachine(selectedMachine, currentMonth);
        if (finalVal < initialVal) {
            setValidationError(`Error: El contador final (${finalVal.toLocaleString()}) no puede ser menor al contador anterior (${initialVal.toLocaleString()}).`);
            return;
        }

        const consumed = finalVal - initialVal;
        const abono = abonos.find(a => a.id === selectedMachine.abonoId);
        
        let warning = '';
        if (abono && consumed > abono.limit * 1.8) {
            warning = `Advertencia: Consumo potencialmente anómalo. Se registraron ${consumed.toLocaleString()} copias (excede el plan en un 80%+).`;
        }

        if (warning && !anomalousWarning) {
            setAnomalousWarning(warning);
            return; // Let user confirm anomalous warning
        }

        // Calculations (ensuring clean numbers)
        const client = clients.find(c => c.id === selectedMachine.clientId);
        const basePrice = abono ? Number(abono.price) || 0 : 0;
        const excessCount = abono ? Math.max(0, consumed - abono.limit) : 0;
        const excessPrice = abono ? Number(abono.excessPrice) || 0 : 0;
        const excessAmount = excessCount * excessPrice;

        const netAmount = basePrice + excessAmount;
        const ivaRate = selectedMachine.applyIva && client ? getClientIvaRate(client.taxCategory) : 0;
        const ivaAmount = netAmount * (ivaRate / 100);
        const totalAmount = netAmount + ivaAmount;

        const initialHistory = [{
            date: new Date().toISOString().split('T')[0],
            time: new Date().toTimeString().split(' ')[0].substring(0, 5),
            action: warning ? 'Lectura cargada con alerta de consumo' : 'Lectura inicial cargada',
            user: currentUser?.fullname || 'Administrativo'
        }];

        const newReading: Reading = {
            id: `r-${Date.now()}`,
            machineId: selectedMachine.id,
            clientId: selectedMachine.clientId || '',
            abonoId: selectedMachine.abonoId || '',
            month: currentMonth,
            initial: initialVal,
            final: finalVal,
            excessCount,
            excessPrice,
            netAmount,
            ivaAmount,
            totalAmount,
            status: 'pending',
            readingStatus: warning ? 'observada' : 'cargada',
            readingComment: warning || undefined
        };
        // Add timeline history property
        newReading.history = initialHistory;

        // Use context action (updates both state arrays, saves localStorage, and syncs queue item)
        addReadingAction(newReading, { id: selectedMachine.id, currentCounter: finalVal });

        setSelectedMachine(null);
    };

    const handleValidateReading = (r: Reading) => {
        const nextHistory = addTimelineLog(r, 'Lectura Validada por Administración');
        const updated: Reading = {
            ...r,
            readingStatus: 'validada'
        };
        updated.history = nextHistory;

        addReadingAction(updated);
        alert('Lectura validada con éxito. Ya se puede facturar.');
    };

    // Open Billing Modal
    const handleOpenInvoiceModal = (r: Reading) => {
        setShowInvoiceModal(r);
        setInvoiceNumberInput(`FAC-0001-${String(Math.floor(100000 + Math.random() * 900000))}`);
        setInvoiceError('');
    };

    const handleSaveInvoice = () => {
        if (!showInvoiceModal) return;
        if (!invoiceNumberInput.trim()) {
            setInvoiceError('Por favor, ingresa el número de comprobante.');
            return;
        }

        const nextHistory = addTimelineLog(showInvoiceModal, `Factura emitida. Comprobante Nro: ${invoiceNumberInput}`);
        const updated: Reading = {
            ...showInvoiceModal,
            readingStatus: 'facturada',
            readingComment: `Factura: ${invoiceNumberInput}`
        };
        updated.history = nextHistory;

        addReadingAction(updated);
        setShowInvoiceModal(null);
        alert('Facturación registrada exitosamente.');
    };

    // Handle "Nuevo Alquiler" Creation
    const handleCreateRental = () => {
        let finalClientId = rentalClientId;
        let finalMachineId = rentalMachineId;
        let finalPlanId = rentalPlanId;
        const nowStr = new Date().toISOString();
        const startDateStr = new Date().toISOString().split('T')[0];

        // 1. Create client if needed
        if (rentalClientMode === 'create') {
            if (!newClientName.trim() || !newClientCuit.trim()) {
                alert('Completa los campos obligatorios del Cliente.');
                return;
            }
            const nClient: Client = {
                id: `c-${Date.now()}`,
                name: newClientName,
                cuit: newClientCuit,
                taxCategory: newClientTax,
                address: 'Dirección no especificada',
                phone: 'Sin teléfono',
                email: `${newClientName.toLowerCase().replace(/ /g, '')}@example.com`,
                debt: 0,
                active: true,
                createdAt: nowStr,
                updatedAt: nowStr
            };
            updateClientAction(nClient, 'create');
            finalClientId = nClient.id;
        } else {
            if (!finalClientId) {
                alert('Selecciona un cliente para el alquiler.');
                return;
            }
        }

        // 2. Create Plan if needed
        if (rentalPlanMode === 'create') {
            if (!newPlanName.trim()) {
                alert('Ingresa el nombre del plan.');
                return;
            }
            const nPlan: Abono = {
                id: `p-${Date.now()}`,
                name: newPlanName,
                limit: parseInt(newPlanLimit, 10) || 5000,
                price: parseInt(newPlanPrice, 10) || 25000,
                excessPrice: parseInt(newPlanExcess, 10) || 15,
                active: true,
                createdAt: nowStr,
                updatedAt: nowStr
            };
            updateAbonoAction(nPlan, 'create');
            finalPlanId = nPlan.id;
        } else {
            if (!finalPlanId) {
                alert('Selecciona un plan de abono.');
                return;
            }
        }

        // 3. Create or update Machine
        if (rentalMachineMode === 'create') {
            if (!newMachineBrand.trim() || !newMachineModel.trim() || !newMachineSerial.trim()) {
                alert('Completa marca, modelo y serie de la máquina.');
                return;
            }
            const nMachine: Machine = {
                id: `m-${Date.now()}`,
                brand: newMachineBrand,
                model: newMachineModel,
                serial: newMachineSerial,
                type: 'B&N',
                currentCounter: parseInt(newMachineCounter, 10) || 0,
                preventiveInterval: 15000,
                status: 'Alquilada',
                applyIva: true,
                clientId: finalClientId,
                abonoId: finalPlanId,
                lastServiceCounter: 0,
                createdAt: nowStr,
                updatedAt: nowStr
            };
            updateMachineAction(nMachine, 'create');
            finalMachineId = nMachine.id;
        } else {
            if (!finalMachineId) {
                alert('Selecciona una copiadora para alquilar.');
                return;
            }
        }

        // 4. Create the actual Rental Contract
        const nRental: Rental = {
            id: `rental-${Date.now()}`,
            clientId: finalClientId,
            machineId: finalMachineId,
            abonoId: finalPlanId,
            startDate: startDateStr,
            status: 'activo',
            history: [
                {
                    date: startDateStr,
                    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
                    action: 'Contrato de alquiler activado y máquinas asignadas (desde Lecturas)',
                    user: currentUser?.fullname || 'Administrativo'
                }
            ],
            createdAt: nowStr,
            updatedAt: nowStr
        };

        // Call context action (saves rental, updates machine links, and syncs both to Turso)
        addRentalAction(nRental, [{
            id: finalMachineId,
            clientId: finalClientId,
            abonoId: finalPlanId,
            status: 'Alquilada'
        }]);

        // Reset forms
        setShowNewRentalModal(false);
        setRentalClientMode('select');
        setRentalMachineMode('select');
        setRentalPlanMode('select');
        setNewClientName('');
        setNewClientCuit('');
        setNewMachineBrand('');
        setNewMachineModel('');
        setNewMachineSerial('');
        setNewPlanName('');
        alert('¡Nuevo contrato de alquiler generado exitosamente!');
    };

    // Filters and tabs search logic
    const filteredRentedMachines = rentedMachines.filter(m => {
        const client = clients.find(c => c.id === m.clientId);
        const reading = readings.find(r => r.machineId === m.id && r.month === currentMonth);
        
        // Search text matching client or serial
        const q = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
            (client && client.name.toLowerCase().includes(q)) ||
            m.brand.toLowerCase().includes(q) ||
            m.model.toLowerCase().includes(q) ||
            m.serial.toLowerCase().includes(q);

        const matchesClient = !filterClient || m.clientId === filterClient;

        // Audit status matching
        let auditVal = 'pendiente';
        if (reading) {
            auditVal = reading.readingStatus; // cargada, observada, validada, facturada
        }
        const matchesAudit = !filterAudit || auditVal === filterAudit;

        // Quick Tabs
        let matchesTab = true;
        if (quickTab === 'pending') {
            matchesTab = !reading;
        } else if (quickTab === 'observed') {
            matchesTab = !!reading && reading.readingStatus === 'observada';
        } else if (quickTab === 'ready_to_invoice') {
            matchesTab = !!reading && (reading.readingStatus === 'validada' || reading.readingStatus === 'observada');
        } else if (quickTab === 'invoiced') {
            matchesTab = !!reading && reading.readingStatus === 'facturada';
        }

        return matchesSearch && matchesClient && matchesAudit && matchesTab;
    });

    return (
        <div className="space-y-6 animate-fade-in relative text-slate-100 pb-12">
            
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-base font-semibold text-slate-100 uppercase tracking-wider">Carga y Facturación de Lecturas</h2>
                    <p className="text-[10px] text-slate-400">Toma de lecturas de fin de ciclo, auditoría de excedentes y emisión de liquidaciones.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={() => setShowNewRentalModal(true)}>
                        <PlusCircle size={14} className="mr-1" /> Nuevo Alquiler
                    </Button>
                </div>
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-2">
                <button 
                    onClick={() => setQuickTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickTab === 'all' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-450 hover:bg-slate-800/40'}`}
                >
                    Todas las Alquiladas
                </button>
                <button 
                    onClick={() => setQuickTab('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickTab === 'pending' ? 'bg-red-500/10 text-red-405 font-bold border border-red-500/20' : 'text-slate-450 hover:bg-slate-800/40'}`}
                >
                    Solo Pendientes
                </button>
                <button 
                    onClick={() => setQuickTab('observed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickTab === 'observed' ? 'bg-amber-500/10 text-amber-405 font-bold border border-amber-500/20' : 'text-slate-450 hover:bg-slate-800/40'}`}
                >
                    Solo Observadas
                </button>
                <button 
                    onClick={() => setQuickTab('ready_to_invoice')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickTab === 'ready_to_invoice' ? 'bg-indigo-500/10 text-indigo-405 font-bold border border-indigo-500/20' : 'text-slate-450 hover:bg-slate-800/40'}`}
                >
                    Listas para Facturar
                </button>
                <button 
                    onClick={() => setQuickTab('invoiced')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${quickTab === 'invoiced' ? 'bg-emerald-500/10 text-emerald-405 font-bold border border-emerald-500/20' : 'text-slate-450 hover:bg-slate-800/40'}`}
                >
                    Facturadas del Mes
                </button>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-slate-950 border border-slate-850 rounded-xl">
                {/* Search */}
                <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                        <Search size={14} />
                    </span>
                    <input
                        type="text"
                        placeholder="Buscar cliente o serie..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-slate-200 text-xs focus:outline-none"
                    />
                </div>

                {/* Cliente */}
                <select
                    value={filterClient}
                    onChange={(e) => setFilterClient(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300 text-xs focus:outline-none"
                >
                    <option value="">Cliente: Todos</option>
                    {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>

                {/* Auditoria */}
                <select
                    value={filterAudit}
                    onChange={(e) => setFilterAudit(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300 text-xs focus:outline-none"
                >
                    <option value="">Estado Auditoría: Todos</option>
                    <option value="pendiente">PENDIENTE</option>
                    <option value="cargada">CARGADA</option>
                    <option value="observada">OBSERVADA</option>
                    <option value="validada">VALIDADA</option>
                    <option value="facturada">FACTURADA</option>
                </select>
            </div>

            {/* Table Area */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
                
                {/* Left Area: Readings Board */}
                <div className={viewTimelineReading ? "xl:col-span-3 space-y-4" : "xl:col-span-4 space-y-4"}>
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Cliente</TableHeaderCell>
                                    <TableHeaderCell>Equipo / Serie</TableHeaderCell>
                                    <TableHeaderCell>Contador Anterior</TableHeaderCell>
                                    <TableHeaderCell>Contador Final</TableHeaderCell>
                                    <TableHeaderCell>Consumo</TableHeaderCell>
                                    <TableHeaderCell>Importe Total</TableHeaderCell>
                                    <TableHeaderCell>Auditoría</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Acción</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRentedMachines.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-10 text-slate-500 text-xs italic">
                                            No hay registros de alquileres que coincidan con los filtros seleccionados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRentedMachines.map(m => {
                                        const client = clients.find(c => c.id === m.clientId);
                                        const reading = readings.find(r => r.machineId === m.id && r.month === currentMonth);
                                        const hasActiveCriticalTicket = tickets.some(t => t.machineId === m.id && !['resuelto', 'cerrado'].includes(t.status) && ['alta', 'urgente'].includes(t.priority));
                                        
                                        let auditBadge = <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-red-500/10 text-red-400">PENDIENTE</span>;
                                        if (reading) {
                                            const status = reading.readingStatus;
                                            if (status === 'cargada') {
                                                auditBadge = <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/20">CARGADA</span>;
                                            } else if (status === 'observada') {
                                                auditBadge = <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20">OBSERVADA</span>;
                                            } else if (status === 'validada') {
                                                auditBadge = <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-indigo-500/10 text-indigo-405 border border-indigo-500/20">VALIDADA</span>;
                                            } else if (status === 'facturada') {
                                                auditBadge = <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">FACTURADA</span>;
                                            }
                                        }

                                        return (
                                            <TableRow key={m.id} className={viewTimelineReading?.machineId === m.id ? "bg-indigo-950/20" : "hover:bg-slate-900/40"}>
                                                <TableCell className="font-bold text-slate-100">{client ? client.name : 'Desconocido'}</TableCell>
                                                <TableCell className="text-xs text-slate-300">
                                                    <strong>{m.brand} {m.model}</strong>
                                                    <span className="block text-slate-500 text-[10px] flex items-center flex-wrap gap-1.5 mt-0.5">
                                                        S/N: {m.serial}
                                                        {hasActiveCriticalTicket && (
                                                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-red-500/10 text-red-400 font-extrabold text-[8px] uppercase animate-pulse border border-red-500/20">
                                                                <AlertTriangle size={8} className="text-red-400" /> Incidencia Crítica
                                                            </span>
                                                        )}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-300">
                                                    {(reading ? (reading.initial || 0) : getInitialCounterForMachine(m, currentMonth)).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-300">
                                                    {reading ? (reading.final || 0).toLocaleString() : '-'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {reading ? (
                                                        <span className={reading.excessCount > 0 ? "text-amber-500 font-bold" : "text-slate-400"}>
                                                            {((reading.final || 0) - (reading.initial || 0)).toLocaleString()} copias
                                                        </span>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell className="font-mono-tabular text-xs font-bold text-slate-200">
                                                    {reading ? formatCurrency(Number(reading.totalAmount) || 0) : '-'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {auditBadge}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        {reading && (
                                                            <button 
                                                                title="Ver Historial de Auditoría"
                                                                onClick={() => setViewTimelineReading(reading)}
                                                                className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-850 transition-colors"
                                                            >
                                                                <Layers size={12} className="text-slate-400" />
                                                            </button>
                                                        )}

                                                        {!reading && (
                                                            <Button variant="primary" size="sm" onClick={() => handleOpenLogModal(m)}>
                                                                Cargar
                                                            </Button>
                                                        )}

                                                        {reading && reading.readingStatus === 'cargada' && (
                                                            <Button variant="secondary" size="sm" onClick={() => handleValidateReading(reading)}>
                                                                Validar
                                                            </Button>
                                                        )}

                                                        {reading && (reading.readingStatus === 'validada' || reading.readingStatus === 'observada') && (
                                                            <button 
                                                                onClick={() => handleOpenInvoiceModal(reading)}
                                                                className="px-2.5 py-1 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 shadow-md shadow-indigo-600/10"
                                                            >
                                                                <FileText size={11} /> Facturar
                                                            </button>
                                                        )}

                                                        {reading && reading.readingStatus === 'facturada' && (
                                                            <span className="text-[10px] text-emerald-450 font-bold flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                                                <FileCheck size={11} /> Facturado
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>

                {/* Audit Timeline Drawer Panel */}
                {viewTimelineReading && (
                    <div className="xl:col-span-1 space-y-4 animate-fade-in">
                        <Card className="border-slate-800 bg-slate-950/60 sticky top-24">
                            <div className="p-4 bg-slate-900 text-white flex items-center justify-between rounded-t-2xl border-b border-slate-800">
                                <div>
                                    <h3 className="font-bold text-xs uppercase tracking-wider">Historial de Auditoría</h3>
                                    <span className="text-[9px] text-slate-400">Lectura ID: {viewTimelineReading.id}</span>
                                </div>
                                <button className="text-slate-400 hover:text-white" onClick={() => setViewTimelineReading(null)}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <CardContent className="p-4 space-y-4">
                                <div className="text-xs space-y-2">
                                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                                        <span className="text-slate-500">Periodo:</span>
                                        <span className="font-semibold text-slate-200">{formatPeriod(viewTimelineReading.month)}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                                        <span className="text-slate-500">Contador Final:</span>
                                        <span className="font-semibold text-slate-205 font-mono-tabular">{(viewTimelineReading.final || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                                        <span className="text-slate-500">Excedente:</span>
                                        <span className="font-semibold text-amber-500 font-mono-tabular">{(viewTimelineReading.excessCount || 0).toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">Línea de Tiempo / Trazabilidad</span>
                                    
                                    <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                                        {(viewTimelineReading.history || [
                                            { date: '-', time: '-', action: 'Carga inicial del registro', user: 'Administrativo' }
                                        ]).map((log: any, idx: number) => (
                                            <div key={idx} className="relative pl-6 text-[10px] space-y-0.5">
                                                <span className="absolute left-0.5 top-1 w-3 h-3 rounded-full bg-indigo-650 border border-slate-900 flex items-center justify-center"></span>
                                                <span className="text-[9px] text-slate-550 font-mono block">{log.date} {log.time}</span>
                                                <p className="font-medium text-slate-300">{log.action}</p>
                                                <span className="text-[9px] text-slate-500 block">Operario: {log.user}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* MODAL: REGISTRAR LECTURA */}
            {selectedMachine && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-100">Registrar Lectura de Fin de Ciclo</h3>
                            <button className="text-slate-400 hover:text-slate-250" onClick={() => setSelectedMachine(null)}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <CardContent className="p-5 space-y-4">
                            <div className="text-xs space-y-1 bg-slate-950/40 p-3.5 rounded-xl border border-slate-850/50">
                                <span className="text-[9px] uppercase font-bold text-slate-500 block">Cliente Asociado</span>
                                <span className="font-bold text-slate-200">
                                    {clients.find(c => c.id === selectedMachine.clientId)?.name}
                                </span>
                                <span className="text-slate-400 text-[10px] block pt-1 border-t border-slate-800/40 mt-1">
                                    Copiadora: {selectedMachine.brand} {selectedMachine.model} (S/N: {selectedMachine.serial})
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="text-xs bg-indigo-950/20 p-3 rounded-xl border border-indigo-900/30">
                                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Contador Anterior</span>
                                    <span className="font-bold text-slate-205 font-mono-tabular mt-1 block">
                                        {getInitialCounterForMachine(selectedMachine, currentMonth).toLocaleString()} copias
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Contador Final</label>
                                    <input
                                        type="number"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder="Ej: 34500"
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {validationError && (
                                <p className="text-red-500 text-[10px] font-bold mt-1 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">{validationError}</p>
                            )}

                            {anomalousWarning && (
                                <div className="text-amber-400 text-[10px] font-semibold mt-1 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 space-y-1">
                                    <p className="flex items-center gap-1"><AlertTriangle size={13} /> {anomalousWarning}</p>
                                    <p className="font-bold">¿Confirmas la carga de este consumo excesivo?</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" size="md" className="flex-1" onClick={() => setSelectedMachine(null)}>
                                    Cancelar
                                </Button>
                                <Button variant="primary" size="md" className="flex-1" onClick={handleSaveReading}>
                                    {anomalousWarning ? 'Confirmar Carga' : 'Guardar Lectura'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* MODAL: FACTURAR LECTURA */}
            {showInvoiceModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100 animate-fade-in">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5"><FileText size={16} className="text-indigo-400" /> Registrar Emisión de Factura</h3>
                            <button className="text-slate-400 hover:text-slate-200" onClick={() => setShowInvoiceModal(null)}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <CardContent className="p-5 space-y-4">
                            <div className="text-xs space-y-2 bg-slate-950/30 p-3 rounded-xl border border-slate-850/60">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Cliente:</span>
                                    <span className="font-bold text-slate-200">
                                        {clients.find(c => c.id === machines.find(m => m.id === showInvoiceModal.machineId)?.clientId)?.name}
                                    </span>
                                </div>
                                <div className="flex justify-between border-t border-slate-800/40 pt-1.5">
                                    <span className="text-slate-500">Total Neto:</span>
                                    <span className="font-semibold text-slate-300 font-mono-tabular">{formatCurrency(showInvoiceModal.netAmount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">IVA Discriminado:</span>
                                    <span className="font-semibold text-slate-300 font-mono-tabular">{formatCurrency(showInvoiceModal.ivaAmount)}</span>
                                </div>
                                <div className="flex justify-between border-t border-dashed border-slate-800 pt-1.5 text-sm">
                                    <span className="font-bold text-slate-400">Total Billed:</span>
                                    <span className="font-extrabold text-indigo-400 font-mono-tabular">{formatCurrency(showInvoiceModal.totalAmount)}</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500 block">Número de Comprobante / Factura</label>
                                <input
                                    type="text"
                                    value={invoiceNumberInput}
                                    onChange={(e) => setInvoiceNumberInput(e.target.value)}
                                    placeholder="Ej: FAC-0001-00004523"
                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            {invoiceError && (
                                <p className="text-red-500 text-[10px] font-bold bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">{invoiceError}</p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" size="md" className="flex-1" onClick={() => setShowInvoiceModal(null)}>
                                    Cancelar
                                </Button>
                                <Button variant="primary" size="md" className="flex-1" onClick={handleSaveInvoice}>
                                    Emitir Factura
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* MODAL: NUEVO ALQUILER (CONTRATO) */}
            {showNewRentalModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg border-slate-800 bg-slate-900 text-slate-100 max-h-[85vh] overflow-y-auto">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
                            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5"><UserPlus size={16} className="text-indigo-400" /> Registrar Nuevo Contrato de Alquiler</h3>
                            <button className="text-slate-400 hover:text-slate-200" onClick={() => setShowNewRentalModal(false)}>
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
                                        {clients.map(c => (
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
                                        {abonos.map(a => (
                                            <option key={a.id} value={a.id}>{a.name} (Límite: {a.limit.toLocaleString()} | {formatPeriod(currentMonth)})</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <input
                                            type="text"
                                            placeholder="Nombre del Abono (Ej: Plan Pro 10k)"
                                            value={newPlanName}
                                            onChange={(e) => setNewPlanName(e.target.value)}
                                            className="col-span-2 bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Límite Copias Incluidas"
                                            value={newPlanLimit}
                                            onChange={(e) => setNewPlanLimit(e.target.value)}
                                            className="bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Precio Base Abono ($)"
                                            value={newPlanPrice}
                                            onChange={(e) => setNewPlanPrice(e.target.value)}
                                            className="bg-slate-955 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Precio Copia Excedente ($)"
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

                            <div className="flex gap-3 pt-4 border-t border-slate-850">
                                <Button variant="secondary" size="md" className="flex-1" onClick={() => setShowNewRentalModal(false)}>
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
        </div>
    );
}
