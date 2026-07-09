'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatCurrency, formatPeriod, getClientIvaRate } from '@/lib/utils';
import { Reading, Machine } from '@/lib/mockData';
import { Check, Clock, Search, Filter, RefreshCw, Edit, Trash2, ShieldAlert } from 'lucide-react';

export default function HistoryPage() {
    const { readings, setReadings, machines, setMachines, clients, abonos, addReadingAction, updateMachineAction } = useManagement();
    
    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPeriodState, setFilterPeriodState] = useState('');
    const [filterClient, setFilterClient] = useState('');
    const [filterPayment, setFilterPayment] = useState('');

    // Editing Reading States
    const [editingReading, setEditingReading] = useState<Reading | null>(null);
    const [editInputValue, setEditInputValue] = useState('');
    const [editValidationError, setEditValidationError] = useState('');
    const [editAnomalousWarning, setEditAnomalousWarning] = useState('');

    // Extract unique months from all readings (sorted descending)
    const uniqueMonths = Array.from(new Set(readings.map(r => r.month))).sort((a, b) => b.localeCompare(a));

    const handleTogglePaymentStatus = (id: string, currentStatus: 'pending' | 'paid') => {
        const nextStatus = currentStatus === 'paid' ? 'pending' : 'paid';
        const targetReading = readings.find(r => r.id === id);
        if (targetReading) {
            const updatedReading: Reading = {
                ...targetReading,
                status: nextStatus,
                collectionStatus: nextStatus === 'paid' ? 'Pagado' as const : 'Impago' as const
            };
            addReadingAction(updatedReading);
        }
    };

    const handleOpenEditModal = (r: Reading) => {
        setEditingReading(r);
        setEditInputValue(String(r.final));
        setEditValidationError('');
        setEditAnomalousWarning('');
    };

    const handleSaveEditReading = () => {
        if (!editingReading) return;
        const finalVal = parseInt(editInputValue, 10);
        if (isNaN(finalVal) || finalVal <= 0) {
            setEditValidationError('Ingresa un valor de contador final válido y mayor a cero.');
            return;
        }

        const initialVal = Number(editingReading.initial) || 0;
        if (finalVal < initialVal) {
            setEditValidationError(`Error: El contador final (${finalVal.toLocaleString()}) no puede ser menor al contador anterior (${initialVal.toLocaleString()}).`);
            return;
        }

        const mach = machines.find(m => m.id === editingReading.machineId);
        if (!mach) {
            setEditValidationError('No se encontró el equipo asociado a esta lectura.');
            return;
        }

        const abono = abonos.find(a => a.id === mach.abonoId);
        const consumed = finalVal - initialVal;

        // Anomaly threshold: 1.8x plan limit
        let warning = '';
        if (abono && consumed > abono.limit * 1.8) {
            warning = `Advertencia: Consumo potencialmente anómalo. Se registraron ${consumed.toLocaleString()} copias (excede el plan en un 80%+).`;
        }

        if (warning && !editAnomalousWarning) {
            setEditAnomalousWarning(warning);
            return; // Requires confirm click
        }

        // Recalculate billing values (preventing NaN)
        const client = clients.find(c => c.id === mach.clientId);
        const basePrice = abono ? Number(abono.price) || 0 : 0;
        const excessCount = abono ? Math.max(0, consumed - abono.limit) : 0;
        const excessPrice = abono ? Number(abono.excessPrice) || 0 : 0;
        const excessAmount = excessCount * excessPrice;

        const netAmount = basePrice + excessAmount;
        const ivaRate = mach.applyIva && client ? getClientIvaRate(client.taxCategory) : 0;
        const ivaAmount = netAmount * (ivaRate / 100);
        const totalAmount = netAmount + ivaAmount;

        const updatedReading: Reading = {
            ...editingReading,
            final: finalVal,
            excessCount,
            netAmount,
            ivaAmount,
            totalAmount,
            readingStatus: warning ? 'observada' : 'validada',
            readingComment: warning || undefined
        };

        // Update readings list in context using action
        const machObj = machines.find(m => m.id === mach.id);
        const machReadings = readings.filter(r => r.machineId === mach.id);
        const maxMonth = machReadings.reduce((max, r) => r.month > max ? r.month : max, '');
        const shouldUpdateCounter = editingReading.month >= maxMonth;

        addReadingAction(updatedReading, shouldUpdateCounter && machObj ? { id: mach.id, currentCounter: finalVal } : undefined);

        setEditingReading(null);
        alert('¡Lectura editada y liquidación recalculada correctamente!');
    };

    const handleDeleteReading = (id: string) => {
        if (confirm('¿Estás seguro de que deseas eliminar esta liquidación histórica?')) {
            addReadingAction({ id } as any, undefined, 'delete');
        }
    };

    // Filtered Readings List
    const filteredReadings = [...readings].filter(r => {
        const mach = machines.find(m => m.id === r.machineId);
        const client = clients.find(c => c.id === (mach ? mach.clientId : ''));
        
        const q = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
            (client && client.name.toLowerCase().includes(q)) ||
            (mach && mach.brand.toLowerCase().includes(q)) ||
            (mach && mach.model.toLowerCase().includes(q)) ||
            (mach && mach.serial.toLowerCase().includes(q));

        const matchesPeriod = !filterPeriodState || r.month === filterPeriodState;
        const matchesClient = !filterClient || (mach && mach.clientId === filterClient);
        const matchesPayment = !filterPayment || r.status === filterPayment;

        return matchesSearch && matchesPeriod && matchesClient && matchesPayment;
    }).sort((a, b) => b.month.localeCompare(a.month));

    // Summary calculations (defensive against NaN)
    const summaryTotalNet = filteredReadings.reduce((sum, r) => sum + (Number(r.netAmount) || 0), 0);
    const summaryTotalIva = filteredReadings.reduce((sum, r) => sum + (Number(r.ivaAmount) || 0), 0);
    const summaryTotalBilled = filteredReadings.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
    const summaryPaidCount = filteredReadings.filter(r => r.status === 'paid').length;
    const summaryPendingCount = filteredReadings.filter(r => r.status === 'pending').length;
    const summaryUniqueMachines = new Set(filteredReadings.map(r => r.machineId)).size;

    return (
        <div className="space-y-6 animate-fade-in relative text-slate-100">
            {/* Header */}
            <div>
                <h2 className="text-base font-semibold text-slate-100 uppercase tracking-wider">Historial de Lecturas y Liquidaciones Anteriores</h2>
                <p className="text-[10px] text-slate-400">Consulta de facturación acumulada, control de cobranza y auditoría de consumos.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-slate-950 border border-slate-850 p-4 space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase font-extrabold tracking-wider block">Total Neto Acumulado</span>
                    <span className="text-xl font-extrabold text-slate-205 font-mono-tabular">
                        {formatCurrency(summaryTotalNet)}
                    </span>
                    <span className="text-[9px] text-slate-400 block pt-1">Base imponible sin impuestos</span>
                </Card>

                <Card className="bg-slate-950 border border-slate-850 p-4 space-y-1">
                    <span className="text-[9px] text-slate-500 uppercase font-extrabold tracking-wider block">Total IVA Liquidado</span>
                    <span className="text-xl font-extrabold text-slate-205 font-mono-tabular">
                        {formatCurrency(summaryTotalIva)}
                    </span>
                    <span className="text-[9px] text-slate-400 block pt-1">Impuesto discriminado del período</span>
                </Card>

                <Card className="bg-slate-950 border border-slate-850 p-4 space-y-1">
                    <span className="text-[9px] text-slate-550 uppercase font-extrabold tracking-wider block">Total Facturado Final</span>
                    <span className="text-xl font-extrabold text-indigo-400 font-mono-tabular">
                        {formatCurrency(summaryTotalBilled)}
                    </span>
                    <span className="text-[9px] text-slate-400 block pt-1">Importe con IVA incluido</span>
                </Card>

                <Card className="bg-slate-950 border border-slate-850 p-4 space-y-2">
                    <span className="text-[9px] text-slate-500 uppercase font-extrabold tracking-wider block">Cobranza del Período</span>
                    <div className="flex justify-between text-[10px] text-slate-350 pt-1">
                        <span className="flex items-center gap-1 font-bold text-emerald-450">
                            ● Pagados: {summaryPaidCount}
                        </span>
                        <span className="flex items-center gap-1 font-bold text-red-450">
                            ● Pendientes: {summaryPendingCount}
                        </span>
                    </div>
                    <span className="text-[9px] text-slate-500 block">Equipos con lectura: {summaryUniqueMachines}</span>
                </Card>
            </div>

            {/* Filter toolbar */}
            <div className="p-4 bg-slate-950 border border-slate-850/65 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-450">
                    <div className="flex items-center gap-2">
                        <Filter size={14} /> Filtros de Auditoría
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Búsqueda */}
                    <div className="relative">
                        <span className="absolute inset-y-0 left-3 flex items-center text-slate-550">
                            <Search size={14} />
                        </span>
                        <input
                            type="text"
                            placeholder="Buscar cliente, modelo, serie..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-slate-205 text-xs focus:outline-none"
                        />
                    </div>

                    {/* Período */}
                    <select
                        value={filterPeriodState}
                        onChange={(e) => setFilterPeriodState(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-355 text-xs focus:outline-none"
                    >
                        <option value="">Período: Todos</option>
                        {uniqueMonths.map(m => (
                            <option key={m} value={m}>{formatPeriod(m)}</option>
                        ))}
                    </select>

                    {/* Cliente */}
                    <select
                        value={filterClient}
                        onChange={(e) => setFilterClient(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-355 text-xs focus:outline-none"
                    >
                        <option value="">Cliente: Todos</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    {/* Estado de Pago */}
                    <select
                        value={filterPayment}
                        onChange={(e) => setFilterPayment(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-355 text-xs focus:outline-none"
                    >
                        <option value="">Estado Pago: Todos</option>
                        <option value="paid">PAGADO</option>
                        <option value="pending">PENDIENTE</option>
                    </select>
                </div>
            </div>

            {/* List Table */}
            <TableContainer>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell>Periodo</TableHeaderCell>
                            <TableHeaderCell>Cliente</TableHeaderCell>
                            <TableHeaderCell>Equipo / Serie</TableHeaderCell>
                            <TableHeaderCell>Contador Anterior</TableHeaderCell>
                            <TableHeaderCell>Contador Final</TableHeaderCell>
                            <TableHeaderCell>Copias Excedentes</TableHeaderCell>
                            <TableHeaderCell>Monto Neto</TableHeaderCell>
                            <TableHeaderCell>IVA</TableHeaderCell>
                            <TableHeaderCell>Monto Facturado</TableHeaderCell>
                            <TableHeaderCell>Estado de Pago</TableHeaderCell>
                            <TableHeaderCell className="text-right">Acciones</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredReadings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-12 text-slate-500 text-xs italic">
                                    No se encontraron registros de liquidaciones para los filtros seleccionados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredReadings.map(r => {
                                const mach = machines.find(m => m.id === r.machineId);
                                const client = clients.find(c => c.id === (mach ? mach.clientId : ''));
                                
                                const initialVal = Number(r.initial) || 0;
                                const finalVal = Number(r.final) || 0;
                                const excessVal = Number(r.excessCount) || 0;
                                const netVal = Number(r.netAmount) || 0;
                                const ivaVal = Number(r.ivaAmount) || 0;
                                const totalVal = Number(r.totalAmount) || 0;

                                return (
                                    <TableRow key={r.id} className="hover:bg-slate-900/40">
                                        <TableCell className="font-bold text-slate-100">{formatPeriod(r.month)}</TableCell>
                                        <TableCell className="font-semibold text-slate-200">{client ? client.name : 'N/A'}</TableCell>
                                        <TableCell className="text-xs text-slate-350">
                                            {mach ? `${mach.brand} ${mach.model}` : 'N/A'}
                                            {mach && <span className="block text-[10px] text-slate-500">Serie: {mach.serial}</span>}
                                        </TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-300">{initialVal.toLocaleString('es-AR')}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-300">{finalVal.toLocaleString('es-AR')}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-amber-500 font-semibold">{excessVal.toLocaleString('es-AR')}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-300">{formatCurrency(netVal)}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-400">{formatCurrency(ivaVal)}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs font-bold text-slate-200">{formatCurrency(totalVal)}</TableCell>
                                        <TableCell className="text-xs">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                                r.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                            }`}>
                                                {r.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    onClick={() => handleTogglePaymentStatus(r.id, r.status)}
                                                >
                                                    {r.status === 'paid' ? (
                                                        <span className="flex items-center text-[10px] font-bold text-red-400"><Clock size={11} className="mr-1" /> Impagar</span>
                                                    ) : (
                                                        <span className="flex items-center text-[10px] font-bold text-emerald-450"><Check size={11} className="mr-1" /> Cobrar</span>
                                                    )}
                                                </Button>
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    onClick={() => handleOpenEditModal(r)}
                                                >
                                                    <Edit size={11} className="mr-1 text-indigo-400" /> Editar
                                                </Button>
                                                <button 
                                                    onClick={() => handleDeleteReading(r.id)}
                                                    className="px-2 py-1 bg-red-955/20 text-red-400 border border-red-900/30 rounded-xl text-[10px] font-bold hover:bg-red-900/20 transition-all flex items-center"
                                                >
                                                    <Trash2 size={11} />
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

            {/* EDIT HISTORICAL READING DIALOG MODAL */}
            {editingReading && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md border-slate-800 bg-slate-900">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-100">Modificar Lectura Histórica</h3>
                            <button className="text-slate-400 hover:text-slate-200" onClick={() => setEditingReading(null)}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <CardContent className="p-5 space-y-4">
                            <div className="text-xs bg-slate-955/40 p-4 rounded-xl border border-slate-850/60 space-y-1.5">
                                <div>
                                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Periodo</span>
                                    <span className="font-bold text-slate-200">{formatPeriod(editingReading.month)}</span>
                                </div>
                                <div className="pt-1.5 border-t border-slate-800/50">
                                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Equipo</span>
                                    <span className="font-bold text-slate-200">
                                        {machines.find(m => m.id === editingReading.machineId)?.brand} {machines.find(m => m.id === editingReading.machineId)?.model}
                                    </span>
                                    <span className="text-slate-400 text-[10px] block mt-0.5">S/N: {machines.find(m => m.id === editingReading.machineId)?.serial}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="text-xs bg-indigo-950/20 p-3 rounded-xl border border-indigo-900/30">
                                    <span className="text-slate-400 block">Contador Anterior</span>
                                    <span className="font-bold text-slate-205 font-mono-tabular mt-1 block">
                                        {(Number(editingReading.initial) || 0).toLocaleString('es-AR')} copias
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500 block">Contador Final</label>
                                    <input
                                        type="number"
                                        value={editInputValue}
                                        onChange={(e) => setEditInputValue(e.target.value)}
                                        placeholder="Ej: 24500"
                                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {editValidationError && (
                                <p className="text-red-500 text-[10px] font-bold mt-1 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                                    {editValidationError}
                                </p>
                            )}

                            {editAnomalousWarning && (
                                <div className="text-amber-400 text-[10px] font-semibold mt-1 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 space-y-1">
                                    <p className="flex items-center gap-1"><ShieldAlert size={14} /> {editAnomalousWarning}</p>
                                    <p className="font-bold pt-1">¿Deseas confirmar la modificación a pesar de la alerta de consumo?</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" size="md" className="flex-1" onClick={() => setEditingReading(null)}>
                                    Cancelar
                                </Button>
                                <Button variant="primary" size="md" className="flex-1" onClick={handleSaveEditReading}>
                                    {editAnomalousWarning ? 'Confirmar' : 'Guardar y Recalcular'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
