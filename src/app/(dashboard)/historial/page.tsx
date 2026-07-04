'use client';

import React from 'react';
import { useManagement } from '@/lib/context';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import { Check, Clock } from 'lucide-react';

export default function HistoryPage() {
    const { readings, setReadings, machines, clients } = useManagement();
    
    // Sort readings by period descending
    const historicalReadings = [...readings].sort((a, b) => b.month.localeCompare(a.month));

    const handleTogglePaymentStatus = (id: string, currentStatus: 'pending' | 'paid') => {
        const nextStatus = currentStatus === 'paid' ? 'pending' : 'paid';
        setReadings(prev => prev.map(r => r.id === id ? { ...r, status: nextStatus } : r));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold text-slate-100">Historial de Lecturas y Liquidaciones Anteriores</h2>
            </div>

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
                            <TableHeaderCell className="text-right">Acción</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {historicalReadings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={11} className="text-center py-8 text-slate-400 text-xs">
                                    No hay registros de historial de lecturas.
                                </TableCell>
                            </TableRow>
                        ) : (
                            historicalReadings.map(r => {
                                const mach = machines.find(m => m.id === r.machineId);
                                const client = clients.find(c => c.id === (mach ? mach.clientId : ''));
                                
                                return (
                                    <TableRow key={r.id}>
                                        <TableCell className="font-bold text-slate-100">{formatPeriod(r.month)}</TableCell>
                                        <TableCell className="font-semibold text-slate-200">{client ? client.name : 'N/A'}</TableCell>
                                        <TableCell className="text-xs text-slate-350">
                                            {mach ? `${mach.brand} ${mach.model}` : 'N/A'}
                                            {mach && <span className="block text-[10px] text-slate-500">Serie: {mach.serial}</span>}
                                        </TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-300">{r.initial.toLocaleString('es-AR')}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-300">{r.final.toLocaleString('es-AR')}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-amber-500 font-semibold">{r.excessCount.toLocaleString('es-AR')}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-300">{formatCurrency(r.netAmount)}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs text-slate-400">{formatCurrency(r.ivaAmount)}</TableCell>
                                        <TableCell className="font-mono-tabular text-xs font-bold text-slate-200">{formatCurrency(r.totalAmount)}</TableCell>
                                        <TableCell className="text-xs">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                                r.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                            }`}>
                                                {r.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                variant="secondary" 
                                                size="sm" 
                                                onClick={() => handleTogglePaymentStatus(r.id, r.status)}
                                            >
                                                {r.status === 'paid' ? (
                                                    <span className="flex items-center text-xs text-red-400"><Clock size={12} className="mr-1" /> Impagar</span>
                                                ) : (
                                                    <span className="flex items-center text-xs text-emerald-400"><Check size={12} className="mr-1" /> Cobrar</span>
                                                )}
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
    );
}
