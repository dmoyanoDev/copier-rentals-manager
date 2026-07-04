'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Ticket } from '@/lib/mockData';
import { Plus, Edit, User, Calendar, Settings } from 'lucide-react';

export default function TechnicalPage() {
    const { tickets, setTickets, currentUser, users, clients, machines } = useManagement();
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    
    // Edit Form temporary states
    const [status, setStatus] = useState<Ticket['status']>('nuevo');
    const [diagnostic, setDiagnostic] = useState('');
    const [actionTaken, setActionTaken] = useState('');
    const [partsUsed, setPartsUsed] = useState('');
    const [partsNeeded, setPartsNeeded] = useState('');
    const [assignedTechId, setAssignedTechId] = useState('');

    // Creation Form states
    const [newClientId, setNewClientId] = useState('');
    const [newMachineId, setNewMachineId] = useState('');
    const [newCategory, setNewCategory] = useState('Servicio');
    const [newPriority, setNewPriority] = useState<'baja' | 'media' | 'alta'>('media');
    const [newDescription, setNewDescription] = useState('');
    const [newAssignedTechId, setNewAssignedTechId] = useState('');
    const [newSlaDate, setNewSlaDate] = useState('');

    const handleOpenEdit = (t: Ticket) => {
        setSelectedTicket(t);
        setIsEditing(true);
        setStatus(t.status);
        setDiagnostic(t.diagnostic || '');
        setActionTaken(t.actionTaken || '');
        setPartsUsed(t.partsUsed || '');
        setPartsNeeded(t.partsNeeded || '');
        setAssignedTechId(t.assignedTechId || '');
    };

    const handleOpenCreate = () => {
        setNewClientId('');
        setNewMachineId('');
        setNewCategory('Servicio');
        setNewPriority('media');
        setNewDescription('');
        setNewAssignedTechId('');
        
        // Default SLA: 24h from now
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setNewSlaDate(tomorrow.toISOString().split('T')[0]);
        
        setIsCreating(true);
    };

    const handleSaveTicket = () => {
        if (!selectedTicket) return;

        const updatedHistory = [...(selectedTicket.history || [])];
        if (selectedTicket.status !== status) {
            updatedHistory.push({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                action: `Cambio de estado a: ${status.toUpperCase()}`,
                user: currentUser?.fullname || 'Sistema'
            });
        }

        const updated: Ticket = {
            ...selectedTicket,
            status,
            diagnostic,
            actionTaken,
            partsUsed,
            partsNeeded,
            assignedTechId: assignedTechId || null,
            history: updatedHistory
        };

        setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updated : t));
        setIsEditing(false);
        setSelectedTicket(null);
    };

    const handleCreateTicket = (e: React.FormEvent) => {
        e.preventDefault();
        
        const client = clients.find(c => c.id === newClientId);
        const machine = machines.find(m => m.id === newMachineId);

        if (!client || !machine) {
            alert('Por favor selecciona un cliente y un equipo.');
            return;
        }

        const newTicket: Ticket = {
            id: 'ticket-' + Date.now(),
            machineId: machine.id,
            clientId: client.id,
            clientName: client.name,
            machineDesc: `${machine.brand} ${machine.model}`,
            serialNumber: machine.serial,
            clientType: 'existente',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
            priority: newPriority,
            status: 'nuevo',
            category: newCategory,
            description: newDescription,
            diagnostic: '',
            actionTaken: '',
            partsNeeded: '',
            partsUsed: '',
            internalNotes: '',
            assignedTechId: newAssignedTechId || null,
            slaDate: newSlaDate,
            history: [
                {
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString('es-AR').slice(0, 5),
                    action: 'Ticket creado y registrado en el sistema',
                    user: currentUser?.fullname || 'Sistema'
                }
            ]
        };

        setTickets(prev => [...prev, newTicket]);
        setIsCreating(false);
    };

    const isTech = currentUser?.role === 'tecnico';
    const clientMachines = machines.filter(m => m.clientId === newClientId);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold text-slate-100">Bitácora de Órdenes de Asistencia Técnica</h2>
                {!isTech && (
                    <Button variant="primary" size="sm" onClick={handleOpenCreate}>
                        <Plus size={16} className="mr-1.5" /> Abrir Ticket de Soporte
                    </Button>
                )}
            </div>

            <TableContainer>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell>Prioridad</TableHeaderCell>
                            <TableHeaderCell>Cliente</TableHeaderCell>
                            <TableHeaderCell>Equipo / Serie</TableHeaderCell>
                            <TableHeaderCell>Motivo / Falla</TableHeaderCell>
                            <TableHeaderCell>Técnico Asignado</TableHeaderCell>
                            <TableHeaderCell>Límite SLA</TableHeaderCell>
                            <TableHeaderCell>Estado</TableHeaderCell>
                            <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tickets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                                    No hay registros de incidentes activos.
                                </TableCell>
                            </TableRow>
                        ) : (
                            tickets.map(t => {
                                const tech = users.find(u => u.id === t.assignedTechId);
                                const techName = tech ? tech.fullname : 'Sin asignar';

                                return (
                                    <TableRow key={t.id}>
                                        <TableCell className="text-xs">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                t.priority === 'alta' ? 'bg-red-500/10 text-red-500' :
                                                t.priority === 'media' ? 'bg-amber-500/10 text-amber-500' :
                                                'bg-emerald-500/10 text-emerald-500'
                                            }`}>
                                                {t.priority.toUpperCase()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-bold text-slate-100">{t.clientName}</TableCell>
                                        <TableCell className="text-xs text-slate-300">
                                            <strong>{t.machineDesc}</strong>
                                            <span className="block text-slate-400 text-[10px]">{t.serialNumber}</span>
                                        </TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-300">{t.category}</TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-300">{techName}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-400">
                                            {t.slaDate ? t.slaDate.split('-').reverse().join('/') : '-'}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                                t.status === 'resuelto' || t.status === 'cerrado' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-300'
                                            }`}>
                                                {t.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(t)}>
                                                {isTech ? 'Atender' : 'Editar'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Modal Dialog for Edit or Service Ticket */}
            {isEditing && selectedTicket && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-lg border-slate-800 animate-fade-in">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-100">
                                {isTech ? 'Registrar Asistencia Técnica' : 'Editar Orden de Trabajo'}
                            </h3>
                            <button className="text-slate-400 hover:text-slate-250" onClick={() => setIsEditing(false)}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <CardContent className="p-5 space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Cliente</span>
                                    <span className="font-bold text-slate-200">{selectedTicket.clientName}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Equipo / Serie</span>
                                    <span className="font-bold text-slate-200">{selectedTicket.machineDesc}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Estado del Ticket</label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as Ticket['status'])}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
                                    >
                                        <option value="nuevo">Nuevo</option>
                                        <option value="asignado">Asignado</option>
                                        <option value="en-proceso">En Proceso</option>
                                        <option value="esperando-repuesto">Esperando Repuesto</option>
                                        <option value="pendiente-cliente">Pendiente Cliente</option>
                                        <option value="resuelto">Resuelto</option>
                                        <option value="cerrado">Cerrado</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Técnico Asignado</label>
                                    <select
                                        disabled={isTech}
                                        value={assignedTechId}
                                        onChange={(e) => setAssignedTechId(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none disabled:opacity-50"
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
                                    value={diagnostic}
                                    onChange={(e) => setDiagnostic(e.target.value)}
                                    placeholder="Detalla el problema técnico encontrado..."
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none h-16 resize-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500 block">Trabajo Realizado</label>
                                <textarea
                                    value={actionTaken}
                                    onChange={(e) => setActionTaken(e.target.value)}
                                    placeholder="Detalla las acciones tomadas para resolver la falla..."
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none h-16 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Repuestos Solicitados</label>
                                    <input
                                        type="text"
                                        value={partsNeeded}
                                        onChange={(e) => setPartsNeeded(e.target.value)}
                                        placeholder="Ej: Rodillo fusor Ricoh"
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Repuestos Utilizados</label>
                                    <input
                                        type="text"
                                        value={partsUsed}
                                        onChange={(e) => setPartsUsed(e.target.value)}
                                        placeholder="Ej: Limpieza láser"
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" size="md" className="flex-1" onClick={() => setIsEditing(false)}>
                                    Cancelar
                                </Button>
                                <Button variant="primary" size="md" className="flex-1" onClick={handleSaveTicket}>
                                    Guardar Cambios
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Modal Dialog for Opening Support Ticket */}
            <Modal
                isOpen={isCreating}
                onClose={() => setIsCreating(false)}
                title="Abrir Ticket de Soporte Técnico"
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleCreateTicket}>
                            Abrir Ticket
                        </Button>
                    </>
                }
            >
                <form className="space-y-4" onSubmit={handleCreateTicket}>
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
                            label="Equipo *"
                            value={newMachineId}
                            onChange={(e) => setNewMachineId(e.target.value)}
                            options={[
                                { value: '', label: 'Seleccionar Equipo...' },
                                ...clientMachines.map(m => ({ value: m.id, label: `${m.brand} ${m.model} (S/N: ${m.serial})` }))
                            ]}
                        />
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
                                { value: 'baja', label: 'Baja' },
                                { value: 'media', label: 'Media' },
                                { value: 'alta', label: 'Alta / Urgente' }
                            ]}
                        />
                    </div>

                    <Input
                        label="Descripción del Problema *"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Ej: Código de error SC542, hojas arrugadas..."
                    />

                    <Select
                        label="Asignar Técnico"
                        value={newAssignedTechId}
                        onChange={(e) => setNewAssignedTechId(e.target.value)}
                        options={[
                            { value: '', label: 'Sin Asignar' },
                            ...users.filter(u => u.role === 'tecnico').map(t => ({ value: t.id, label: t.fullname }))
                        ]}
                    />

                    <Input
                        label="Límite de Resolución (SLA) *"
                        type="date"
                        value={newSlaDate}
                        onChange={(e) => setNewSlaDate(e.target.value)}
                    />
                </form>
            </Modal>
        </div>
    );
}
