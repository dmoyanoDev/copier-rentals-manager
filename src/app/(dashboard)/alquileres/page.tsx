'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { formatCurrency, formatPeriod, getClientIvaRate } from '@/lib/utils';
import { Machine, Ticket } from '@/lib/mockData';
import { Wrench, History, Calendar, CheckCircle } from 'lucide-react';

export default function RentalsPage() {
    const { clients, machines, readings, setTickets, abonos, currentUser, currentMonth } = useManagement();
    const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
    const [filter, setFilter] = useState<'all' | 'excess' | 'service' | 'risk'>('all');

    // Modals visibility
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    // Support Request form inputs
    const [ticketCategory, setTicketCategory] = useState('Servicio');
    const [ticketPriority, setTicketPriority] = useState<'baja' | 'media' | 'alta'>('media');
    const [ticketDescription, setTicketDescription] = useState('');
    const [ticketSlaDate, setTicketSlaDate] = useState('');

    const rentedMachines = machines.filter(m => m.clientId !== null);

    // Apply filters
    const filteredMachines = rentedMachines.filter(m => {
        const client = clients.find(c => c.id === m.clientId);
        const abono = abonos.find(a => a.id === m.abonoId);
        const reading = readings.find(r => r.machineId === m.id && r.month === currentMonth);

        if (filter === 'service') {
            return m.status === 'Alerta Técnica';
        }

        if (filter === 'excess') {
            if (!reading || !abono) return false;
            const consumed = Math.max(0, reading.final - reading.initial);
            return consumed > abono.limit;
        }

        if (filter === 'risk') {
            return reading?.readingStatus === 'observada' || (client && client.debt > 100000);
        }

        return true;
    });

    const handleOpenServiceModal = () => {
        if (!selectedMachine) return;
        setTicketCategory('Servicio');
        setTicketPriority('media');
        setTicketDescription('');
        
        // SLA 24h tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setTicketSlaDate(tomorrow.toISOString().split('T')[0]);

        setIsServiceModalOpen(true);
    };

    const handleOpenHistoryModal = () => {
        if (!selectedMachine) return;
        setIsHistoryModalOpen(true);
    };

    const handleCreateServiceRequest = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMachine) return;

        const client = clients.find(c => c.id === selectedMachine.clientId);
        if (!client) return;

        const newTicket: Ticket = {
            id: 'ticket-' + Date.now(),
            machineId: selectedMachine.id,
            clientId: client.id,
            clientName: client.name,
            machineDesc: `${selectedMachine.brand} ${selectedMachine.model}`,
            serialNumber: selectedMachine.serial,
            clientType: 'existente',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
            priority: ticketPriority,
            status: 'nuevo',
            category: ticketCategory,
            description: ticketDescription,
            diagnostic: '',
            actionTaken: '',
            partsNeeded: '',
            partsUsed: '',
            internalNotes: '',
            assignedTechId: null,
            slaDate: ticketSlaDate,
            history: [
                {
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                    action: 'Pedido de servicio creado desde ficha de alquiler',
                    user: currentUser?.fullname || 'Sistema'
                }
            ]
        };

        setTickets(prev => [...prev, newTicket]);
        setIsServiceModalOpen(false);
        alert('¡Solicitud de asistencia técnica registrada con éxito!');
    };

    // Filter historical readings for specific machine
    const machineReadings = selectedMachine
        ? readings.filter(r => r.machineId === selectedMachine.id).sort((a, b) => b.month.localeCompare(a.month))
        : [];

    return (
        <div className="space-y-6 animate-fade-in relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                    <Button variant={filter === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('all')}>
                        Ver Todos ({rentedMachines.length})
                    </Button>
                    <Button variant={filter === 'excess' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('excess')}>
                        Excedentes Altos
                    </Button>
                    <Button variant={filter === 'service' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('service')}>
                        Alerta Técnica ({rentedMachines.filter(m => m.status === 'Alerta Técnica').length})
                    </Button>
                    <Button variant={filter === 'risk' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('risk')}>
                        Márgenes en Riesgo
                    </Button>
                </div>
            </div>

            {/* Main Split Layout: Table and Drawer */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                <div className={selectedMachine ? "xl:col-span-2 space-y-4 print:hidden" : "xl:col-span-3 space-y-4 print:hidden"}>
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Cliente</TableHeaderCell>
                                    <TableHeaderCell>Modelo / Serie</TableHeaderCell>
                                    <TableHeaderCell>Plan</TableHeaderCell>
                                    <TableHeaderCell>Consumo ({formatPeriod(currentMonth)})</TableHeaderCell>
                                    <TableHeaderCell>Monto Base</TableHeaderCell>
                                    <TableHeaderCell>Excedente</TableHeaderCell>
                                    <TableHeaderCell>Estado</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Acción</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMachines.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                                            No se encontraron alquileres activos con el filtro seleccionado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredMachines.map(m => {
                                        const client = clients.find(c => c.id === m.clientId);
                                        const abono = abonos.find(a => a.id === m.abonoId);
                                        const reading = readings.find(r => r.machineId === m.id && r.month === currentMonth);

                                        const clientName = client ? client.name : 'Desconocido';
                                        const abonoName = abono ? abono.name : 'Sin abono';
                                        const basePrice = abono ? abono.price : 0;

                                        let consumedStr = 'Sin Cargar';
                                        let excessAmt = 0;
                                        let isExcess = false;

                                        if (reading) {
                                            const consumed = Math.max(0, reading.final - reading.initial);
                                            consumedStr = `${consumed.toLocaleString('es-AR')} copias`;
                                            if (abono && consumed > abono.limit) {
                                                excessAmt = (consumed - abono.limit) * abono.excessPrice;
                                                isExcess = true;
                                            }
                                        }

                                        return (
                                            <TableRow key={m.id} className={selectedMachine?.id === m.id ? "bg-indigo-950/20" : ""}>
                                                <TableCell className="font-bold text-slate-100">{clientName}</TableCell>
                                                <TableCell className="text-xs text-slate-300">
                                                    <strong>{m.brand} {m.model}</strong>
                                                    <span className="block text-slate-400 text-[10px]">{m.serial}</span>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-300">{abonoName}</TableCell>
                                                <TableCell className="text-xs">
                                                    <span className={!reading ? "text-red-500 font-semibold" : (isExcess ? "text-amber-500 font-bold" : "text-slate-450")}>
                                                        {consumedStr}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-300">{formatCurrency(basePrice)}</TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-amber-500 font-bold">
                                                    {excessAmt > 0 ? formatCurrency(excessAmt) : '-'}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                                        m.status === 'Alerta Técnica' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-450'
                                                    }`}>
                                                        {m.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="secondary" size="sm" onClick={() => setSelectedMachine(m)}>
                                                        Ver Ficha
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

                {/* Right Drawer/Panel Detail */}
                {selectedMachine && (
                    <div className="xl:col-span-1 print:hidden">
                        <Card className="sticky top-24 border-indigo-600/30 shadow-lg animate-fade-in">
                            <div className="p-4 bg-slate-900 text-white flex items-center justify-between rounded-t-2xl">
                                <div>
                                    <h3 className="font-bold text-sm">Expediente de Alquiler</h3>
                                    <span className="text-[10px] text-slate-400">Serie: {selectedMachine.serial}</span>
                                </div>
                                <button className="text-slate-400 hover:text-white" onClick={() => setSelectedMachine(null)}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <CardContent className="p-5 space-y-4 text-xs">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Cliente Asociado</span>
                                    <span className="font-bold text-slate-200">
                                        {clients.find(c => c.id === selectedMachine.clientId)?.name}
                                    </span>
                                </div>

                                <div className="border-t border-slate-800 pt-3 grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Marca / Modelo</span>
                                        <span className="font-bold text-slate-350">
                                            {selectedMachine.brand} {selectedMachine.model}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Número de Serie</span>
                                        <span className="font-bold text-slate-350 font-mono-tabular">
                                            {selectedMachine.serial}
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-slate-800 pt-3">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Detalles del Plan Contratado</span>
                                    {selectedMachine.abonoId ? (
                                        <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-800 mt-1 space-y-1">
                                            <span className="font-bold text-indigo-400 block">
                                                {abonos.find(a => a.id === selectedMachine.abonoId)?.name}
                                            </span>
                                            <div className="flex justify-between text-[11px] text-slate-450">
                                                <span>Abono Mensual:</span>
                                                <span className="font-bold text-slate-300 font-mono-tabular">
                                                    {formatCurrency(abonos.find(a => a.id === selectedMachine.abonoId)?.price || 0)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-[11px] text-slate-450">
                                                <span>Límite de Copias:</span>
                                                <span className="font-bold text-slate-300">
                                                    {abonos.find(a => a.id === selectedMachine.abonoId)?.limit.toLocaleString('es-AR')}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-[11px] text-slate-450">
                                                <span>Costo de Copia Excedente:</span>
                                                <span className="font-bold text-slate-300 font-mono-tabular">
                                                    {formatCurrency(abonos.find(a => a.id === selectedMachine.abonoId)?.excessPrice || 0)}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-slate-450">Sin abono contratado</span>
                                    )}
                                </div>

                                <div className="border-t border-slate-800 pt-3 space-y-2">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Acciones Rápidas</span>
                                    <div className="flex flex-col gap-2">
                                        <Button variant="primary" size="sm" className="w-full flex items-center justify-center gap-1.5" onClick={handleOpenServiceModal}>
                                            <Wrench size={14} /> Solicitar Servicio Técnico
                                        </Button>
                                        <Button variant="secondary" size="sm" className="w-full flex items-center justify-center gap-1.5" onClick={handleOpenHistoryModal}>
                                            <History size={14} /> Ver Historial de Lecturas
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Modal: Solicitar Servicio Técnico */}
            <Modal
                isOpen={isServiceModalOpen}
                onClose={() => setIsServiceModalOpen(false)}
                title="Nueva Orden de Asistencia Técnica"
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsServiceModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleCreateServiceRequest}>
                            Registrar Pedido
                        </Button>
                    </>
                }
            >
                {selectedMachine && (
                    <form className="space-y-4" onSubmit={handleCreateServiceRequest}>
                        <div className="text-xs space-y-1 border-b border-slate-800 pb-3">
                            <div>
                                <span className="text-slate-550 block">Cliente:</span>
                                <span className="font-bold text-slate-205">{clients.find(c => c.id === selectedMachine.clientId)?.name}</span>
                            </div>
                            <div className="pt-1.5">
                                <span className="text-slate-550 block">Equipo Asignado:</span>
                                <span className="font-bold text-slate-205">{selectedMachine.brand} {selectedMachine.model} (S/N: {selectedMachine.serial})</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label="Categoría *"
                                value={ticketCategory}
                                onChange={(e) => setTicketCategory(e.target.value)}
                                options={[
                                    { value: 'Servicio', label: 'Servicio / Falla Técnica' },
                                    { value: 'Repuesto', label: 'Pedido de Repuestos' },
                                    { value: 'Insumo', label: 'Pedido de Insumos / Tóner' }
                                ]}
                            />
                            <Select
                                label="Prioridad *"
                                value={ticketPriority}
                                onChange={(e) => setTicketPriority(e.target.value as any)}
                                options={[
                                    { value: 'baja', label: 'Baja' },
                                    { value: 'media', label: 'Media' },
                                    { value: 'alta', label: 'Alta' }
                                ]}
                            />
                        </div>

                        <Input
                            label="Motivo / Descripción de la Falla *"
                            value={ticketDescription}
                            onChange={(e) => setTicketDescription(e.target.value)}
                            required
                            placeholder="Describa brevemente el problema (ej: hojas trabadas, lineas en copias)"
                        />

                        <Input
                            label="Fecha de Resolución SLA *"
                            type="date"
                            value={ticketSlaDate}
                            onChange={(e) => setTicketSlaDate(e.target.value)}
                            required
                        />
                    </form>
                )}
            </Modal>

            {/* Modal: Historial de Lecturas */}
            <Modal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                title="Historial de Lecturas del Equipo"
                footer={
                    <Button variant="secondary" size="sm" onClick={() => setIsHistoryModalOpen(false)}>
                        Cerrar
                    </Button>
                }
            >
                {selectedMachine && (
                    <div className="space-y-4">
                        <div className="text-xs border-b border-slate-800 pb-3">
                            <span className="font-bold text-slate-200 block">{selectedMachine.brand} {selectedMachine.model}</span>
                            <span className="text-slate-400 block text-[10px] mt-0.5">Serie: {selectedMachine.serial}</span>
                        </div>

                        <TableContainer className="max-h-[300px] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Periodo</TableHeaderCell>
                                        <TableHeaderCell>Inicial</TableHeaderCell>
                                        <TableHeaderCell>Final</TableHeaderCell>
                                        <TableHeaderCell>Consumo</TableHeaderCell>
                                        <TableHeaderCell>Total</TableHeaderCell>
                                        <TableHeaderCell>Estado</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {machineReadings.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-6 text-slate-450 text-xs">
                                                Sin lecturas cargadas para este equipo.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        machineReadings.map(r => (
                                            <TableRow key={r.id}>
                                                <TableCell className="font-bold text-slate-200">{formatPeriod(r.month)}</TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-350">{r.initial.toLocaleString('es-AR')}</TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-350">{r.final.toLocaleString('es-AR')}</TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-300">
                                                    {(r.final - r.initial).toLocaleString('es-AR')}
                                                </TableCell>
                                                <TableCell className="font-mono-tabular text-xs text-slate-200 font-bold">
                                                    {formatCurrency(r.totalAmount)}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                                        r.status === 'paid' ? 'bg-emerald-500/10 text-emerald-450' : 'bg-red-500/10 text-red-400'
                                                    }`}>
                                                        {r.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </div>
                )}
            </Modal>
        </div>
    );
}
