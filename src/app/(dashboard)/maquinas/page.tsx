'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { evaluateMachineRules } from '@/domain/machine/rules';
import { Plus, Trash2, Edit, AlertTriangle, FileText, Wrench, ShieldAlert, Sparkles } from 'lucide-react';
import { Machine } from '@/lib/mockData';
import { formatCurrency, formatPeriod } from '@/lib/utils';

export default function MachinesPage() {
    const { machines, setMachines, clients, abonos, readings, setReadings, rentals } = useManagement();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    
    // Modal states
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
    const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
    const [detailTab, setDetailTab] = useState<'info' | 'readings' | 'rentals'>('info');

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
    const [formError, setFormError] = useState('');

    const handleOpenForm = (machine: Machine | null = null) => {
        setFormError('');
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
        setFormError('');

        if (!brand.trim() || !model.trim() || !serial.trim()) {
            setFormError('La marca, modelo y número de serie son obligatorios.');
            return;
        }

        // Serial Duplicate Check
        const cleanSerial = serial.trim().toLowerCase();
        const duplicate = machines.find(m => 
            m.serial.trim().toLowerCase() === cleanSerial && 
            (!editingMachine || m.id !== editingMachine.id)
        );

        if (duplicate) {
            setFormError(`El número de serie ${serial} ya pertenece al equipo "${duplicate.brand} ${duplicate.model}".`);
            return;
        }

        const counter = parseInt(currentCounter, 10) || 0;
        const initialStatus = clientId ? 'Alquilada' : status;

        // Domain rule verification
        const evaluated = evaluateMachineRules({
            status: initialStatus,
            machineCounter: counter,
            isAvailable: initialStatus === 'Disponible' || initialStatus === 'Alquilada'
        });

        const machineData: Machine = {
            id: editingMachine ? editingMachine.id : 'machine-' + Date.now(),
            brand,
            model,
            serial,
            type,
            currentCounter: counter,
            lastServiceCounter: parseInt(lastServiceCounter, 10) || 0,
            preventiveInterval: parseInt(preventiveInterval, 10) || 15000,
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
        const hasHistory = readings.some(r => r.machineId === id);
        if (hasHistory) {
            if (confirm('El equipo posee registros de lecturas históricas. ¿Desea realizar una desactivación física (baja lógica) y mantener su historial técnico?')) {
                setMachines(prev => prev.map(m => m.id === id ? { ...m, status: 'Inactiva' as any, clientId: null, abonoId: null } : m));
            }
            return;
        }

        if (confirm('¿Está seguro de que desea eliminar este equipo del sistema?')) {
            setMachines(prev => prev.filter(m => m.id !== id));
        }
    };

    const handleRegisterMaintenance = (id: string, count: number) => {
        if (confirm(`¿Confirmas el registro de mantenimiento preventivo? Se actualizará el contador de referencia a ${count.toLocaleString('es-AR')} copias.`)) {
            setMachines(prev => prev.map(m => m.id === id ? { ...m, lastServiceCounter: count } : m));
            // Update selected view state if open
            if (selectedMachine && selectedMachine.id === id) {
                setSelectedMachine(prev => prev ? { ...prev, lastServiceCounter: count } : null);
            }
            alert('Mantenimiento preventivo registrado con éxito. Alerta técnica restablecida.');
        }
    };

    const handleOpenDetail = (machine: Machine) => {
        setSelectedMachine(machine);
        setDetailTab('info');
        setIsDetailOpen(true);
    };

    const filteredMachines = machines.filter(m => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = m.model.toLowerCase().includes(q) ||
            m.serial.toLowerCase().includes(q) ||
            m.brand.toLowerCase().includes(q);

        const matchesStatus = !filterStatus || m.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-fade-in text-slate-100 pb-12">
            
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-1 gap-3 max-w-lg">
                    {/* Búsqueda */}
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por marca, modelo, número de serie..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:ring-1 focus:ring-indigo-500"
                    />

                    {/* Status filter */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 text-xs focus:outline-none"
                    >
                        <option value="">Estado: Todos</option>
                        <option value="Disponible">Disponible</option>
                        <option value="Alquilada">Alquilada</option>
                        <option value="En Taller">En Taller</option>
                        <option value="Alerta Técnica">Alerta Técnica</option>
                        <option value="Inactiva">Inactiva</option>
                    </select>
                </div>
                <Button variant="primary" size="sm" onClick={() => handleOpenForm()}>
                    <Plus size={16} className="mr-1.5" /> Registrar Máquina
                </Button>
            </div>

            {/* List Table */}
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
                            <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredMachines.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10 text-slate-500 text-xs italic">
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
                                    <TableRow key={m.id} className="hover:bg-slate-900/40">
                                        <TableCell className="font-bold text-slate-100">
                                            {m.brand} {m.model}
                                        </TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-350">{m.serial}</TableCell>
                                        <TableCell className="text-xs">
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
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button 
                                                    title="Historial y Ficha del Equipo"
                                                    onClick={() => handleOpenDetail(m)}
                                                    className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                >
                                                    <FileText size={13} className="text-indigo-400" />
                                                </button>
                                                <button 
                                                    title="Editar Equipo"
                                                    onClick={() => handleOpenForm(m)}
                                                    className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-850 transition-colors"
                                                >
                                                    <Edit size={13} className="text-slate-400" />
                                                </button>
                                                <button 
                                                    title="Eliminar / Baja"
                                                    onClick={() => handleDeleteMachine(m.id)}
                                                    className="p-1.5 bg-red-955/20 border border-red-900/30 rounded-lg hover:bg-red-900/20 transition-colors"
                                                >
                                                    <Trash2 size={13} className="text-red-400" />
                                                </button>
                                            </div>
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
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsFormOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSaveMachine}>
                            Guardar Cambios
                        </Button>
                    </div>
                }
            >
                <form className="space-y-4 animate-fade-in" onSubmit={handleSaveMachine}>
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
                            { value: '', label: 'Disponible / No alquilada' },
                            ...clients.filter(c => c.active !== false).map(c => ({ value: c.id, label: c.name }))
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
                                    ...abonos.filter(a => a.active !== false).map(a => ({ value: a.id, label: `${a.name} ($${a.price})` }))
                                ]}
                            />
                            <div className="flex items-center space-x-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="applyIva"
                                    checked={applyIva}
                                    onChange={(e) => setApplyIva(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-emerald-600 focus:ring-emerald-500"
                                />
                                <label htmlFor="applyIva" className="text-xs font-semibold text-slate-350">
                                    Aplicar IVA (21%) en la liquidación mensual
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
                                { value: 'Inactiva', label: 'Inactiva / Scrap' }
                            ]}
                        />
                    )}

                    {formError && (
                        <p className="text-red-500 text-[10px] font-bold mt-1 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">{formError}</p>
                    )}
                </form>
            </Modal>

            {/* Modal: Ficha Detallada del Equipo */}
            <Modal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                title="Historial y Ficha del Equipo"
                footer={
                    <div className="flex justify-between w-full">
                        {selectedMachine && (selectedMachine.currentCounter || 0) > (selectedMachine.lastServiceCounter || 0) ? (
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={() => handleRegisterMaintenance(selectedMachine.id, selectedMachine.currentCounter)}
                            >
                                <Wrench size={13} className="mr-1 text-amber-500" /> Registrar Service
                            </Button>
                        ) : <span></span>}
                        <Button variant="secondary" size="sm" onClick={() => setIsDetailOpen(false)}>
                            Cerrar Ficha
                        </Button>
                    </div>
                }
            >
                {selectedMachine && (
                    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
                        {/* Ficha Header */}
                        <div className="border-b border-slate-850 pb-4 flex justify-between items-center">
                            <div>
                                <h4 className="text-base font-extrabold text-slate-100">{selectedMachine.brand} {selectedMachine.model}</h4>
                                <span className="text-xs text-slate-400 block mt-1">S/N: {selectedMachine.serial} | Categoría: {selectedMachine.type}</span>
                            </div>
                            <Badge variant={
                                selectedMachine.status === 'Disponible' ? 'success' :
                                selectedMachine.status === 'Alquilada' ? 'secondary' :
                                selectedMachine.status === 'En Taller' ? 'warning' : 'danger'
                            }>
                                {selectedMachine.status}
                            </Badge>
                        </div>

                        {/* Nav tabs */}
                        <div className="flex gap-2 border-b border-slate-800 pb-1 pt-2">
                            <button
                                onClick={() => setDetailTab('info')}
                                className={`px-3 py-1 text-xs font-semibold rounded-t-lg transition-all ${
                                    detailTab === 'info' 
                                        ? 'border-b-2 border-indigo-500 text-indigo-400 font-bold' 
                                        : 'text-slate-500'
                                }`}
                            >
                                Contrato y Estado Técnico
                            </button>
                            <button
                                onClick={() => setDetailTab('readings')}
                                className={`px-3 py-1 text-xs font-semibold rounded-t-lg transition-all ${
                                    detailTab === 'readings' 
                                        ? 'border-b-2 border-indigo-500 text-indigo-400 font-bold' 
                                        : 'text-slate-500'
                                }`}
                            >
                                Lecturas Registradas
                            </button>
                            <button
                                onClick={() => setDetailTab('rentals')}
                                className={`px-3 py-1 text-xs font-semibold rounded-t-lg transition-all ${
                                    detailTab === 'rentals' 
                                        ? 'border-b-2 border-indigo-500 text-indigo-400 font-bold' 
                                        : 'text-slate-500'
                                }`}
                            >
                                Historial Contratos
                            </button>
                        </div>

                        {/* TAB 1: CONTRATO Y ESTADO */}
                        {detailTab === 'info' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                                        <span className="text-slate-500 font-bold block uppercase text-[9px] tracking-wider">Cliente Asignado</span>
                                        {selectedMachine.clientId ? (
                                            <span className="text-slate-205 font-bold block mt-1">
                                                {clients.find(c => c.id === selectedMachine.clientId)?.name}
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 italic block mt-1">Equipo disponible en Stock</span>
                                        )}
                                    </div>
                                    <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                                        <span className="text-slate-500 font-bold block uppercase text-[9px] tracking-wider">Plan Vigente</span>
                                        {selectedMachine.abonoId ? (
                                            <span className="text-slate-205 font-bold block mt-1">
                                                {abonos.find(a => a.id === selectedMachine.abonoId)?.name}
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 italic block mt-1">Sin plan asociado</span>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-955 rounded-xl border border-slate-850 text-xs space-y-2">
                                    <span className="text-slate-550 font-bold block text-[9px] uppercase tracking-wider">Mantenimiento Preventivo</span>
                                    <div className="flex justify-between items-center text-slate-300">
                                        <span>Contador Actual:</span>
                                        <span className="font-bold font-mono-tabular">{(selectedMachine.currentCounter || 0).toLocaleString()} copias</span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-350">
                                        <span>Último Service:</span>
                                        <span className="font-mono-tabular">{(selectedMachine.lastServiceCounter || 0).toLocaleString()} copias</span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-350">
                                        <span>Intervalo Recomendado:</span>
                                        <span className="font-mono-tabular">{(selectedMachine.preventiveInterval || 15000).toLocaleString()} copias</span>
                                    </div>
                                    
                                    <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center">
                                        <span className="text-slate-450 font-semibold">Copias desde service:</span>
                                        <span className={`font-bold font-mono-tabular ${
                                            ((selectedMachine.currentCounter || 0) - (selectedMachine.lastServiceCounter || 0)) >= (selectedMachine.preventiveInterval || 15000)
                                                ? 'text-amber-500 animate-pulse' : 'text-emerald-450'
                                        }`}>
                                            {((selectedMachine.currentCounter || 0) - (selectedMachine.lastServiceCounter || 0)).toLocaleString()} copias
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: LECTURAS REGISTRADAS */}
                        {detailTab === 'readings' && (
                            <div className="space-y-2">
                                {readings.filter(r => r.machineId === selectedMachine.id).length === 0 ? (
                                    <p className="text-xs text-slate-500 italic py-4">No se han registrado lecturas en esta máquina.</p>
                                ) : (
                                    readings.filter(r => r.machineId === selectedMachine.id).sort((a,b) => b.month.localeCompare(a.month)).map(r => (
                                        <div key={r.id} className="p-3 bg-slate-955 border border-slate-850 rounded-xl text-xs flex justify-between items-center">
                                            <div>
                                                <span className="font-bold text-slate-200 block">{formatPeriod(r.month)}</span>
                                                <span className="text-[10px] text-slate-500 block">Lectura: {r.initial.toLocaleString()} a {r.final.toLocaleString()}</span>
                                                {r.excessCount > 0 && <span className="text-[9px] text-amber-500 font-medium block">Copias Excedentes: {r.excessCount.toLocaleString()}</span>}
                                            </div>
                                            <div className="text-right space-y-0.5">
                                                <span className="font-extrabold text-slate-205 block font-mono-tabular">{formatCurrency(r.totalAmount)}</span>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                                    r.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                                }`}>
                                                    {r.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* TAB 3: HISTORIAL CONTRATOS */}
                        {detailTab === 'rentals' && (
                            <div className="space-y-2">
                                {rentals.filter(r => r.machineId === selectedMachine.id).length === 0 ? (
                                    <p className="text-xs text-slate-500 italic py-4">Este equipo no registra contratos de alquiler.</p>
                                ) : (
                                    rentals.filter(r => r.machineId === selectedMachine.id).map(r => {
                                        const cl = clients.find(c => c.id === r.clientId);
                                        const ab = abonos.find(a => a.id === r.abonoId);
                                        return (
                                            <div key={r.id} className="p-3 bg-slate-955 border border-slate-850 rounded-xl text-xs flex justify-between items-center">
                                                <div>
                                                    <span className="font-bold text-slate-205 block">{cl ? cl.name : 'Cliente Desconocido'}</span>
                                                    <span className="text-[10px] text-slate-500 block">
                                                        Inicio: {r.startDate} {r.endDate ? `| Fin: ${r.endDate}` : ''}
                                                    </span>
                                                    <span className="text-[10px] text-indigo-400 font-medium mt-1 block">Plan: {ab ? ab.name : 'Abono N/A'}</span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                                    r.status === 'activo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-800'
                                                }`}>
                                                    {r.status}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
}
