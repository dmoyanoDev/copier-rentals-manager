'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { evaluateMachineRules } from '@/domain/machine/rules';
import { Plus, Trash2, Edit, AlertTriangle } from 'lucide-react';

export default function MachinesPage() {
    const { machines, setMachines, clients, abonos } = useManagement();
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingMachine, setEditingMachine] = useState<any>(null);

    // Form inputs
    const [brand, setBrand] = useState('');
    const [model, setModel] = useState('');
    const [serial, setSerial] = useState('');
    const [type, setType] = useState<'B&N' | 'Color'>('B&N');
    const [currentCounter, setCurrentCounter] = useState('0');
    const [lastServiceCounter, setLastServiceCounter] = useState('0');
    const [preventiveInterval, setPreventiveInterval] = useState('15000');
    const [status, setStatus] = useState<'Disponible' | 'Alquilada' | 'En Taller' | 'Alerta Técnica'>('Disponible');
    const [clientId, setClientId] = useState('');
    const [abonoId, setAbonoId] = useState('');
    const [applyIva, setApplyIva] = useState(false);

    const handleOpenForm = (machine: any = null) => {
        if (machine) {
            setEditingMachine(machine);
            setBrand(machine.brand);
            setModel(machine.model);
            setSerial(machine.serial);
            setType(machine.type || 'B&N');
            setCurrentCounter(String(machine.currentCounter || 0));
            setLastServiceCounter(String(machine.lastServiceCounter || 0));
            setPreventiveInterval(String(machine.preventiveInterval || 15000));
            setStatus(machine.status || 'Disponible');
            setClientId(machine.clientId || '');
            setAbonoId(machine.abonoId || '');
            setApplyIva(machine.applyIva || false);
        } else {
            setEditingMachine(null);
            setBrand('');
            setModel('');
            setSerial('');
            setType('B&N');
            setCurrentCounter('0');
            setLastServiceCounter('0');
            setPreventiveInterval('15000');
            setStatus('Disponible');
            setClientId('');
            setAbonoId('');
            setApplyIva(false);
        }
        setIsFormOpen(true);
    };

    const handleClientIdChange = (id: string) => {
        setClientId(id);
        if (id) {
            setStatus('Alquilada');
        } else {
            setStatus('Disponible');
        }
    };

    const handleSaveMachine = (e: React.FormEvent) => {
        e.preventDefault();
        if (!brand.trim() || !model.trim() || !serial.trim()) return;

        const counter = parseInt(currentCounter) || 0;
        const initialStatus = clientId ? 'Alquilada' : status;

        // Evaluar reglas del dominio
        const evaluated = evaluateMachineRules({
            status: initialStatus,
            machineCounter: counter,
            isAvailable: initialStatus === 'Disponible' || initialStatus === 'Alquilada'
        });

        const machineData = {
            id: editingMachine ? editingMachine.id : 'machine-' + Date.now(),
            brand,
            model,
            serial,
            type,
            currentCounter: counter,
            lastServiceCounter: parseInt(lastServiceCounter) || 0,
            preventiveInterval: parseInt(preventiveInterval) || 15000,
            status: evaluated.status as any,
            clientId: clientId || null,
            abonoId: abonoId || null,
            applyIva
        };

        if (editingMachine) {
            setMachines(prev => prev.map(m => m.id === editingMachine.id ? machineData : m));
        } else {
            setMachines(prev => [...prev, machineData]);
        }

        if (evaluated.alertMessage) {
            alert(evaluated.alertMessage);
        }

        setIsFormOpen(false);
    };

    const handleDeleteMachine = (id: string) => {
        if (confirm('¿Está seguro de que desea eliminar este equipo?')) {
            setMachines(prev => prev.filter(m => m.id !== id));
        }
    };

    const filteredMachines = machines.filter(m => 
        m.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.serial.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.brand.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative w-full max-w-sm">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por marca, modelo o serie..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <Button variant="primary" size="sm" onClick={() => handleOpenForm()}>
                    <Plus size={16} className="mr-1.5" /> Registrar Máquina
                </Button>
            </div>

            <TableContainer>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell>Equipo</TableHeaderCell>
                            <TableHeaderCell>Número de Serie</TableHeaderCell>
                            <TableHeaderCell>Tipo</TableHeaderCell>
                            <TableHeaderCell>Cliente Actual</TableHeaderCell>
                            <TableHeaderCell>Contador Actual</TableHeaderCell>
                            <TableHeaderCell>Mantenimiento Preventivo</TableHeaderCell>
                            <TableHeaderCell>Estado</TableHeaderCell>
                            <TableHeaderCell className="text-right">Acción</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredMachines.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                                    No se encontraron equipos registrados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredMachines.map(m => {
                                const client = clients.find(c => c.id === m.clientId);
                                const currentCounter = m.currentCounter || 0;
                                const lastServiceCounter = m.lastServiceCounter || 0;
                                const preventiveInterval = m.preventiveInterval || 15000;
                                const copiesSinceService = currentCounter - lastServiceCounter;
                                const isPreventiveAlert = copiesSinceService >= preventiveInterval;

                                return (
                                    <TableRow key={m.id}>
                                        <TableCell className="font-bold text-slate-100">
                                            {m.brand} {m.model}
                                        </TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-300">{m.serial}</TableCell>
                                        <TableCell className="text-xs text-slate-300">
                                            <Badge variant={m.type === 'Color' ? 'info' : 'secondary'}>{m.type}</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-semibold text-slate-300">
                                            {client ? client.name : <span className="text-slate-500 italic">Disponible</span>}
                                        </TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-300">
                                            {currentCounter.toLocaleString('es-AR')} copias
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono-tabular text-slate-400">
                                                    {copiesSinceService.toLocaleString('es-AR')} / {preventiveInterval.toLocaleString('es-AR')}
                                                </span>
                                                {isPreventiveAlert && (
                                                    <span title="Mantenimiento preventivo requerido" className="text-amber-500 animate-pulse">
                                                        <AlertTriangle size={14} />
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <Badge variant={
                                                m.status === 'Disponible' ? 'success' :
                                                m.status === 'Alquilada' ? 'secondary' :
                                                m.status === 'En Taller' ? 'warning' : 'danger'
                                            }>
                                                {m.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1.5">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenForm(m)}>
                                                <Edit size={14} className="text-slate-400 hover:text-slate-200" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteMachine(m.id)}>
                                                <Trash2 size={14} className="text-red-400 hover:text-red-200" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Modal: Formulario Máquina */}
            <Modal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                title={editingMachine ? 'Editar Máquina' : 'Registrar Máquina'}
                footer={
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsFormOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveMachine}>
                            Guardar
                        </Button>
                    </>
                }
            >
                <form className="space-y-4" onSubmit={handleSaveMachine}>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Marca *"
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            required
                            placeholder="Ej: Ricoh, Brother"
                        />
                        <Input
                            label="Modelo *"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            required
                            placeholder="Ej: IM 430f"
                        />
                    </div>
                    <Input
                        label="Número de Serie *"
                        value={serial}
                        onChange={(e) => setSerial(e.target.value)}
                        required
                        placeholder="Ej: 34293847"
                    />
                    <Select
                        label="Tipo de Equipo"
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        options={[
                            { value: 'B&N', label: 'Monocromática (Blanco y Negro)' },
                            { value: 'Color', label: 'Color' }
                        ]}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Contador de Copias"
                            type="number"
                            value={currentCounter}
                            onChange={(e) => setCurrentCounter(e.target.value)}
                        />
                        <Input
                            label="Contador Último Service"
                            type="number"
                            value={lastServiceCounter}
                            onChange={(e) => setLastServiceCounter(e.target.value)}
                        />
                    </div>
                    <Input
                        label="Intervalo de Mantenimiento Preventivo (Copias)"
                        type="number"
                        value={preventiveInterval}
                        onChange={(e) => setPreventiveInterval(e.target.value)}
                    />
                    
                    <Select
                        label="Cliente Asignado"
                        value={clientId}
                        onChange={(e) => handleClientIdChange(e.target.value)}
                        options={[
                            { value: '', label: 'Disponible / No asignada' },
                            ...clients.map(c => ({ value: c.id, label: c.name }))
                        ]}
                    />

                    {clientId && (
                        <>
                            <Select
                                label="Plan / Abono Asignado"
                                value={abonoId}
                                onChange={(e) => setAbonoId(e.target.value)}
                                options={[
                                    { value: '', label: 'Seleccionar Plan...' },
                                    ...abonos.map(a => ({ value: a.id, label: `${a.name} ($${a.price})` }))
                                ]}
                            />
                            <div className="flex items-center space-x-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="applyIva"
                                    checked={applyIva}
                                    onChange={(e) => setApplyIva(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-emerald-600 focus:ring-emerald-500"
                                />
                                <label htmlFor="applyIva" className="text-xs font-semibold text-slate-300">
                                    Aplicar IVA (21%) en la facturación mensual
                                </label>
                            </div>
                        </>
                    )}

                    {!clientId && (
                        <Select
                            label="Estado Físico del Equipo"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                            options={[
                                { value: 'Disponible', label: 'Disponible en Inventario' },
                                { value: 'En Taller', label: 'En Taller de Reparaciones' },
                                { value: 'Alerta Técnica', label: 'Alerta Técnica' },
                                { value: 'Scrap', label: 'Scrap (Descarte / Fuera de Servicio)' },
                                { value: 'No funciona', label: 'No Funciona' }
                            ]}
                        />
                    )}
                </form>
            </Modal>
        </div>
    );
}
