'use client';

import React, { useState } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatPeriod, getClientIvaRate } from '@/lib/utils';
import { Reading, Machine } from '@/lib/mockData';

export default function ReadingsPage() {
    const { clients, machines, setMachines, readings, setReadings, abonos, currentMonth } = useManagement();
    
    // Modal or Panel states for logging new reading
    const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [validationError, setValidationError] = useState('');
    const [anomalousWarning, setAnomalousWarning] = useState('');
    const [invoiceDetail, setInvoiceDetail] = useState<Reading | null>(null);

    const rentedMachines = machines.filter(m => m.clientId !== null);

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

        const initialVal = selectedMachine.currentCounter;
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
            return; // Let user review warning and click save again
        }

        // Save
        const client = clients.find(c => c.id === selectedMachine.clientId);
        const basePrice = abono ? abono.price : 0;
        const excessCount = abono ? Math.max(0, consumed - abono.limit) : 0;
        const excessPrice = abono ? abono.excessPrice : 0;
        const excessAmount = excessCount * excessPrice;

        const netAmount = basePrice + excessAmount;
        const ivaRate = selectedMachine.applyIva && client ? getClientIvaRate(client.taxCategory) : 0;
        const ivaAmount = netAmount * (ivaRate / 100);
        const totalAmount = netAmount + ivaAmount;

        const newReading: Reading = {
            id: `r-${Date.now()}`,
            machineId: selectedMachine.id,
            month: currentMonth,
            initial: initialVal,
            final: finalVal,
            excessCount,
            excessPrice,
            netAmount,
            ivaAmount,
            totalAmount,
            status: 'pending',
            readingStatus: warning ? 'observada' : 'validada',
            readingComment: warning || undefined
        };

        // Update readings in context
        setReadings(prev => {
            const filtered = prev.filter(r => !(r.machineId === selectedMachine.id && r.month === currentMonth));
            return [...filtered, newReading];
        });

        // Update machine current counter
        setMachines(prev => prev.map(m => m.id === selectedMachine.id ? { ...m, currentCounter: finalVal } : m));

        // Close modal
        setSelectedMachine(null);
    };

    const handlePrintInvoice = () => {
        window.print();
    };

    return (
        <div className="space-y-6 animate-fade-in relative">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                
                {/* Left Area: Readings Board */}
                <div className={invoiceDetail ? "xl:col-span-2 space-y-4" : "xl:col-span-3 space-y-4"}>
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
                                {rentedMachines.map(m => {
                                    const client = clients.find(c => c.id === m.clientId);
                                    const reading = readings.find(r => r.machineId === m.id && r.month === currentMonth);
                                    
                                    return (
                                        <TableRow key={m.id} className={invoiceDetail?.machineId === m.id ? "bg-indigo-950/20" : ""}>
                                            <TableCell className="font-bold text-slate-100">{client ? client.name : 'Desconocido'}</TableCell>
                                            <TableCell className="text-xs text-slate-300">
                                                <strong>{m.brand} {m.model}</strong>
                                                <span className="block text-slate-400 text-[10px]">{m.serial}</span>
                                            </TableCell>
                                            <TableCell className="font-mono-tabular text-xs text-slate-300">{(reading ? reading.initial : m.currentCounter).toLocaleString()}</TableCell>
                                            <TableCell className="font-mono-tabular text-xs text-slate-300">
                                                {reading ? reading.final.toLocaleString() : '-'}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {reading ? (
                                                    <span className={reading.excessCount > 0 ? "text-amber-500 font-bold" : "text-slate-400"}>
                                                        {(reading.final - reading.initial).toLocaleString()} copias
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell className="font-mono-tabular text-xs font-bold text-slate-200">
                                                {reading ? formatCurrency(reading.totalAmount) : '-'}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {reading ? (
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                                        reading.readingStatus === 'observada' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                                                    }`}>
                                                        {reading.readingStatus.toUpperCase()}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-500">
                                                        PENDIENTE
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {reading ? (
                                                        <Button variant="secondary" size="sm" onClick={() => setInvoiceDetail(reading)}>
                                                            Factura
                                                        </Button>
                                                    ) : (
                                                        <Button variant="primary" size="sm" onClick={() => handleOpenLogModal(m)}>
                                                            Cargar
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </div>

                {/* Invoice Details Drawer */}
                {invoiceDetail && (
                    <div className="xl:col-span-1 print:fixed print:inset-0 print:bg-white print:z-50 print:p-8">
                        <Card className="sticky top-24 border-emerald-600/30 shadow-lg animate-fade-in print:border-none print:shadow-none">
                            <div className="p-4 bg-slate-900 text-white flex items-center justify-between rounded-t-2xl print:hidden">
                                <div>
                                    <h3 className="font-bold text-sm">Detalle de Liquidación</h3>
                                    <span className="text-[10px] text-slate-400">Periodo: {formatPeriod(currentMonth)}</span>
                                </div>
                                <button className="text-slate-400 hover:text-white" onClick={() => setInvoiceDetail(null)}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            
                            {/* Printable invoice layout */}
                            <CardContent className="p-5 space-y-4 text-xs text-slate-300 print:text-black">
                                <div className="hidden print:block border-b pb-4 mb-4">
                                    <div className="flex items-center gap-3 justify-center">
                                        <img src="/logo.png" alt="Logo M&S" className="h-10 w-auto object-contain" />
                                        <div className="text-left">
                                            <h1 className="text-base font-bold">M&S Tecnología Digital</h1>
                                            <p className="text-[10px] text-slate-500">Liquidación de Alquiler</p>
                                            <p className="text-[10px] text-slate-400">Periodo: {formatPeriod(currentMonth)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Cliente</span>
                                    <span className="font-bold text-slate-200 print:text-black">
                                        {clients.find(c => c.id === machines.find(m => m.id === invoiceDetail.machineId)?.clientId)?.name}
                                    </span>
                                </div>

                                <div className="border-t border-slate-800 print:border-slate-300 pt-3 grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Abono Neto</span>
                                        <span className="font-semibold text-slate-300 print:text-black font-mono-tabular">
                                            {formatCurrency(invoiceDetail.netAmount - (invoiceDetail.excessCount * invoiceDetail.excessPrice))}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] uppercase font-bold text-slate-500 block">Excedentes Neto</span>
                                        <span className="font-semibold text-slate-300 print:text-black font-mono-tabular">
                                            {formatCurrency(invoiceDetail.excessCount * invoiceDetail.excessPrice)}
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-slate-800 print:border-slate-300 pt-3 flex justify-between">
                                    <span className="text-[9px] uppercase font-bold text-slate-500">IVA Discriminado:</span>
                                    <span className="font-mono-tabular font-semibold text-slate-300 print:text-black">
                                        {formatCurrency(invoiceDetail.ivaAmount)}
                                    </span>
                                </div>

                                <div className="border-t-2 border-dashed border-slate-800 print:border-slate-300 pt-3 flex justify-between text-sm">
                                    <span className="font-bold uppercase text-slate-500">Monto Total:</span>
                                    <span className="font-extrabold text-indigo-400 print:text-black font-mono-tabular">
                                        {formatCurrency(invoiceDetail.totalAmount)}
                                    </span>
                                </div>

                                <div className="pt-2 print:hidden">
                                    <Button variant="success" size="sm" className="w-full" onClick={handlePrintInvoice}>
                                        🖨️ Imprimir Recibo / Factura
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Log Reading Modal Dialog */}
            {selectedMachine && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md border-slate-800">
                        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-slate-100">Registrar Lectura de Contador</h3>
                            <button className="text-slate-400 hover:text-slate-200" onClick={() => setSelectedMachine(null)}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <CardContent className="p-5 space-y-4">
                            <div className="text-xs space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-500 block">Equipo</span>
                                <span className="font-bold text-slate-200">{selectedMachine.brand} {selectedMachine.model}</span>
                                <span className="text-slate-400 text-[10px] block">Serie: {selectedMachine.serial}</span>
                            </div>

                            <div className="text-xs bg-indigo-950/20 p-3 rounded-xl border border-indigo-900/30 flex justify-between">
                                <span className="text-slate-400 font-semibold">Contador Anterior:</span>
                                <span className="font-bold text-slate-200 font-mono-tabular">{selectedMachine.currentCounter.toLocaleString()} copias</span>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500 block">Nuevo Contador Final</label>
                                <input
                                    type="number"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Ej: 14500"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {validationError && (
                                <p className="text-red-500 text-[10px] font-bold mt-1 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">{validationError}</p>
                            )}

                            {anomalousWarning && (
                                <div className="text-amber-400 text-[10px] font-semibold mt-1 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                                    <p>{anomalousWarning}</p>
                                    <p className="font-bold mt-1">¿Deseas confirmar la lectura a pesar de la alerta de consumo?</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <Button variant="secondary" size="md" className="flex-1" onClick={() => setSelectedMachine(null)}>
                                    Cancelar
                                </Button>
                                <Button variant="primary" size="md" className="flex-1" onClick={handleSaveReading}>
                                    {anomalousWarning ? 'Confirmar' : 'Guardar Lectura'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
