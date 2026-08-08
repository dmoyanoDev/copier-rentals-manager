// Funciones puras de agregación para la página de Estadísticas. Todo se calcula
// client-side sobre los datos ya cargados por useManagement() — no hay rutas API
// nuevas de lectura, ver contexto en el plan de la feature.
import { Client, Machine, Reading, Ticket, User, Rental, Abono, Payment, PartCatalogItem, PartUsageEntry, GastoGeneral, Venta } from '@/domain/types';
import { getClientReadings, getReadingClient, getClientFinancialSummaryHelper, getDaysOverdue } from '@/lib/utils';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export type Granularity = 'semana' | 'mes' | 'año';

// Tickets/pagos/gestiones tienen fecha real por evento; las lecturas solo tienen un
// `month` mensual (una lectura por máquina por mes, ver sync/process/route.ts) — por
// eso el volumen/facturación de lecturas nunca soporta granularidad semanal.
export function ticketDate(t: Ticket): Date {
    if (t.createdAt) return new Date(t.createdAt);
    if (t.date) return new Date(`${t.date}T${t.time || '00:00'}`);
    return new Date(0);
}

// Para costos de ticket (mano de obra/repuestos), el período que importa es cuándo se
// concretó el trabajo, no cuándo se reportó — closedAt > resolvedAt > fecha de creación.
function ticketCostDate(t: Ticket): Date {
    if (t.closedAt) return new Date(t.closedAt);
    if (t.resolvedAt) return new Date(t.resolvedAt);
    return ticketDate(t);
}

function mondayOf(d: Date): string {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date.toISOString().split('T')[0];
}

export function periodKeyForDate(d: Date, granularity: Granularity): string {
    if (isNaN(d.getTime())) return 'Desconocido';
    if (granularity === 'semana') return mondayOf(d);
    if (granularity === 'año') return String(d.getFullYear());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// reading.totalAmount incluye IVA (ver calculateBilling en domain/reading/billing.ts:
// total = netCost + ivaCost - creditNote + debitNote) — el IVA cobrado es de AFIP, no
// ingreso de la empresa. Toda estadística de "ingresos" debe usar esto, no totalAmount
// directo, o queda inflada ~21% en cualquier lectura con applyIva=true.
export function netRevenue(r: Reading): number {
    return (Number(r.totalAmount) || 0) - (Number(r.ivaAmount) || 0);
}

// ---------------------------------------------------------------------------
// Resumen General
// ---------------------------------------------------------------------------

export interface OverallKpis {
    totalVolume: number;
    totalRevenue: number;
    totalCollected: number;
    totalTickets: number;
    totalPartsUsedCost: number;
}

export function getOverallKpis(readings: Reading[], tickets: Ticket[]): OverallKpis {
    let totalVolume = 0;
    let totalRevenue = 0;
    let totalCollected = 0;
    let totalPartsUsedCost = 0;

    readings.forEach(r => {
        totalVolume += Math.max(0, (Number(r.final) || 0) - (Number(r.initial) || 0));
        totalRevenue += netRevenue(r);
        totalCollected += Number(r.paymentAmount) || 0;
    });

    tickets.forEach(t => {
        (t.partsUsedItems || []).forEach(p => {
            totalPartsUsedCost += (Number(p.cantidad) || 0) * (Number(p.costoUnitario) || 0);
        });
    });

    return { totalVolume, totalRevenue, totalCollected, totalTickets: tickets.length, totalPartsUsedCost };
}

export interface MonthBucket {
    month: string;
    volume: number;
    revenue: number;
    collected: number;
}

export function getVolumeByMonth(readings: Reading[]): MonthBucket[] {
    const map = new Map<string, MonthBucket>();
    readings.forEach(r => {
        const key = r.month || 'Desconocido';
        const bucket = map.get(key) || { month: key, volume: 0, revenue: 0, collected: 0 };
        bucket.volume += Math.max(0, (Number(r.final) || 0) - (Number(r.initial) || 0));
        bucket.revenue += netRevenue(r);
        bucket.collected += Number(r.paymentAmount) || 0;
        map.set(key, bucket);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export interface StrongestMonth {
    monthIndex: number;
    monthName: string;
    avgVolume: number;
    yearsCounted: number;
}

// Estacionalidad: promedio de volumen por nombre de mes calendario a través de todos
// los años presentes en los datos (no una serie cronológica) — requiere al menos 2
// años distintos para ser un indicador real, si no siempre "gana" el único año cargado.
export function getStrongestMonths(readings: Reading[]): { months: StrongestMonth[]; hasEnoughData: boolean } {
    const byMonthIndex = new Map<number, { total: number; years: Set<string> }>();
    const allYears = new Set<string>();

    readings.forEach(r => {
        if (!r.month || !r.month.includes('-')) return;
        const [year, monthStr] = r.month.split('-');
        const idx = parseInt(monthStr, 10) - 1;
        if (idx < 0 || idx > 11) return;
        allYears.add(year);
        const entry = byMonthIndex.get(idx) || { total: 0, years: new Set<string>() };
        entry.total += Math.max(0, (Number(r.final) || 0) - (Number(r.initial) || 0));
        entry.years.add(year);
        byMonthIndex.set(idx, entry);
    });

    const months: StrongestMonth[] = Array.from(byMonthIndex.entries()).map(([idx, v]) => ({
        monthIndex: idx,
        monthName: MONTH_NAMES[idx],
        avgVolume: v.years.size > 0 ? Math.round(v.total / v.years.size) : 0,
        yearsCounted: v.years.size,
    })).sort((a, b) => b.avgVolume - a.avgVolume);

    return { months, hasEnoughData: allYears.size >= 2 };
}

// ---------------------------------------------------------------------------
// Por Cliente
// ---------------------------------------------------------------------------

export interface ClientStat {
    client: Client;
    volume: number;
    revenue: number;
    collected: number;
    ticketCount: number;
    partsCost: number;
}

export function getStatsByClient(clients: Client[], readings: Reading[], machines: Machine[], tickets: Ticket[]): ClientStat[] {
    return clients.map(client => {
        const clientReadings = getClientReadings(client, readings, machines);
        const volume = clientReadings.reduce((acc, r) => acc + Math.max(0, (Number(r.final) || 0) - (Number(r.initial) || 0)), 0);
        const revenue = clientReadings.reduce((acc, r) => acc + netRevenue(r), 0);
        const collected = clientReadings.reduce((acc, r) => acc + (Number(r.paymentAmount) || 0), 0);

        const clientTickets = tickets.filter(t => t.clientType === 'existente' && t.clientId === client.id);
        const partsCost = clientTickets.reduce((acc, t) => acc + (t.partsUsedItems || []).reduce((s, p) => s + (Number(p.cantidad) || 0) * (Number(p.costoUnitario) || 0), 0), 0);

        return { client, volume, revenue, collected, ticketCount: clientTickets.length, partsCost };
    });
}

// ---------------------------------------------------------------------------
// Tendencias Temporales (tickets/pagos — sí soportan semana)
// ---------------------------------------------------------------------------

export interface TrendPoint { periodKey: string; count: number; total: number }

export function getTicketsTrend(tickets: Ticket[], granularity: Granularity): TrendPoint[] {
    const map = new Map<string, TrendPoint>();
    tickets.forEach(t => {
        const key = periodKeyForDate(ticketDate(t), granularity);
        const point = map.get(key) || { periodKey: key, count: 0, total: 0 };
        point.count += 1;
        point.total += Number(t.technicalCost) || 0;
        map.set(key, point);
    });
    return Array.from(map.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey));
}

export function getPaymentsTrend(payments: Payment[], granularity: Granularity): TrendPoint[] {
    const map = new Map<string, TrendPoint>();
    payments.forEach(p => {
        const key = periodKeyForDate(new Date(`${p.date}T00:00`), granularity);
        const point = map.get(key) || { periodKey: key, count: 0, total: 0 };
        point.count += 1;
        point.total += Number(p.amount) || 0;
        map.set(key, point);
    });
    return Array.from(map.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey));
}

// ---------------------------------------------------------------------------
// Servicio Técnico
// ---------------------------------------------------------------------------

export interface ClientTicketRank { client: Client; ticketCount: number }

export function getClientsByTicketVolume(clients: Client[], tickets: Ticket[]): ClientTicketRank[] {
    return clients
        .map(client => ({ client, ticketCount: tickets.filter(t => t.clientType === 'existente' && t.clientId === client.id).length }))
        .filter(r => r.ticketCount > 0)
        .sort((a, b) => b.ticketCount - a.ticketCount);
}

export interface TechnicianStat {
    user: User;
    totalAssigned: number;
    resolvedCount: number;
    complianceRate: number;
    avgResolutionHours: number;
    totalCost: number;
}

// Mismo criterio de cumplimiento de SLA y tiempo de resolución que getTechMetrics() en
// tecnica/page.tsx (resolvedAt <= slaDate, resolutionTime = resolvedAt - createdAt), pero
// como función pura reutilizable — no se refactoriza la de tecnica/page.tsx para no tocar
// código ya probado fuera del alcance de esta feature.
export function getTechnicianStats(users: User[], tickets: Ticket[]): TechnicianStat[] {
    return users.filter(u => u.role === 'tecnico').map(user => {
        const techTickets = tickets.filter(t => t.assignedTechId === user.id);
        const resolvedTickets = techTickets.filter(t => ['resuelto', 'cerrado'].includes(t.status));

        let slaCompliantCount = 0;
        let totalResolutionMs = 0;
        let totalCost = 0;

        resolvedTickets.forEach(t => {
            if (t.resolvedAt && t.slaDate && new Date(t.resolvedAt) <= new Date(t.slaDate)) slaCompliantCount++;
            const created = t.createdAt || ticketDate(t).getTime();
            if (t.resolvedAt && !isNaN(created)) totalResolutionMs += (t.resolvedAt - created);
        });

        techTickets.forEach(t => {
            totalCost += Number(t.technicalCost) || 0;
            totalCost += (t.partsUsedItems || []).reduce((s, p) => s + (Number(p.cantidad) || 0) * (Number(p.costoUnitario) || 0), 0);
        });

        const resolvedCount = resolvedTickets.length;
        return {
            user,
            totalAssigned: techTickets.length,
            resolvedCount,
            complianceRate: resolvedCount > 0 ? Math.round((slaCompliantCount / resolvedCount) * 100) : 100,
            avgResolutionHours: resolvedCount > 0 ? Math.round((totalResolutionMs / (1000 * 60 * 60 * resolvedCount)) * 10) / 10 : 0,
            totalCost,
        };
    }).filter(t => t.totalAssigned > 0);
}

export interface CategoryBucket { category: string; count: number }

export function getTicketCategoryBreakdown(tickets: Ticket[]): CategoryBucket[] {
    const map = new Map<string, number>();
    tickets.forEach(t => {
        const key = t.category || 'Sin categoría';
        map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Insumos y Repuestos
// ---------------------------------------------------------------------------

export interface PartUsageStat {
    catalogId: string;
    nombre: string;
    categoria: string;
    totalQty: number;
    totalCost: number;
    ticketCount: number;
}

export function getPartsUsageStats(tickets: Ticket[]): PartUsageStat[] {
    const map = new Map<string, PartUsageStat>();
    tickets.forEach(t => {
        const seenInThisTicket = new Set<string>();
        (t.partsUsedItems || []).forEach(p => {
            const entry = map.get(p.catalogId) || { catalogId: p.catalogId, nombre: p.nombre, categoria: p.categoria, totalQty: 0, totalCost: 0, ticketCount: 0 };
            entry.totalQty += Number(p.cantidad) || 0;
            entry.totalCost += (Number(p.cantidad) || 0) * (Number(p.costoUnitario) || 0);
            if (!seenInThisTicket.has(p.catalogId)) {
                entry.ticketCount += 1;
                seenInThisTicket.add(p.catalogId);
            }
            map.set(p.catalogId, entry);
        });
    });
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
}

export function getLowStockItems(catalog: PartCatalogItem[]): PartCatalogItem[] {
    return catalog.filter(c => c.activo !== false && c.stockActual <= c.stockMinimo);
}

// ---------------------------------------------------------------------------
// Otros Indicadores
// ---------------------------------------------------------------------------

export interface AgingBuckets {
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90plus: number;
}

// Snapshot actual de mora por antigüedad — no una serie histórica, la base no guarda
// estados de deuda pasados, solo el estado presente de cada lectura/cliente.
export function getAgingSnapshot(clients: Client[], readings: Reading[], machines: Machine[], payments: Payment[]): AgingBuckets {
    const buckets: AgingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    clients.forEach(client => {
        const summary = getClientFinancialSummaryHelper(client, readings, machines, payments);
        if (summary.saldo <= 0.01) return;
        const overdue = summary.vencido || 0;
        const current = Math.max(0, summary.saldo - overdue);
        buckets.current += current;
        const days = summary.maxMora || 0;
        if (overdue <= 0) return;
        if (days <= 30) buckets.d1_30 += overdue;
        else if (days <= 60) buckets.d31_60 += overdue;
        else if (days <= 90) buckets.d61_90 += overdue;
        else buckets.d90plus += overdue;
    });
    return buckets;
}

// Etapa 4: amortización lineal (costoAdquisición ÷ vidaÚtilMeses), cortada sola una vez
// agotada la vida útil — nunca sigue descontando después. Los 3 campos son "todo o nada":
// si falta cualquiera, no hay amortización calculable (0 meses, no "se asume $0 de costo").
function getMonthlyAmortization(machine: Machine): number | null {
    if (machine.acquisitionCost == null || machine.usefulLifeMonths == null || !machine.acquisitionDate) return null;
    if (machine.usefulLifeMonths <= 0 || machine.acquisitionCost <= 0) return null;
    return machine.acquisitionCost / machine.usefulLifeMonths;
}

function monthDiff(fromMonthStr: string, toMonthStr: string): number {
    const [fy, fm] = fromMonthStr.split('-').map(Number);
    const [ty, tm] = toMonthStr.split('-').map(Number);
    return (ty - fy) * 12 + (tm - fm);
}

// Meses amortizables dentro de un período (mes: 0 ó 1; año: 0 a 12) según la ventana
// [fechaAdquisición, fechaAdquisición + vidaÚtilMeses) — el mes de adquisición ya cuenta
// como el primer mes amortizado.
function amortizedMonthsInPeriod(machine: Machine, granularity: 'mes' | 'año', periodValue: string): number {
    if (!machine.acquisitionDate || machine.usefulLifeMonths == null) return 0;
    const acquisitionMonth = machine.acquisitionDate.slice(0, 7);
    if (granularity === 'mes') {
        const diff = monthDiff(acquisitionMonth, periodValue);
        return (diff >= 0 && diff < machine.usefulLifeMonths) ? 1 : 0;
    }
    let count = 0;
    for (let m = 1; m <= 12; m++) {
        const diff = monthDiff(acquisitionMonth, `${periodValue}-${String(m).padStart(2, '0')}`);
        if (diff >= 0 && diff < machine.usefulLifeMonths) count++;
    }
    return count;
}

// Meses amortizados de por vida, hasta hoy, tope en vidaÚtilMeses (no sigue después de
// agotada la vida útil del bien).
function amortizedMonthsLifetime(machine: Machine): number {
    if (!machine.acquisitionDate || machine.usefulLifeMonths == null) return 0;
    const acquisitionMonth = machine.acquisitionDate.slice(0, 7);
    const nowMonth = new Date().toISOString().slice(0, 7);
    const elapsed = monthDiff(acquisitionMonth, nowMonth) + 1;
    return Math.max(0, Math.min(elapsed, machine.usefulLifeMonths));
}

// Etapa 6 del plan de rentabilidad: costo de insumos por copia. 'real' = al menos un
// casillero de consumible (tóner/módulo de imagen/fusor) tiene un ítem de catálogo con
// rendimiento cargado — se suma el costo/copia de cada casillero válido. 'manual' = sin
// casilleros reales, pero existe el placeholder de la Etapa 1 (costoPorCopiaInsumos).
// 'none' = sin ningún dato — nunca se asume $0 silenciosamente, la UI debe mostrar "s/d".
export type ConsumablesCostSource = 'real' | 'manual' | 'none';

export interface ConsumablesCostResult {
    costPerCopy: number;
    source: ConsumablesCostSource;
}

export function getConsumablesCostPerCopy(machine: Machine, catalog: PartCatalogItem[]): ConsumablesCostResult {
    const slotCatalogIds = [machine.tonerCatalogId, machine.imageUnitCatalogId, machine.fuserCatalogId];
    let realCostPerCopy = 0;
    let hasRealSlot = false;
    for (const catalogId of slotCatalogIds) {
        if (!catalogId) continue;
        const item = catalog.find(c => c.id === catalogId);
        if (!item || item.rendimientoCopias == null || item.rendimientoCopias <= 0) continue;
        hasRealSlot = true;
        realCostPerCopy += (Number(item.costoUnitario) || 0) / item.rendimientoCopias;
    }
    if (hasRealSlot) return { costPerCopy: realCostPerCopy, source: 'real' };
    if (machine.costoPorCopiaInsumos != null) return { costPerCopy: machine.costoPorCopiaInsumos, source: 'manual' };
    return { costPerCopy: 0, source: 'none' };
}

export interface MachineProfitability {
    machine: Machine;
    volume: number;
    revenue: number;
    technicalCost: number;
    partsCost: number;
    consumablesCost: number;
    hasConsumablesCostData: boolean;
    consumablesCostSource: ConsumablesCostSource;
    netProfit: number;
    // Etapa 4: amortización acumulada de por vida (hasta hoy, tope en vidaÚtilMeses) y el
    // resultado ya neto de ella. hasAmortizationData=false ⇒ netAccountingResult es null,
    // no se mezcla con máquinas sin costo/fecha/vida útil cargados.
    hasAmortizationData: boolean;
    amortization: number;
    netAccountingResult: number | null;
}

export function getMachineProfitability(machines: Machine[], readings: Reading[], tickets: Ticket[], catalog: PartCatalogItem[]): MachineProfitability[] {
    return machines.map(machine => {
        const machineReadings = readings.filter(r => r.machineId === machine.id);
        const volume = machineReadings.reduce((acc, r) => acc + Math.max(0, (Number(r.final) || 0) - (Number(r.initial) || 0)), 0);
        const revenue = machineReadings.reduce((acc, r) => acc + netRevenue(r), 0);

        const machineTickets = tickets.filter(t => t.machineId === machine.id);
        const technicalCost = machineTickets.reduce((acc, t) => acc + (Number(t.technicalCost) || 0), 0);
        const partsCost = machineTickets.reduce((acc, t) => acc + (t.partsUsedItems || []).reduce((s, p) => s + (Number(p.cantidad) || 0) * (Number(p.costoUnitario) || 0), 0), 0);

        const consumablesResult = getConsumablesCostPerCopy(machine, catalog);
        const hasConsumablesCostData = consumablesResult.source !== 'none';
        const consumablesCost = hasConsumablesCostData ? volume * consumablesResult.costPerCopy : 0;

        const netProfit = revenue - technicalCost - partsCost - consumablesCost;
        const monthlyAmortization = getMonthlyAmortization(machine);
        const hasAmortizationData = monthlyAmortization != null;
        const amortization = hasAmortizationData ? monthlyAmortization! * amortizedMonthsLifetime(machine) : 0;
        const netAccountingResult = hasAmortizationData ? netProfit - amortization : null;

        return { machine, volume, revenue, technicalCost, partsCost, consumablesCost, hasConsumablesCostData, consumablesCostSource: consumablesResult.source, netProfit, hasAmortizationData, amortization, netAccountingResult };
    // Una máquina con datos de adquisición cargados siempre aparece, aunque todavía no
    // tenga lecturas ni tickets — su amortización ya es un costo real del negocio desde
    // el primer mes, no debería quedar invisible solo por no tener actividad todavía.
    }).filter(m => m.revenue > 0 || m.technicalCost > 0 || m.partsCost > 0 || m.hasAmortizationData);
}

export interface MachineProfitabilityPeriod {
    machine: Machine;
    period: string;
    volume: number;
    revenueAccrual: number;
    revenueCash: number;
    laborCost: number;
    partsCost: number;
    consumablesCost: number;
    // false cuando no hay ni consumibles reales (Etapa 6) ni el placeholder manual (Etapa
    // 1) — consumablesCost queda en 0 en ese caso, pero NO hay que leerlo como "sin costo
    // de insumos": es "sin dato". consumablesCostSource distingue real vs manual vs s/d.
    hasConsumablesCostData: boolean;
    consumablesCostSource: ConsumablesCostSource;
    operatingResult: number;
    // Etapa 4: amortización del período (0 si la máquina no tiene datos de adquisición
    // cargados, o si el período cae fuera de la ventana de vida útil) y el resultado neto
    // contable resultante. hasAmortizationData=false ⇒ netAccountingResult es null.
    hasAmortizationData: boolean;
    amortization: number;
    netAccountingResult: number | null;
}

// Rentabilidad de la Etapa 1 del plan: corte mensual/anual (reading.month para ingresos,
// ticketCostDate para costos de tickets), devengado y cobrado por separado, y un costo de
// insumos estimado vía el campo manual Machine.costoPorCopiaInsumos — placeholder honesto
// hasta que la Etapa 6 calcule esto por rendimiento real de tóner/módulo/fusor.
export function getMachineProfitabilityByPeriod(
    machines: Machine[],
    readings: Reading[],
    tickets: Ticket[],
    catalog: PartCatalogItem[],
    granularity: 'mes' | 'año',
    periodValue: string
): MachineProfitabilityPeriod[] {
    const matchesPeriod = (month: string | undefined) => {
        if (!month) return false;
        return granularity === 'mes' ? month === periodValue : month.slice(0, 4) === periodValue;
    };

    return machines.map(machine => {
        const machineReadings = readings.filter(r => r.machineId === machine.id && matchesPeriod(r.month));
        const volume = machineReadings.reduce((acc, r) => acc + Math.max(0, (Number(r.final) || 0) - (Number(r.initial) || 0)), 0);
        const revenueAccrual = machineReadings.reduce((acc, r) => acc + netRevenue(r), 0);
        const revenueCash = machineReadings.reduce((acc, r) => acc + (Number(r.paymentAmount) || 0), 0);

        const machineTickets = tickets.filter(t => t.machineId === machine.id && periodKeyForDate(ticketCostDate(t), granularity) === periodValue);
        const laborCost = machineTickets.reduce((acc, t) => acc + (Number(t.technicalCost) || 0), 0);
        const partsCost = machineTickets.reduce((acc, t) => acc + (t.partsUsedItems || []).reduce((s, p) => s + (Number(p.cantidad) || 0) * (Number(p.costoUnitario) || 0), 0), 0);

        const consumablesResult = getConsumablesCostPerCopy(machine, catalog);
        const hasConsumablesCostData = consumablesResult.source !== 'none';
        const consumablesCost = hasConsumablesCostData ? volume * consumablesResult.costPerCopy : 0;

        const operatingResult = revenueAccrual - laborCost - partsCost - consumablesCost;

        const monthlyAmortization = getMonthlyAmortization(machine);
        const hasAmortizationData = monthlyAmortization != null;
        const amortization = hasAmortizationData ? monthlyAmortization! * amortizedMonthsInPeriod(machine, granularity, periodValue) : 0;
        const netAccountingResult = hasAmortizationData ? operatingResult - amortization : null;

        return { machine, period: periodValue, volume, revenueAccrual, revenueCash, laborCost, partsCost, consumablesCost, hasConsumablesCostData, consumablesCostSource: consumablesResult.source, operatingResult, hasAmortizationData, amortization, netAccountingResult };
    }).filter(m => m.revenueAccrual > 0 || m.laborCost > 0 || m.partsCost > 0 || m.volume > 0 || m.hasAmortizationData);
}

// Meses amortizables dentro de un rango de fechas arbitrario (usado por contrato de
// alquiler, Etapa 5) — misma ventana [fechaAdquisición, fechaAdquisición + vidaÚtilMeses)
// que amortizedMonthsInPeriod, pero recorriendo mes a mes entre dos fechas en vez de un
// único período de calendario.
function amortizedMonthsInDateRange(machine: Machine, startDateStr: string, endDateStr: string): number {
    if (!machine.acquisitionDate || machine.usefulLifeMonths == null) return 0;
    const acquisitionMonth = machine.acquisitionDate.slice(0, 7);
    let [y, m] = startDateStr.slice(0, 7).split('-').map(Number);
    const [endY, endM] = endDateStr.slice(0, 7).split('-').map(Number);
    let count = 0;
    while (y < endY || (y === endY && m <= endM)) {
        const diff = monthDiff(acquisitionMonth, `${y}-${String(m).padStart(2, '0')}`);
        if (diff >= 0 && diff < machine.usefulLifeMonths) count++;
        m++;
        if (m > 12) { m = 1; y++; }
    }
    return count;
}

export interface RentalProfitability {
    rental: Rental;
    machine: Machine | undefined;
    volume: number;
    revenueAccrual: number;
    revenueCash: number;
    laborCost: number;
    partsCost: number;
    consumablesCost: number;
    hasConsumablesCostData: boolean;
    consumablesCostSource: ConsumablesCostSource;
    operatingResult: number;
    hasAmortizationData: boolean;
    amortization: number;
    netAccountingResult: number | null;
}

// Etapa 5 del plan: rentabilidad por CONTRATO de alquiler, no por máquina — mismas
// fórmulas que getMachineProfitabilityByPeriod, pero la ventana de fechas es la del
// contrato mismo (rental.startDate a rental.endDate, o hasta hoy si sigue activo), no un
// período de calendario. Así se ve qué tan rentable fue CADA cliente que tuvo esa máquina,
// no solo la máquina en general — un equipo reasignado entre clientes deja de mezclar sus
// historiales en un solo número.
export function getRentalProfitability(rentals: Rental[], readings: Reading[], tickets: Ticket[], machines: Machine[], catalog: PartCatalogItem[]): RentalProfitability[] {
    const todayStr = new Date().toISOString().split('T')[0];

    return rentals.map(rental => {
        const machine = machines.find(m => m.id === rental.machineId);
        const startMonth = rental.startDate.slice(0, 7);
        const endDate = rental.endDate || todayStr;
        const endMonth = endDate.slice(0, 7);

        const rentalReadings = readings.filter(r => r.machineId === rental.machineId && r.month >= startMonth && r.month <= endMonth);
        const volume = rentalReadings.reduce((acc, r) => acc + Math.max(0, (Number(r.final) || 0) - (Number(r.initial) || 0)), 0);
        const revenueAccrual = rentalReadings.reduce((acc, r) => acc + netRevenue(r), 0);
        const revenueCash = rentalReadings.reduce((acc, r) => acc + (Number(r.paymentAmount) || 0), 0);

        const startBound = new Date(`${rental.startDate}T00:00:00`);
        const endBound = new Date(`${endDate}T23:59:59`);
        const rentalTickets = tickets.filter(t => {
            if (t.machineId !== rental.machineId) return false;
            const d = ticketCostDate(t);
            return d >= startBound && d <= endBound;
        });
        const laborCost = rentalTickets.reduce((acc, t) => acc + (Number(t.technicalCost) || 0), 0);
        const partsCost = rentalTickets.reduce((acc, t) => acc + (t.partsUsedItems || []).reduce((s, p) => s + (Number(p.cantidad) || 0) * (Number(p.costoUnitario) || 0), 0), 0);

        const consumablesResult = machine ? getConsumablesCostPerCopy(machine, catalog) : { costPerCopy: 0, source: 'none' as ConsumablesCostSource };
        const hasConsumablesCostData = consumablesResult.source !== 'none';
        const consumablesCost = hasConsumablesCostData ? volume * consumablesResult.costPerCopy : 0;

        const operatingResult = revenueAccrual - laborCost - partsCost - consumablesCost;

        const monthlyAmortization = machine ? getMonthlyAmortization(machine) : null;
        const hasAmortizationData = monthlyAmortization != null;
        const amortization = (hasAmortizationData && machine) ? monthlyAmortization! * amortizedMonthsInDateRange(machine, rental.startDate, endDate) : 0;
        const netAccountingResult = hasAmortizationData ? operatingResult - amortization : null;

        return { rental, machine, volume, revenueAccrual, revenueCash, laborCost, partsCost, consumablesCost, hasConsumablesCostData, consumablesCostSource: consumablesResult.source, operatingResult, hasAmortizationData, amortization, netAccountingResult };
    })
        .filter(r => r.revenueAccrual > 0 || r.laborCost > 0 || r.partsCost > 0 || r.volume > 0 || r.hasAmortizationData)
        .sort((a, b) => b.operatingResult - a.operatingResult);
}

export interface BusinessResult {
    period: string;
    totalOperatingResult: number;
    totalGastosGenerales: number;
    totalVentasMargin: number;
    businessResult: number;
}

// Etapa 2/3 del plan: resultado del negocio total en el período = suma de resultadoOperativo
// de TODAS las máquinas (incluso las que no aparecen en getMachineProfitabilityByPeriod por
// no tener actividad ese período — no aportan nada, no hace falta filtrarlas de nuevo) más el
// margen (precioVenta - costoVenta) de las ventas del período, menos los gastos generales del
// mismo período. Deliberadamente NO prorrateado por máquina — ver nota de diseño en el plan
// sobre por qué inventar una clave de reparto sería arbitraria.
export function getBusinessResult(
    machines: Machine[],
    readings: Reading[],
    tickets: Ticket[],
    catalog: PartCatalogItem[],
    gastos: GastoGeneral[],
    ventas: Venta[],
    granularity: 'mes' | 'año',
    periodValue: string
): BusinessResult {
    const machineResults = getMachineProfitabilityByPeriod(machines, readings, tickets, catalog, granularity, periodValue);
    const totalOperatingResult = machineResults.reduce((acc, m) => acc + m.operatingResult, 0);

    const totalGastosGenerales = gastos
        .filter(g => g.fecha && periodKeyForDate(new Date(`${g.fecha}T00:00`), granularity) === periodValue)
        .reduce((acc, g) => acc + (Number(g.monto) || 0), 0);

    // precioVenta/costoVenta son montos totales de la línea de venta (no por unidad) — ver
    // comentario en el formulario de /finanzas sobre por qué se decidió así.
    const totalVentasMargin = ventas
        .filter(v => v.fecha && periodKeyForDate(new Date(`${v.fecha}T00:00`), granularity) === periodValue)
        .reduce((acc, v) => acc + ((Number(v.precioVenta) || 0) - (Number(v.costoVenta) || 0)), 0);

    return {
        period: periodValue,
        totalOperatingResult,
        totalGastosGenerales,
        totalVentasMargin,
        businessResult: totalOperatingResult + totalVentasMargin - totalGastosGenerales,
    };
}

export interface ClientConcentration {
    topShare: number;
    top: { client: Client; revenue: number; share: number }[];
}

export function getClientConcentration(clients: Client[], readings: Reading[], machines: Machine[], topN: number = 5): ClientConcentration {
    const revenues = clients.map(client => ({
        client,
        revenue: getClientReadings(client, readings, machines).reduce((acc, r) => acc + netRevenue(r), 0),
    })).filter(c => c.revenue > 0).sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = revenues.reduce((acc, c) => acc + c.revenue, 0);
    const top = revenues.slice(0, topN).map(c => ({ ...c, share: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 1000) / 10 : 0 }));
    const topShare = top.reduce((acc, c) => acc + c.share, 0);

    return { topShare, top };
}

export interface InactiveClient { client: Client; lastReadingMonth: string | null; daysSinceLastReading: number | null }

export function getInactiveClients(clients: Client[], rentals: Rental[], readings: Reading[], machines: Machine[], thresholdDays: number = 60): InactiveClient[] {
    const now = new Date();
    return clients
        .filter(client => rentals.some(r => r.clientId === client.id && r.status === 'activo'))
        .map(client => {
            const clientReadings = getClientReadings(client, readings, machines);
            if (clientReadings.length === 0) return { client, lastReadingMonth: null, daysSinceLastReading: null };
            const lastMonth = clientReadings.map(r => r.month).sort().pop() || null;
            if (!lastMonth) return { client, lastReadingMonth: null, daysSinceLastReading: null };
            const lastDate = new Date(`${lastMonth}-01T00:00:00`);
            const days = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            return { client, lastReadingMonth: lastMonth, daysSinceLastReading: days };
        })
        .filter(c => c.daysSinceLastReading === null || c.daysSinceLastReading >= thresholdDays)
        .sort((a, b) => (b.daysSinceLastReading || 999) - (a.daysSinceLastReading || 999));
}

export interface MeterGrowthSignal { client: Client; machine: Machine; avgRecentVolume: number; limit: number; signal: 'upsell' | 'downgrade' | 'normal' }

// Señal simple de upsell/downgrade: promedio de los últimos 3 meses cargados vs. el
// límite del abono asignado a la máquina — no una proyección estadística, solo un
// indicador para que el negocio revise manualmente los casos marcados.
export function getMeterGrowthSignal(machines: Machine[], clients: Client[], readings: Reading[], abonos: Abono[]): MeterGrowthSignal[] {
    const results: MeterGrowthSignal[] = [];
    machines.forEach(machine => {
        if (!machine.clientId || !machine.abonoId) return;
        const client = clients.find(c => c.id === machine.clientId);
        const abono = abonos.find(a => a.id === machine.abonoId);
        if (!client || !abono || !abono.limit) return;

        const machineReadings = readings
            .filter(r => r.machineId === machine.id)
            .sort((a, b) => b.month.localeCompare(a.month))
            .slice(0, 3);
        if (machineReadings.length === 0) return;

        const avgRecentVolume = Math.round(machineReadings.reduce((acc, r) => acc + Math.max(0, (Number(r.final) || 0) - (Number(r.initial) || 0)), 0) / machineReadings.length);

        let signal: 'upsell' | 'downgrade' | 'normal' = 'normal';
        if (avgRecentVolume > abono.limit * 1.2) signal = 'upsell';
        else if (avgRecentVolume < abono.limit * 0.4) signal = 'downgrade';

        if (signal !== 'normal') results.push({ client, machine, avgRecentVolume, limit: abono.limit, signal });
    });
    return results;
}
