'use client';

import React, { useState, useMemo } from 'react';
import { useManagement } from '@/lib/context';
import { Card, CardContent } from '@/components/ui/card';
import { TableContainer, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { formatCurrency, formatPeriod } from '@/lib/utils';
import {
    getOverallKpis, getVolumeByMonth, getStrongestMonths, getStatsByClient,
    getTicketsTrend, getPaymentsTrend, getClientsByTicketVolume, getTechnicianStats,
    getTicketCategoryBreakdown, getPartsUsageStats, getLowStockItems, getAgingSnapshot,
    getMachineProfitability, getMachineProfitabilityByPeriod, getRentalProfitability, getBusinessResult, getClientConcentration, getInactiveClients, getMeterGrowthSignal,
    Granularity, ConsumablesCostSource,
} from '@/lib/stats';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart2, TrendingUp, Users, Wrench, Package, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const TABS = [
    { key: 'resumen', label: 'Resumen General', icon: BarChart2 },
    { key: 'clientes', label: 'Por Cliente', icon: Users },
    { key: 'tendencias', label: 'Tendencias Temporales', icon: TrendingUp },
    { key: 'tecnico', label: 'Servicio Técnico', icon: Wrench },
    { key: 'insumos', label: 'Insumos y Repuestos', icon: Package },
    { key: 'otros', label: 'Otros Indicadores', icon: AlertTriangle },
] as const;

const CHART_GRID = '#334155';
const CHART_TICK = { fill: '#94a3b8', fontSize: 11 };
const CHART_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7'];

const chartTooltipStyle = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12, color: '#e2e8f0' };

const truncateName = (name: string, max: number = 22) => name.length > max ? name.slice(0, max) + '…' : name;
const pct = (part: number, total: number) => total > 0 ? Math.round((part / total) * 1000) / 10 : 0;

// Render manual del valor+porcentaje sobre cada barra — se probó <LabelList> primero
// (la forma habitual en Recharts) pero en la versión instalada (3.10.1) no emitía
// ningún nodo <text>, confirmado inspeccionando el SVG en vivo; esto es 100% confiable
// porque dibuja el <text> directamente en vez de depender de la resolución interna de
// LabelList. `data` es el mismo array que recibió el <BarChart>, `index` lo da Recharts.
function renderSideLabel(data: { labelText: string }[]) {
    return (props: any) => {
        const { x, y, width, height, index } = props;
        const item = data[index];
        if (!item) return null;
        return (
            <text x={x + width + 8} y={y + height / 2} fill="#e2e8f0" fontSize={11} textAnchor="start" dominantBaseline="middle">
                {item.labelText}
            </text>
        );
    };
}

function renderTopLabel(data: { labelText: string }[]) {
    return (props: any) => {
        const { x, y, width, index } = props;
        const item = data[index];
        if (!item) return null;
        return (
            <text x={x + width / 2} y={y - 6} fill="#94a3b8" fontSize={10} textAnchor="middle">
                {item.labelText}
            </text>
        );
    };
}

// Etapa 6: costo de insumos por copia — distingue las 3 fuentes posibles en vez de solo
// número-o-"s/d", para que quede claro cuándo el número es real (rendimiento cargado en
// Catálogo + consumible instalado en la máquina) vs. una estimación manual de la Etapa 1.
function ConsumablesCostCell({ source, cost }: { source: ConsumablesCostSource; cost: number }) {
    if (source === 'none') return <span className="text-slate-500 italic">s/d</span>;
    return (
        <span>
            {formatCurrency(cost)}
            {source === 'manual' && <span className="text-slate-500 text-[10px] ml-1">(manual)</span>}
        </span>
    );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <Card className="p-4">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{label}</p>
            <p className="text-xl font-bold text-slate-100 mt-1">{value}</p>
            {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
        </Card>
    );
}

export default function EstadisticasPage() {
    const { clients, machines, readings, tickets, users, rentals, abonos, payments, partsCatalog, gastosGenerales, ventas, currentMonth } = useManagement();
    const [currentTab, setCurrentTab] = useState<typeof TABS[number]['key']>('resumen');
    const [granularity, setGranularity] = useState<Granularity>('mes');
    const [profitGranularity, setProfitGranularity] = useState<'mes' | 'año'>('mes');

    const kpis = useMemo(() => getOverallKpis(readings, tickets), [readings, tickets]);
    const volumeByMonth = useMemo(() => getVolumeByMonth(readings), [readings]);
    const strongest = useMemo(() => getStrongestMonths(readings), [readings]);

    const clientStats = useMemo(() =>
        getStatsByClient(clients, readings, machines, tickets)
            .filter(c => c.volume > 0 || c.ticketCount > 0)
            .sort((a, b) => b.revenue - a.revenue),
        [clients, readings, machines, tickets]);

    const ticketsTrend = useMemo(() => getTicketsTrend(tickets, granularity), [tickets, granularity]);
    const paymentsTrend = useMemo(() => getPaymentsTrend(payments, granularity), [payments, granularity]);

    const clientsByTickets = useMemo(() => getClientsByTicketVolume(clients, tickets), [clients, tickets]);
    const techStats = useMemo(() => getTechnicianStats(users, tickets), [users, tickets]);
    const categoryBreakdown = useMemo(() => getTicketCategoryBreakdown(tickets), [tickets]);

    const partsUsage = useMemo(() => getPartsUsageStats(tickets), [tickets]);
    const lowStock = useMemo(() => getLowStockItems(partsCatalog), [partsCatalog]);

    const aging = useMemo(() => getAgingSnapshot(clients, readings, machines, payments), [clients, readings, machines, payments]);
    const profitability = useMemo(() =>
        getMachineProfitability(machines, readings, tickets, partsCatalog).sort((a, b) => b.netProfit - a.netProfit),
        [machines, readings, tickets, partsCatalog]);
    const profitPeriodValue = profitGranularity === 'mes' ? currentMonth : (currentMonth || '').slice(0, 4);
    const profitabilityPeriod = useMemo(() =>
        getMachineProfitabilityByPeriod(machines, readings, tickets, partsCatalog, profitGranularity, profitPeriodValue).sort((a, b) => b.operatingResult - a.operatingResult),
        [machines, readings, tickets, partsCatalog, profitGranularity, profitPeriodValue]);
    const businessResult = useMemo(() =>
        getBusinessResult(machines, readings, tickets, partsCatalog, gastosGenerales, ventas, profitGranularity, profitPeriodValue),
        [machines, readings, tickets, partsCatalog, gastosGenerales, ventas, profitGranularity, profitPeriodValue]);
    const rentalProfitability = useMemo(() =>
        getRentalProfitability(rentals, readings, tickets, machines, partsCatalog),
        [rentals, readings, tickets, machines, partsCatalog]);
    const concentration = useMemo(() => getClientConcentration(clients, readings, machines), [clients, readings, machines]);
    const inactive = useMemo(() => getInactiveClients(clients, rentals, readings, machines), [clients, rentals, readings, machines]);
    const growthSignals = useMemo(() => getMeterGrowthSignal(machines, clients, readings, abonos), [machines, clients, readings, abonos]);

    const agingData = [
        { name: 'Al día', value: aging.current },
        { name: '1-30 días', value: aging.d1_30 },
        { name: '31-60 días', value: aging.d31_60 },
        { name: '61-90 días', value: aging.d61_90 },
        { name: '90+ días', value: aging.d90plus },
    ];

    // Top clientes por ingresos, con % del total facturado entre TODOS los clientes con
    // ingresos (no solo el top N) — así el % refleja la concentración real, no solo entre sí.
    const clientChartData = useMemo(() => {
        const totalRevenue = clientStats.reduce((s, c) => s + c.revenue, 0);
        return clientStats.slice(0, 10).map(c => {
            const share = pct(c.revenue, totalRevenue);
            return { name: truncateName(c.client.name), revenue: c.revenue, share, labelText: `${formatCurrency(c.revenue)} (${share}%)` };
        });
    }, [clientStats]);

    // Estacionalidad en orden calendario (enero→diciembre), no por ranking de fuerza —
    // así el patrón anual se lee de un vistazo en vez de saltar entre meses no consecutivos.
    const monthsChartData = useMemo(() => {
        const total = strongest.months.reduce((s, m) => s + m.avgVolume, 0);
        return [...strongest.months].sort((a, b) => a.monthIndex - b.monthIndex).map(m => {
            const share = pct(m.avgVolume, total);
            return { name: m.monthName.slice(0, 3), avgVolume: m.avgVolume, share, labelText: `${m.avgVolume.toLocaleString('es-AR')} (${share}%)` };
        });
    }, [strongest]);

    const clientsByTicketsChartData = useMemo(() => {
        const total = clientsByTickets.reduce((s, r) => s + r.ticketCount, 0);
        return clientsByTickets.slice(0, 8).map(r => {
            const share = pct(r.ticketCount, total);
            return { name: truncateName(r.client.name), ticketCount: r.ticketCount, share, labelText: `${r.ticketCount} (${share}%)` };
        });
    }, [clientsByTickets]);

    const partsUsageChartData = useMemo(() => {
        const total = partsUsage.reduce((s, p) => s + p.totalQty, 0);
        return partsUsage.slice(0, 8).map(p => {
            const share = pct(p.totalQty, total);
            return { name: truncateName(p.nombre), totalQty: p.totalQty, share, labelText: `${p.totalQty} (${share}%)` };
        });
    }, [partsUsage]);

    return (
        <div className="space-y-6 animate-fade-in relative text-slate-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-850 pb-4">
                <div>
                    <h2 className="text-base font-semibold text-slate-100 uppercase tracking-wider">Estadísticas</h2>
                    <p className="text-[10px] text-slate-400">Volumen, facturación, servicio técnico e insumos — calculado sobre los datos reales de la aplicación.</p>
                </div>
                <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-850 gap-1.5 text-xs overflow-x-auto max-w-full">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setCurrentTab(tab.key)}
                                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                                    currentTab === tab.key ? 'bg-indigo-650 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Icon size={13} /> {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {currentTab === 'resumen' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Kpi label="Volumen Total" value={kpis.totalVolume.toLocaleString('es-AR')} hint="copias/impresiones" />
                        <Kpi label="Ingresos Totales" value={formatCurrency(kpis.totalRevenue)} />
                        <Kpi label="Cobrado" value={formatCurrency(kpis.totalCollected)} />
                        <Kpi label="Tickets Totales" value={String(kpis.totalTickets)} />
                        <Kpi label="Costo Insumos/Repuestos" value={formatCurrency(kpis.totalPartsUsedCost)} hint="usados en tickets" />
                    </div>

                    <Card>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Volumen y Facturación por Mes</p>
                        {volumeByMonth.length === 0 ? (
                            <p className="text-xs text-slate-500 py-6 text-center">Todavía no hay lecturas cargadas.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={volumeByMonth.map(m => ({ ...m, month: formatPeriod(m.month) }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                    <XAxis dataKey="month" tick={CHART_TICK} />
                                    <YAxis tick={CHART_TICK} />
                                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, name: any) => name === 'volume' ? [Number(v).toLocaleString('es-AR'), 'Volumen'] : [formatCurrency(Number(v)), 'Ingresos']} />
                                    <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === 'volume' ? 'Volumen' : 'Ingresos'} />
                                    <Bar dataKey="volume" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="revenue" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Card>

                    <Card>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Meses Más Fuertes (Estacionalidad)</p>
                        {!strongest.hasEnoughData ? (
                            <p className="text-xs text-slate-500 py-4">Se necesitan lecturas de al menos 2 años distintos para calcular estacionalidad de forma confiable. Por ahora solo hay datos de un año.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={monthsChartData} margin={{ top: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                    <XAxis dataKey="name" tick={CHART_TICK} />
                                    <YAxis tick={CHART_TICK} />
                                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, n: any, item: any) => [`${Number(v).toLocaleString('es-AR')} (${item.payload.share}%)`, 'Volumen prom.']} />
                                    <Bar dataKey="avgVolume" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} label={renderTopLabel(monthsChartData)} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Card>
                </div>
            )}

            {currentTab === 'clientes' && (
                <div className="space-y-4">
                    <Card>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Top Clientes por Ingresos</p>
                        {clientChartData.length === 0 ? (
                            <p className="text-xs text-slate-500 py-6 text-center">Sin datos todavía.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={Math.max(220, clientChartData.length * 42)}>
                                <BarChart data={clientChartData} layout="vertical" margin={{ right: 130 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                    <XAxis type="number" tick={CHART_TICK} />
                                    <YAxis type="category" dataKey="name" tick={CHART_TICK} width={130} />
                                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, n: any, item: any) => [`${formatCurrency(Number(v))} (${item.payload.share}%)`, 'Ingresos']} />
                                    <Bar dataKey="revenue" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} label={renderSideLabel(clientChartData)} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Card>

                    <Card>
                    <TableContainer>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Cliente</TableHeaderCell>
                                    <TableHeaderCell>Volumen</TableHeaderCell>
                                    <TableHeaderCell>Ingresos</TableHeaderCell>
                                    <TableHeaderCell>Cobrado</TableHeaderCell>
                                    <TableHeaderCell>Tickets</TableHeaderCell>
                                    <TableHeaderCell>Costo Repuestos</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clientStats.length === 0 && (
                                    <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">Sin datos todavía.</TableCell></TableRow>
                                )}
                                {clientStats.map(c => (
                                    <TableRow key={c.client.id}>
                                        <TableCell className="font-semibold text-slate-100">{c.client.name}</TableCell>
                                        <TableCell>{c.volume.toLocaleString('es-AR')}</TableCell>
                                        <TableCell>{formatCurrency(c.revenue)}</TableCell>
                                        <TableCell>{formatCurrency(c.collected)}</TableCell>
                                        <TableCell>{c.ticketCount}</TableCell>
                                        <TableCell>{formatCurrency(c.partsCost)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    </Card>
                </div>
            )}

            {currentTab === 'tendencias' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div className="w-40">
                            <Select
                                value={granularity}
                                onChange={(e) => setGranularity(e.target.value as Granularity)}
                                options={[{ value: 'semana', label: 'Semana' }, { value: 'mes', label: 'Mes' }, { value: 'año', label: 'Año' }]}
                            />
                        </div>
                        <p className="text-[10px] text-slate-500">Aplica a tickets y cobros. El volumen/facturación de lecturas solo admite mes/año (una lectura por equipo por mes).</p>
                    </div>

                    <Card>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Tickets por Período</p>
                        {ticketsTrend.length === 0 ? (
                            <p className="text-xs text-slate-500 py-6 text-center">Sin tickets registrados.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={ticketsTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                    <XAxis dataKey="periodKey" tick={CHART_TICK} />
                                    <YAxis tick={CHART_TICK} allowDecimals={false} />
                                    <Tooltip contentStyle={chartTooltipStyle} />
                                    <Bar dataKey="count" name="Tickets" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Card>

                    <Card>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Cobros por Período</p>
                        {paymentsTrend.length === 0 ? (
                            <p className="text-xs text-slate-500 py-6 text-center">Sin cobros registrados todavía.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={paymentsTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                    <XAxis dataKey="periodKey" tick={CHART_TICK} />
                                    <YAxis tick={CHART_TICK} />
                                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any) => formatCurrency(Number(v))} />
                                    <Bar dataKey="total" name="Cobrado" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Card>
                </div>
            )}

            {currentTab === 'tecnico' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Clientes que Más Piden Servicio</p>
                            {clientsByTicketsChartData.length === 0 ? (
                                <p className="text-xs text-slate-500 py-4">Sin tickets asociados a clientes registrados.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={Math.max(200, clientsByTicketsChartData.length * 34)}>
                                    <BarChart data={clientsByTicketsChartData} layout="vertical" margin={{ right: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                        <XAxis type="number" tick={CHART_TICK} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" tick={CHART_TICK} width={120} />
                                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, n: any, item: any) => [`${v} (${item.payload.share}%)`, 'Tickets']} />
                                        <Bar dataKey="ticketCount" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} label={renderSideLabel(clientsByTicketsChartData)} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </Card>

                        <Card>
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Tickets por Categoría</p>
                            {categoryBreakdown.length === 0 ? (
                                <p className="text-xs text-slate-500 py-4">Sin tickets registrados.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={categoryBreakdown} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.category}: ${e.count}`}>
                                            {categoryBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip contentStyle={chartTooltipStyle} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </Card>
                    </div>

                    <Card>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Desempeño por Técnico</p>
                        <TableContainer>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Técnico</TableHeaderCell>
                                        <TableHeaderCell>Asignados</TableHeaderCell>
                                        <TableHeaderCell>Resueltos</TableHeaderCell>
                                        <TableHeaderCell>Cumplimiento SLA</TableHeaderCell>
                                        <TableHeaderCell>Tiempo Prom. Resolución</TableHeaderCell>
                                        <TableHeaderCell>Costo Total</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {techStats.length === 0 && (
                                        <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">Sin tickets asignados a técnicos.</TableCell></TableRow>
                                    )}
                                    {techStats.map(t => (
                                        <TableRow key={t.user.id}>
                                            <TableCell className="font-semibold text-slate-100">{t.user.fullname}</TableCell>
                                            <TableCell>{t.totalAssigned}</TableCell>
                                            <TableCell>{t.resolvedCount}</TableCell>
                                            <TableCell>
                                                <Badge variant={t.complianceRate >= 90 ? 'success' : t.complianceRate >= 75 ? 'warning' : 'danger'}>{t.complianceRate}%</Badge>
                                            </TableCell>
                                            <TableCell>{t.avgResolutionHours}h</TableCell>
                                            <TableCell>{formatCurrency(t.totalCost)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                </div>
            )}

            {currentTab === 'insumos' && (
                <div className="space-y-4">
                    {lowStock.length > 0 && (
                        <Card className="border-red-900/40 bg-red-950/10">
                            <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <AlertTriangle size={13} /> Stock Bajo
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {lowStock.map(item => (
                                    <Badge key={item.id} variant="danger">{item.nombre} ({item.stockActual}/{item.stockMinimo})</Badge>
                                ))}
                            </div>
                        </Card>
                    )}

                    <Card>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Insumos y Repuestos Más Usados (por cantidad)</p>
                        {partsUsageChartData.length === 0 ? (
                            <p className="text-xs text-slate-500 py-6 text-center">Todavía no se registró uso de insumos/repuestos catalogados en tickets.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={Math.max(200, partsUsageChartData.length * 34)}>
                                <BarChart data={partsUsageChartData} layout="vertical" margin={{ right: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                    <XAxis type="number" tick={CHART_TICK} allowDecimals={false} />
                                    <YAxis type="category" dataKey="name" tick={CHART_TICK} width={130} />
                                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any, n: any, item: any) => [`${v} (${item.payload.share}%)`, 'Cantidad']} />
                                    <Bar dataKey="totalQty" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} label={renderSideLabel(partsUsageChartData)} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Card>

                    <Card>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Detalle Completo</p>
                        <TableContainer>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Ítem</TableHeaderCell>
                                        <TableHeaderCell>Categoría</TableHeaderCell>
                                        <TableHeaderCell>Cantidad Usada</TableHeaderCell>
                                        <TableHeaderCell>Costo Total</TableHeaderCell>
                                        <TableHeaderCell>En Tickets</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {partsUsage.length === 0 && (
                                        <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-6">Todavía no se registró uso de insumos/repuestos catalogados en tickets.</TableCell></TableRow>
                                    )}
                                    {partsUsage.map(p => (
                                        <TableRow key={p.catalogId}>
                                            <TableCell className="font-semibold text-slate-100">{p.nombre}</TableCell>
                                            <TableCell><Badge variant={p.categoria === 'Repuesto' ? 'info' : 'secondary'}>{p.categoria}</Badge></TableCell>
                                            <TableCell>{p.totalQty}</TableCell>
                                            <TableCell>{formatCurrency(p.totalCost)}</TableCell>
                                            <TableCell>{p.ticketCount}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                </div>
            )}

            {currentTab === 'otros' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Mora por Antigüedad (Estado Actual)</p>
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={agingData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                                    <XAxis type="number" tick={CHART_TICK} />
                                    <YAxis type="category" dataKey="name" tick={CHART_TICK} width={70} />
                                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: any) => formatCurrency(Number(v))} />
                                    <Bar dataKey="value" fill={CHART_COLORS[3]} radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Card>

                        <Card>
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Concentración de Clientes</p>
                            <p className="text-xs text-slate-400 mb-3">Los {concentration.top.length} clientes más grandes representan <span className="font-bold text-slate-100">{concentration.topShare}%</span> de la facturación.</p>
                            <div className="space-y-1.5">
                                {concentration.top.map(c => (
                                    <div key={c.client.id} className="flex justify-between text-xs py-1 border-b border-slate-850/60 last:border-0">
                                        <span className="text-slate-200">{c.client.name}</span>
                                        <span className="text-slate-400">{c.share}%</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                    <Card className="border-indigo-900/40 bg-indigo-950/10">
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Resultado del Negocio — {profitGranularity === 'mes' ? formatPeriod(profitPeriodValue) : profitPeriodValue}</p>
                        <p className="text-[10px] text-slate-500 mb-3">Resultado operativo de todas las máquinas más el margen de las ventas (equipos/insumos/repuestos) del período, menos los Gastos Generales cargados en Finanzas para ese mismo período. No incluye amortización de equipos (Etapa 4) todavía.</p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Resultado Operativo (Máquinas)</p>
                                <p className="text-lg font-bold text-slate-100 mt-1">{formatCurrency(businessResult.totalOperatingResult)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Margen de Ventas</p>
                                <p className={`text-lg font-bold mt-1 ${businessResult.totalVentasMargin >= 0 ? 'text-slate-100' : 'text-red-400'}`}>{businessResult.totalVentasMargin >= 0 ? '+ ' : '− '}{formatCurrency(Math.abs(businessResult.totalVentasMargin))}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Gastos Generales</p>
                                <p className="text-lg font-bold text-red-400 mt-1">− {formatCurrency(businessResult.totalGastosGenerales)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Resultado del Negocio</p>
                                <p className={`text-xl font-bold mt-1 ${businessResult.businessResult >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(businessResult.businessResult)}</p>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 mb-3">
                            <div>
                                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Rentabilidad por Máquina — {profitGranularity === 'mes' ? formatPeriod(profitPeriodValue) : profitPeriodValue}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Devengado = facturado en el período. Cobrado = cobrado de ese período hasta hoy. Costo de insumos: real por rendimiento de tóner/módulo/fusor si están configurados en Máquinas, si no la estimación manual (marcada "manual"), si no "s/d" — nunca se asume $0.</p>
                            </div>
                            <div className="w-36">
                                <Select
                                    value={profitGranularity}
                                    onChange={(e) => setProfitGranularity(e.target.value as 'mes' | 'año')}
                                    options={[{ value: 'mes', label: 'Mes actual' }, { value: 'año', label: 'Año actual' }]}
                                />
                            </div>
                        </div>
                        <TableContainer>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Equipo</TableHeaderCell>
                                        <TableHeaderCell>Volumen</TableHeaderCell>
                                        <TableHeaderCell>Devengado</TableHeaderCell>
                                        <TableHeaderCell>Cobrado</TableHeaderCell>
                                        <TableHeaderCell>Costo M. Obra</TableHeaderCell>
                                        <TableHeaderCell>Costo Repuestos</TableHeaderCell>
                                        <TableHeaderCell>Costo Insumos</TableHeaderCell>
                                        <TableHeaderCell>Resultado Operativo</TableHeaderCell>
                                        <TableHeaderCell>Amortización</TableHeaderCell>
                                        <TableHeaderCell>Resultado Neto Contable</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {profitabilityPeriod.length === 0 && (
                                        <TableRow><TableCell colSpan={10} className="text-center text-slate-500 py-6">Sin actividad de máquinas en este período.</TableCell></TableRow>
                                    )}
                                    {profitabilityPeriod.map(p => (
                                        <TableRow key={p.machine.id}>
                                            <TableCell className="font-semibold text-slate-100">{p.machine.brand} {p.machine.model} ({p.machine.serial})</TableCell>
                                            <TableCell>{p.volume.toLocaleString('es-AR')}</TableCell>
                                            <TableCell>{formatCurrency(p.revenueAccrual)}</TableCell>
                                            <TableCell>{formatCurrency(p.revenueCash)}</TableCell>
                                            <TableCell>{formatCurrency(p.laborCost)}</TableCell>
                                            <TableCell>{formatCurrency(p.partsCost)}</TableCell>
                                            <TableCell><ConsumablesCostCell source={p.consumablesCostSource} cost={p.consumablesCost} /></TableCell>
                                            <TableCell>
                                                <span className={p.operatingResult >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{formatCurrency(p.operatingResult)}</span>
                                            </TableCell>
                                            <TableCell>{p.hasAmortizationData ? formatCurrency(p.amortization) : <span className="text-slate-500 italic">s/d</span>}</TableCell>
                                            <TableCell>
                                                {p.netAccountingResult != null ? (
                                                    <span className={p.netAccountingResult >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{formatCurrency(p.netAccountingResult)}</span>
                                                ) : <span className="text-slate-500 italic">s/d</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>

                    <Card>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Rentabilidad por Máquina (Histórico Completo)</p>
                        <TableContainer>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Equipo</TableHeaderCell>
                                        <TableHeaderCell>Volumen</TableHeaderCell>
                                        <TableHeaderCell>Ingresos</TableHeaderCell>
                                        <TableHeaderCell>Costo Técnico</TableHeaderCell>
                                        <TableHeaderCell>Costo Repuestos</TableHeaderCell>
                                        <TableHeaderCell>Costo Insumos</TableHeaderCell>
                                        <TableHeaderCell>Resultado Neto</TableHeaderCell>
                                        <TableHeaderCell>Amortización</TableHeaderCell>
                                        <TableHeaderCell>Resultado Neto Contable</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {profitability.length === 0 && (
                                        <TableRow><TableCell colSpan={9} className="text-center text-slate-500 py-6">Sin datos suficientes.</TableCell></TableRow>
                                    )}
                                    {profitability.slice(0, 15).map(p => (
                                        <TableRow key={p.machine.id}>
                                            <TableCell className="font-semibold text-slate-100">{p.machine.brand} {p.machine.model} ({p.machine.serial})</TableCell>
                                            <TableCell>{p.volume.toLocaleString('es-AR')}</TableCell>
                                            <TableCell>{formatCurrency(p.revenue)}</TableCell>
                                            <TableCell>{formatCurrency(p.technicalCost)}</TableCell>
                                            <TableCell>{formatCurrency(p.partsCost)}</TableCell>
                                            <TableCell><ConsumablesCostCell source={p.consumablesCostSource} cost={p.consumablesCost} /></TableCell>
                                            <TableCell>
                                                <span className={p.netProfit >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{formatCurrency(p.netProfit)}</span>
                                            </TableCell>
                                            <TableCell>{p.hasAmortizationData ? formatCurrency(p.amortization) : <span className="text-slate-500 italic">s/d</span>}</TableCell>
                                            <TableCell>
                                                {p.netAccountingResult != null ? (
                                                    <span className={p.netAccountingResult >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{formatCurrency(p.netAccountingResult)}</span>
                                                ) : <span className="text-slate-500 italic">s/d</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>

                    <Card>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Rentabilidad por Contrato de Alquiler</p>
                        <p className="text-[10px] text-slate-500 mb-3">Corte por cada contrato individual (cliente + equipo + fecha inicio/fin), no por equipo en general — un mismo equipo reasignado entre clientes ya no mezcla los historiales en un solo número. Ordenado de mayor a menor resultado operativo.</p>
                        <TableContainer>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Cliente</TableHeaderCell>
                                        <TableHeaderCell>Equipo</TableHeaderCell>
                                        <TableHeaderCell>Período</TableHeaderCell>
                                        <TableHeaderCell>Volumen</TableHeaderCell>
                                        <TableHeaderCell>Devengado</TableHeaderCell>
                                        <TableHeaderCell>Cobrado</TableHeaderCell>
                                        <TableHeaderCell>Costo M. Obra</TableHeaderCell>
                                        <TableHeaderCell>Costo Repuestos</TableHeaderCell>
                                        <TableHeaderCell>Costo Insumos</TableHeaderCell>
                                        <TableHeaderCell>Resultado Operativo</TableHeaderCell>
                                        <TableHeaderCell>Amortización</TableHeaderCell>
                                        <TableHeaderCell>Resultado Neto Contable</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rentalProfitability.length === 0 && (
                                        <TableRow><TableCell colSpan={12} className="text-center text-slate-500 py-6">Sin actividad registrada todavía en ningún contrato.</TableCell></TableRow>
                                    )}
                                    {rentalProfitability.slice(0, 20).map(rp => {
                                        const client = clients.find(c => c.id === rp.rental.clientId);
                                        return (
                                            <TableRow key={rp.rental.id}>
                                                <TableCell className="font-semibold text-slate-100">{client ? client.name : 'Desconocido'}</TableCell>
                                                <TableCell className="text-xs text-slate-300">{rp.machine ? `${rp.machine.brand} ${rp.machine.model}` : 'Equipo retirado'}</TableCell>
                                                <TableCell className="text-[10px] text-slate-400 font-mono-tabular">{rp.rental.startDate} — {rp.rental.endDate || 'vigente'}</TableCell>
                                                <TableCell>{rp.volume.toLocaleString('es-AR')}</TableCell>
                                                <TableCell>{formatCurrency(rp.revenueAccrual)}</TableCell>
                                                <TableCell>{formatCurrency(rp.revenueCash)}</TableCell>
                                                <TableCell>{formatCurrency(rp.laborCost)}</TableCell>
                                                <TableCell>{formatCurrency(rp.partsCost)}</TableCell>
                                                <TableCell><ConsumablesCostCell source={rp.consumablesCostSource} cost={rp.consumablesCost} /></TableCell>
                                                <TableCell>
                                                    <span className={rp.operatingResult >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{formatCurrency(rp.operatingResult)}</span>
                                                </TableCell>
                                                <TableCell>{rp.hasAmortizationData ? formatCurrency(rp.amortization) : <span className="text-slate-500 italic">s/d</span>}</TableCell>
                                                <TableCell>
                                                    {rp.netAccountingResult != null ? (
                                                        <span className={rp.netAccountingResult >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>{formatCurrency(rp.netAccountingResult)}</span>
                                                    ) : <span className="text-slate-500 italic">s/d</span>}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Clientes Inactivos</p>
                            <p className="text-[10px] text-slate-500 mb-3">Alquiler activo pero sin lectura reciente (60+ días) — posible señal de baja.</p>
                            {inactive.length === 0 ? (
                                <p className="text-xs text-slate-500 py-2">Sin clientes inactivos detectados.</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {inactive.slice(0, 10).map(i => (
                                        <div key={i.client.id} className="flex justify-between text-xs py-1 border-b border-slate-850/60 last:border-0">
                                            <span className="text-slate-200">{i.client.name}</span>
                                            <span className="text-amber-400">{i.daysSinceLastReading != null ? `${i.daysSinceLastReading} días sin lectura` : 'Sin lecturas'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        <Card>
                            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Señales de Upsell / Downgrade</p>
                            <p className="text-[10px] text-slate-500 mb-3">Promedio de los últimos 3 meses vs. el límite del abono asignado.</p>
                            {growthSignals.length === 0 ? (
                                <p className="text-xs text-slate-500 py-2">Sin señales relevantes por ahora.</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {growthSignals.slice(0, 10).map((s, i) => (
                                        <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-slate-850/60 last:border-0">
                                            <span className="text-slate-200">{s.client.name} — {s.machine.brand} {s.machine.model}</span>
                                            <span className={`flex items-center gap-1 font-bold ${s.signal === 'upsell' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                {s.signal === 'upsell' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                {s.avgRecentVolume.toLocaleString('es-AR')} / {s.limit.toLocaleString('es-AR')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
