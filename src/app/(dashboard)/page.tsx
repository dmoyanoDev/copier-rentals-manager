'use client';

import React from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatPeriod, isTicketOverdue } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardPage() {
    const { clients, machines, readings, tickets, currentUser, users, currentMonth } = useManagement();

    const isTech = currentUser?.role === 'tecnico';

    // ==========================================
    // 1. ADMINISTRATIVE DASHBOARD LOGIC
    // ==========================================
    const activeClientsCount = clients.length;
    const rentedMachinesCount = machines.filter(m => m.clientId !== null).length;

    // Projected Base Fee
    let projectedBase = 0;
    machines.filter(m => m.clientId !== null).forEach(m => {
        const client = clients.find(c => c.id === m.clientId);
        const abono = mockAbonosFind(m.abonoId);
        if (abono) {
            const ivaRate = m.applyIva && client ? (client.taxCategory === 'Responsable Inscripto' ? 21 : 0) : 0;
            projectedBase += abono.price * (1 + ivaRate / 100);
        }
    });

    // Total Invoiced and Excess
    let totalInvoicedMonth = 0;
    let totalExcessInvoiced = 0;
    const currentMonthReadings = readings.filter(r => r.month === currentMonth);
    currentMonthReadings.forEach(r => {
        totalInvoicedMonth += r.totalAmount;
        const abono = abonos.find(a => a.id === machines.find(m => m.id === r.machineId)?.abonoId);
        const consumed = r.final - r.initial;
        if (abono && consumed > abono.limit) {
            const excess = (consumed - abono.limit) * abono.excessPrice;
            totalExcessInvoiced += excess * (r.ivaAmount > 0 ? 1.21 : 1);
        }
    });

    // Total Revenue this month (base + excess)
    const totalRevenueMonth = projectedBase + totalExcessInvoiced;

    // Active tickets
    const activeTickets = tickets.filter(t => t.status !== 'resuelto' && t.status !== 'cerrado');

    // Readings progress
    const readingsFilledCount = currentMonthReadings.length;
    const readingsProgressPct = rentedMachinesCount > 0 ? Math.round((readingsFilledCount / rentedMachinesCount) * 100) : 0;

    // Collections
    const collectedAmt = readings.filter(r => r.month === currentMonth && r.status === 'paid').reduce((acc, r) => acc + r.totalAmount, 0);
    const pendingAmt = readings.filter(r => r.month === currentMonth && r.status === 'pending').reduce((acc, r) => acc + r.totalAmount, 0);

    // ==========================================
    // 2. TECHNICAL DASHBOARD LOGIC
    // ==========================================
    const myActiveTickets = tickets.filter(t => t.assignedTechId === currentUser?.id && t.status !== 'resuelto' && t.status !== 'cerrado');
    const urgentTickets = tickets.filter(t => t.priority === 'alta' && t.status !== 'resuelto' && t.status !== 'cerrado');
    
    // Readings to validate
    const readingsToValidate = readings.filter(r => r.month === currentMonth && (r.readingStatus === 'observada' || r.readingStatus === 'cargada'));

    // Critical machines (multiple incident tickets in the last 60 days)
    const criticalMachinesMap: { [machineId: string]: { machine: any; count: number } } = {};
    const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
    tickets.forEach(t => {
        if (t.machineId && t.createdAt && t.createdAt >= sixtyDaysAgo) {
            const mach = machines.find(m => m.id === t.machineId);
            if (mach) {
                if (!criticalMachinesMap[t.machineId]) {
                    criticalMachinesMap[t.machineId] = { machine: mach, count: 0 };
                }
                criticalMachinesMap[t.machineId].count++;
            }
        }
    });
    const criticalMachinesList = Object.values(criticalMachinesMap).filter(item => item.count > 1);

    // Helper functions
    function mockAbonosFind(abonoId: string | null) {
        return abonos.find(a => a.id === abonoId);
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {isTech ? (
                // ==========================================
                // TECH DASHBOARD VIEW
                // ==========================================
                <div className="space-y-6">
                    {/* Tech KPI Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-l-4 border-l-red-500 bg-slate-900/40">
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pedidos Críticos / Urgentes</span>
                                    <span className="block text-2xl font-extrabold text-red-500 mt-1">{urgentTickets.length}</span>
                                    <span className="text-[10px] text-slate-500 mt-1 block">Requieren atención inmediata</span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-indigo-500 bg-slate-900/40">
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mis Pedidos Asignados</span>
                                    <span className="block text-2xl font-extrabold text-indigo-400 mt-1">{myActiveTickets.length}</span>
                                    <span className="text-[10px] text-slate-500 mt-1 block">Asignados a mí</span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-amber-500 bg-slate-900/40">
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Lecturas por Validar</span>
                                    <span className="block text-2xl font-extrabold text-amber-500 mt-1">{readingsToValidate.length}</span>
                                    <span className="text-[10px] text-slate-500 mt-1 block">Observadas o pendientes</span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-purple-500 bg-slate-900/40">
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Equipos Reincidentes</span>
                                    <span className="block text-2xl font-extrabold text-purple-400 mt-1">{criticalMachinesList.length}</span>
                                    <span className="text-[10px] text-slate-500 mt-1 block">Múltiples fallas recientes</span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tech Tables Workspace */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Mis Visitas */}
                        <div className="lg:col-span-2 space-y-6">
                            <Card>
                                <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">Mis Visitas y Pedidos de Soporte Asignados</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm divide-y divide-slate-100 dark:divide-slate-800">
                                        <thead className="bg-slate-50 dark:bg-slate-800/40 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-5 py-3">Prioridad</th>
                                                <th className="px-5 py-3">Cliente</th>
                                                <th className="px-5 py-3">Equipo (Serie)</th>
                                                <th className="px-5 py-3">Problema / Tarea</th>
                                                <th className="px-5 py-3">SLA</th>
                                                <th className="px-5 py-3 text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {myActiveTickets.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">Sin visitas asignadas. ¡Buen trabajo!</td>
                                                </tr>
                                            ) : (
                                                myActiveTickets.map(t => (
                                                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                                                        <td className="px-5 py-4">
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${t.priority === 'alta' ? 'bg-red-500/10 text-red-500' : 'bg-slate-500/10 text-slate-400'}`}>{t.priority.toUpperCase()}</span>
                                                        </td>
                                                        <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-200">{t.clientName}</td>
                                                        <td className="px-5 py-4 text-xs text-slate-500">{t.machineDesc} ({t.serialNumber})</td>
                                                        <td className="px-5 py-4 text-xs font-semibold">{t.category}</td>
                                                        <td className="px-5 py-4 text-xs font-mono-tabular">{t.slaDate ? t.slaDate.split('T')[0].split('-').reverse().join('/') : 'Sin definir'}</td>
                                                        <td className="px-5 py-4 text-right">
                                                            <Link href="/tecnica">
                                                                <Button variant="primary" size="sm">Atender</Button>
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>

                            {/* Alertas de Lectura de Equipos */}
                            <Card>
                                <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">Alertas de Lecturas y Contadores ({formatPeriod(currentMonth)})</h2>
                                </div>
                                <div className="p-5 space-y-3">
                                    {readingsToValidate.length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-4">No hay alertas de lecturas pendientes de validación.</p>
                                    ) : (
                                        readingsToValidate.map(r => {
                                            const mach = machines.find(m => m.id === r.machineId);
                                            const client = clients.find(c => c.id === mach?.clientId);
                                            return (
                                                <div key={r.id} className="p-3 border rounded-xl flex items-center justify-between text-xs bg-slate-900/20 border-slate-800">
                                                    <div>
                                                        <span className="block font-bold text-slate-200">{client?.name}</span>
                                                        <span className="text-[10px] text-slate-500">{mach?.brand} {mach?.model} (S/N: {mach?.serial})</span>
                                                        <span className="block text-[10px] text-amber-500 font-semibold mt-1">
                                                            {r.readingStatus === 'observada' ? `🚨 Observada: ${r.readingComment}` : 'ℹ️ Pendiente de Validación'}
                                                        </span>
                                                    </div>
                                                    <Link href="/lecturas">
                                                        <Button variant="secondary" size="sm">Validar</Button>
                                                    </Link>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </Card>
                        </div>

                        {/* Reincidentes & Repuestos */}
                        <div className="space-y-6">
                            <Card>
                                <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">Equipos Críticos Recurrentes</h2>
                                </div>
                                <CardContent className="p-5 space-y-3">
                                    {criticalMachinesList.length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center">Sin alertas de reincidencia en los últimos 60 días.</p>
                                    ) : (
                                        criticalMachinesList.map(item => (
                                            <div key={item.machine.id} className="p-3 border border-red-500/20 bg-red-500/5 rounded-xl text-xs flex justify-between items-center">
                                                <div>
                                                    <span className="block font-bold text-red-400">{item.machine.brand} {item.machine.model}</span>
                                                    <span className="text-[10px] text-slate-500 font-mono-tabular">S/N: {item.machine.serial}</span>
                                                </div>
                                                <span className="px-2 py-1 rounded bg-red-500/10 text-red-500 font-extrabold">{item.count} fallas</span>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">Repuestos Críticos Solicitados</h2>
                                </div>
                                <CardContent className="p-5 space-y-3">
                                    {tickets.filter(t => t.partsNeeded && t.status !== 'resuelto' && t.status !== 'cerrado').length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center">No hay solicitudes de repuestos pendientes.</p>
                                    ) : (
                                        tickets.filter(t => t.partsNeeded && t.status !== 'resuelto' && t.status !== 'cerrado').map(t => (
                                            <div key={t.id} className="p-3 border border-slate-800 rounded-xl text-xs space-y-1 bg-slate-900/20">
                                                <div className="flex justify-between font-bold">
                                                    <span className="text-slate-200">{t.partsNeeded}</span>
                                                    <span className="text-indigo-400 uppercase text-[9px]">{t.status}</span>
                                                </div>
                                                <span className="block text-[10px] text-slate-500">Para: {t.machineDesc} ({t.clientName})</span>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            ) : (
                // ==========================================
                // ADMINISTRATIVE DASHBOARD VIEW
                // ==========================================
                <div className="space-y-6">
                    {/* Admin KPI Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-l-4 border-l-indigo-600 bg-slate-900/40">
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Clientes Activos</span>
                                    <span className="block text-2xl font-extrabold text-white mt-1">{activeClientsCount}</span>
                                    <span className="text-[10px] text-slate-500 mt-1 block">Registrados en el sistema</span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-500 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-indigo-600 bg-slate-900/40">
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Máquinas Alquiladas</span>
                                    <span className="block text-2xl font-extrabold text-white mt-1">{rentedMachinesCount}</span>
                                    <span className="text-[10px] text-slate-500 mt-1 block">Equipos activos rentados</span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-500 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-indigo-600 bg-slate-900/40">
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Abono Mensual Fijo</span>
                                    <span className="block text-xl font-extrabold text-white mt-1 font-mono-tabular">{formatCurrency(projectedBase)}</span>
                                    <span className="text-[10px] text-slate-500 mt-1 block">Total proyectado base</span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-500 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-indigo-600 bg-slate-900/40">
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Facturación Total Mes</span>
                                    <span className="block text-xl font-extrabold text-white mt-1 font-mono-tabular">{formatCurrency(totalRevenueMonth)}</span>
                                    <span className="text-[10px] text-slate-500 mt-1 block">Excedentes: {formatCurrency(totalExcessInvoiced)}</span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-500 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Active technical support tickets */}
                    <Card>
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Área Técnica - Pedidos Activos y Alertas de Soporte</h2>
                            <span className="text-xs font-bold text-slate-100 bg-slate-800 px-3 py-1 rounded-lg">
                                {activeTickets.length} Activos
                            </span>
                        </div>
                        <div className="p-5 space-y-3">
                            {activeTickets.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-4">No hay servicios pendientes en este momento.</p>
                            ) : (
                                activeTickets.map(t => (
                                    <div key={t.id} className="p-3 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-slate-900/20 border-slate-800 gap-3">
                                        <div>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold mr-2 ${t.priority === 'alta' ? 'bg-red-500/10 text-red-500' : 'bg-slate-500/10 text-slate-400'}`}>
                                                {t.priority.toUpperCase()}
                                            </span>
                                            <span className="font-bold text-slate-200">{t.clientName}</span>
                                            <span className="text-slate-400 text-[10px] block sm:inline sm:ml-2">({t.machineDesc} S/N: {t.serialNumber}):</span>
                                            <span className="block sm:inline sm:ml-2 text-slate-300 font-semibold">{t.description || t.category}</span>
                                        </div>
                                        <Link href="/tecnica" className="self-end sm:self-auto">
                                            <Button variant="secondary" size="sm">Atender</Button>
                                        </Link>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>

                    {/* Bottom Split: Readings Progress and Collections */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Readings Progress */}
                        <div className="lg:col-span-2">
                            <Card>
                                <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">Estado de Lecturas del Mes Seleccionado</h2>
                                </div>
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex justify-between text-xs font-bold text-slate-300">
                                        <span>Progreso de carga de lecturas</span>
                                        <span>{readingsProgressPct}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                                        <div className="bg-emerald-500 h-3 rounded-full transition-all duration-300" style={{ width: `${readingsProgressPct}%` }}></div>
                                    </div>
                                    <span className="block text-[11px] text-slate-500 font-medium">
                                        {readingsFilledCount} de {rentedMachinesCount} máquinas registradas en el mes
                                    </span>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Collections */}
                        <div className="lg:col-span-1">
                            <Card>
                                <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">Resumen de Cobros</h2>
                                </div>
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-semibold">Cobrado:</span>
                                        <span className="font-extrabold text-emerald-500 text-sm font-mono-tabular">{formatCurrency(collectedAmt)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-semibold">Pendiente:</span>
                                        <span className="font-extrabold text-amber-500 text-sm font-mono-tabular">{formatCurrency(pendingAmt)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const abonos = [
    { id: 'abono-basic', name: 'Plan Básico 2000', price: 45000, limit: 2000, excessPrice: 15.5 },
    { id: 'abono-medium', name: 'Plan Pyme 5000', price: 95000, limit: 5000, excessPrice: 12.0 },
    { id: 'abono-premium', name: 'Plan Corporativo 15000', price: 240000, limit: 15000, excessPrice: 9.0 },
    { id: 'abono-color', name: 'Plan Color Corporativo 5000', price: 180000, limit: 5000, excessPrice: 28.0 }
];
