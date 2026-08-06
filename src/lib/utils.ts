import { Client, Ticket, Reading, Machine } from './mockData';
import type { Gestion, Payment } from '@/domain/types';

// Helper to merge tailwind class names
export function cn(...inputs: (string | undefined | null | boolean | { [key: string]: boolean })[]) {
    const classes: string[] = [];
    inputs.forEach(input => {
        if (!input) return;
        if (typeof input === 'string') {
            classes.push(input);
        } else if (typeof input === 'object') {
            Object.keys(input).forEach(key => {
                if (input[key]) {
                    classes.push(key);
                }
            });
        }
    });
    return classes.join(' ');
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(value);
}

export function formatPeriod(periodStr: string): string {
    if (!periodStr || !periodStr.includes('-')) return periodStr;
    const [year, month] = periodStr.split('-');
    const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${months[mIdx] || ''} de ${year}`;
}

export function isTicketOverdue(ticket: Ticket): boolean {
    if (ticket.status === 'resuelto' || ticket.status === 'cerrado' || !ticket.slaDate) return false;
    const sla = new Date(`${ticket.slaDate}T23:59:59`);
    return sla < new Date();
}

export function getClientIvaRate(taxCategory: string): number {
    // Under Argentine tax rules:
    // Exento/Monotributista do not get discriminative VAT, but if we are Resp Inscripto, we invoice standard 21%
    if (taxCategory === 'Responsable Inscripto') {
        return 21;
    }
    return 0; // Exento or Monotributista
}

export function playSystemSound(type: 'pago' | 'deudor' | 'vencido' | 'critico' | 'regularizado' | 'recordatorio', config: { sonidosActivos: boolean; volumenSonidos: number }) {
    if (typeof window === 'undefined' || !config.sonidosActivos || config.volumenSonidos === 0) return;
    
    try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const vol = (config.volumenSonidos / 100) * 0.12; // Gentle scale factor
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        
        if (type === 'pago') {
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
            osc.start();
            osc.stop(ctx.currentTime + 0.45);
        } else if (type === 'regularizado') {
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08); // A5
            osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.16); // D6
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } else if (type === 'deudor') {
            osc.frequency.setValueAtTime(349.23, ctx.currentTime); // F4
            osc.frequency.setValueAtTime(293.66, ctx.currentTime + 0.12); // D4
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } else if (type === 'vencido') {
            osc.frequency.setValueAtTime(440.00, ctx.currentTime); // A4
            osc.frequency.setValueAtTime(0, ctx.currentTime + 0.06); 
            osc.frequency.setValueAtTime(440.00, ctx.currentTime + 0.1); 
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } else if (type === 'critico') {
            osc.frequency.setValueAtTime(220.00, ctx.currentTime); // A3
            osc.frequency.linearRampToValueAtTime(165.01, ctx.currentTime + 0.25); // E3
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } else if (type === 'recordatorio') {
            osc.frequency.setValueAtTime(880.00, ctx.currentTime); // A5
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
            osc.start();
            osc.stop(ctx.currentTime + 0.2);
        }
    } catch (error) {
        console.warn('Audio play error:', error);
    }
}

export function getDaysOverdue(dueDateStr: string): number {
    if (!dueDateStr) return 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueParts = dueDateStr.split('-');
    const due = new Date(parseInt(dueParts[0], 10), parseInt(dueParts[1], 10) - 1, parseInt(dueParts[2], 10));
    if (isNaN(due.getTime()) || due.getTime() >= today.getTime()) return 0;
    const diffTime = today.getTime() - due.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export interface ClientMovement {
    id: string;
    date: string;
    type: string;
    number: string;
    period: string;
    concept: string;
    original: number;
    paid: number;
    pending: number;
    dueDate: string;
    status: string;
    daysOverdue: number;
    notes: string;
    method?: string;
    receivedBy?: string;
}

// Readings billed to this client — prefers the reading's own clientId snapshot (captured at
// creation time in lecturas/page.tsx, so it keeps pointing at the client that was actually
// billed even if the machine is later reassigned to someone else) and only falls back to the
// machine's current clientId for legacy readings that predate that field.
export function getClientReadings(client: Client, readings: Reading[], machines: Machine[]): Reading[] {
    return readings.filter(r => {
        if (r.clientId) return r.clientId === client.id;
        const mach = machines.find(m => m.id === r.machineId);
        return mach && mach.clientId === client.id;
    });
}

// The inverse lookup of getClientReadings: the client a single reading is billed to. Same
// clientId-snapshot-first priority, so a reassigned machine doesn't retroactively change who
// old readings are attributed to.
export function getReadingClient(reading: Reading, clients: Client[], machines: Machine[]): Client | undefined {
    if (reading.clientId) return clients.find(c => c.id === reading.clientId);
    const mach = machines.find(m => m.id === reading.machineId);
    return mach ? clients.find(c => c.id === mach.clientId) : undefined;
}

export function getClientMovementsHelper(client: Client, readings: Reading[], machines: Machine[], payments: Payment[] = []): ClientMovement[] {
    const clientReadings = getClientReadings(client, readings, machines);

    const movements: ClientMovement[] = [];

    // Map readings as Facturas & Recibos.
    // IMPORTANT: `collectionStatus` (persisted in Turso) is the source of truth for whether
    // a reading is paid — NOT the old `Reading.status` field, which was never part of the DB
    // schema or the sync schema and therefore never actually persisted (always undefined after
    // any reload/sync). `paymentAmount` lets a 'Parcial' payment show correctly instead of
    // being treated as all-or-nothing.
    clientReadings.forEach(r => {
        const totalAmt = Number(r.totalAmount) || 0;
        const paidAmt = Number((r as any).paymentAmount) || 0;
        const isFullyPaid = r.collectionStatus === 'Pagado';
        const isPartial = !isFullyPaid && (r.collectionStatus === 'Parcial' || paidAmt > 0);
        const pendingAmt = isFullyPaid ? 0 : Math.max(0, totalAmt - paidAmt);
        const paidForDisplay = isFullyPaid ? totalAmt : paidAmt;

        const invoiceDate = `${r.month}-01`;
        const dueDate = `${r.month}-15`;
        const days = isFullyPaid ? 0 : getDaysOverdue(dueDate);
        // Overdue takes priority over "Parcial" — a partially-paid invoice that's also past
        // its due date still needs to count as mora, not just get an informational label.
        const status = isFullyPaid ? 'Pagado' : (days > 0 ? 'Vencido' : (isPartial ? 'Parcial' : 'Pendiente'));

        movements.push({
            id: `fact-${r.id}`,
            date: invoiceDate,
            type: 'Factura',
            number: `FC-${(r.id as string).replace('r-', '00005')}`,
            period: r.month as string,
            concept: `Abono y excedente período ${r.month}`,
            original: totalAmt,
            paid: paidForDisplay,
            pending: pendingAmt,
            dueDate: dueDate,
            status: status,
            daysOverdue: days,
            notes: (r.readingComment as string) || 'Facturación automatizada'
        });

        // Real payment transactions against this reading — one movement row per actual
        // payment record (with its own real date/method/receipt number/collector) instead
        // of a single synthesized aggregate, so installments each keep their own history.
        const readingPayments = payments.filter(p => p.readingId === r.id);
        readingPayments.forEach(p => {
            movements.push({
                id: `pay-${p.id}`,
                date: p.date,
                type: 'Recibo',
                number: p.receiptNumber,
                period: r.month as string,
                concept: `Cobro de facturación período ${r.month}`,
                original: p.amount,
                paid: p.amount,
                pending: 0,
                dueDate: '',
                status: 'Pagado',
                daysOverdue: 0,
                notes: p.notes || '',
                method: p.method,
                receivedBy: p.receivedByName
            });
        });

        // Fallback for paid amounts predating this ledger (or otherwise not backed by a
        // payments row) — keeps historical receipts visible on the statement instead of
        // silently dropping them once real payment records take over going forward.
        const coveredByLedger = readingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const uncoveredAmount = paidForDisplay - coveredByLedger;
        if (uncoveredAmount > 0.01) {
            movements.push({
                id: `rec-${r.id}`,
                date: r.paymentDate ? (r.paymentDate as string) : `${r.month}-10`,
                type: 'Recibo',
                number: `RC-${(r.id as string).replace('r-', '00005')}`,
                period: r.month as string,
                concept: `Cobro de facturación período ${r.month}`,
                original: uncoveredAmount,
                paid: uncoveredAmount,
                pending: 0,
                dueDate: '',
                status: isFullyPaid ? 'Pagado' : 'Parcial',
                daysOverdue: 0,
                notes: 'Cobro histórico (previo al registro detallado de pagos)'
            });
        }
    });

    // Saldo inicial: `client.debt` es un campo editable a mano que, en los datos actuales,
    // ya coincide con la suma de lecturas impagas de arriba. Sumarlo siempre como un
    // movimiento aparte duplicaba la deuda mostrada. Ahora solo se muestra el remanente que
    // NO está explicado por las facturas de lecturas (ajustes manuales reales).
    const pendingFromReadings = movements.reduce((acc, m) => m.type === 'Factura' ? acc + m.pending : acc, 0);
    const manualAdjustment = Math.max(0, (client.debt || 0) - pendingFromReadings);

    // Real payments made directly against the manual balance (no reading attached) — these
    // used to be completely invisible on the statement, since only readings ever got a
    // synthesized receipt.
    const adjustmentPayments = payments.filter(p => p.clientId === client.id && !p.readingId);
    adjustmentPayments.forEach(p => {
        movements.push({
            id: `pay-${p.id}`,
            date: p.date,
            type: 'Recibo',
            number: p.receiptNumber,
            period: 'Ajuste de saldo',
            concept: 'Cobro de ajuste manual de saldo',
            original: p.amount,
            paid: p.amount,
            pending: 0,
            dueDate: '',
            status: 'Pagado',
            daysOverdue: 0,
            notes: p.notes || '',
            method: p.method,
            receivedBy: p.receivedByName
        });
    });

    if (manualAdjustment > 0) {
        // Usa la fecha de alta del cliente como referencia de mora en vez de una fecha fija
        // global (que hacía crecer la mora de TODOS los clientes al mismo ritmo para siempre).
        const originDate = client.createdAt ? client.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
        const dueDate = originDate;
        movements.unshift({
            id: `init-debt-${client.id}`,
            date: originDate,
            type: 'Ajuste',
            number: 'AJ-000001',
            period: 'Saldo Inicial',
            concept: 'Ajuste manual de saldo (no explicado por lecturas facturadas)',
            original: manualAdjustment,
            paid: 0,
            pending: manualAdjustment,
            dueDate,
            status: 'Vencido',
            daysOverdue: getDaysOverdue(dueDate),
            notes: 'Carga contable de apertura o ajuste manual'
        });
    }

    return movements;
}

export function getClientFinancialSummaryHelper(client: Client, readings: Reading[], machines: Machine[], payments: Payment[] = []) {
    const movements = getClientMovementsHelper(client, readings, machines, payments);
    
    const saldo = movements.reduce((acc, m) => {
        if (m.type === 'Factura' || m.type === 'Ajuste') return acc + m.pending;
        return acc;
    }, 0);

    const vencido = movements.reduce((acc, m) => {
        if (m.status === 'Vencido') return acc + m.pending;
        return acc;
    }, 0);

    const noVencido = movements.reduce((acc, m) => {
        if (m.status === 'Pendiente') return acc + m.pending;
        return acc;
    }, 0);

    const countPending = movements.filter(m => m.pending > 0).length;
    const receipts = movements.filter(m => m.type === 'Recibo');
    const lastPayment = receipts.length > 0 ? receipts.sort((a,b) => b.date.localeCompare(a.date))[0].date : 'Sin pagos';

    const invoices = movements.filter(m => m.type === 'Factura');
    const lastInvoice = invoices.length > 0 ? invoices.sort((a,b) => b.date.localeCompare(a.date))[0].date : 'N/A';

    const pendingDocs = movements.filter(m => m.pending > 0);
    const maxMora = pendingDocs.length > 0 ? Math.max(...pendingDocs.map(d => d.daysOverdue || 0)) : 0;
    const avgMora = pendingDocs.length > 0 ? Math.round(pendingDocs.reduce((acc, d) => acc + d.daysOverdue, 0) / pendingDocs.length) : 0;

    // Historical average days from invoice emission to full payment. Computed directly from
    // readings' own paymentDate (stamped whenever a reading reaches 'Pagado') rather than by
    // matching synthesized Factura/Recibo movement numbers — that matching broke once a single
    // invoice could have several real receipts (partial installments) with their own receipt
    // numbers instead of one predictable derived RC-... string. Readings with no usable date
    // are simply excluded from the average instead of being penalized with an arbitrary
    // fallback constant.
    const clientReadingsForAvg = readings.filter(r => {
        if (r.clientId) return r.clientId === client.id;
        const mach = machines.find(m => m.id === r.machineId);
        return mach && mach.clientId === client.id;
    });
    let totalPaidDays = 0;
    let countedPayDays = 0;
    clientReadingsForAvg.forEach(r => {
        if (r.collectionStatus !== 'Pagado' || !r.paymentDate) return;
        const invoiceDate = new Date(`${r.month}-01T00:00:00`);
        const paymentDate = new Date(`${r.paymentDate}T00:00:00`);
        const diff = paymentDate.getTime() - invoiceDate.getTime();
        if (isNaN(diff) || diff < 0) return;
        totalPaidDays += Math.floor(diff / (1000 * 60 * 60 * 24));
        countedPayDays++;
    });
    const avgPayDays = countedPayDays > 0 ? Math.round(totalPaidDays / countedPayDays) : 0;

    // Score de cobrabilidad (0 to 100)
    let score = 100;
    const overdueCount = movements.filter(m => m.pending > 0 && m.status === 'Vencido').length;
    score -= overdueCount * 15;
    score -= avgPayDays * 1.5;
    score -= maxMora * 0.5;

    score = Math.max(0, Math.min(100, Math.round(score)));

    let riskLevel: 'Bajo riesgo' | 'Riesgo medio' | 'Riesgo alto' = 'Bajo riesgo';
    let riskColor: 'green' | 'yellow' | 'red' = 'green';
    
    if (score >= 80) {
        riskLevel = 'Bajo riesgo';
        riskColor = 'green';
    } else if (score >= 50) {
        riskLevel = 'Riesgo medio';
        riskColor = 'yellow';
    } else {
        riskLevel = 'Riesgo alto';
        riskColor = 'red';
    }

    return {
        saldo,
        vencido,
        noVencido,
        countPending,
        lastPayment,
        lastInvoice,
        maxMora,
        avgMora,
        avgPayDays,
        score,
        riskLevel,
        riskColor
    };
}

export interface SystemAlert {
    id: string;
    clientId: string;
    clientName: string;
    tipo: 'info' | 'prev' | 'imp' | 'crit';
    titulo: string;
    descripcion: string;
    fecha: string;
    amount?: number;
    daysOverdue?: number;
}

export function getSystemAlerts(clients: Client[], readings: Reading[], machines: Machine[], gestiones: Gestion[], config: { diasMoraCritica: number; montoMinimoAlerta: number; diasAvisoVencimiento: number }): SystemAlert[] {
    const alerts: SystemAlert[] = [];
    
    clients.forEach(c => {
        const sum = getClientFinancialSummaryHelper(c, readings, machines);
        
        if (sum.saldo > 0) {
            if (sum.vencido > 0) {
                if (sum.maxMora >= config.diasMoraCritica || sum.vencido >= config.montoMinimoAlerta) {
                    alerts.push({
                        id: `alert-crit-${c.id}`,
                        clientId: c.id,
                        clientName: c.name,
                        tipo: 'crit',
                        titulo: 'Alerta Crítica: Deuda Crítica / Mora Prolongada',
                        descripcion: `El cliente posee una deuda vencida de ${formatCurrency(sum.vencido)} con un retraso de ${sum.maxMora} días. Requiere contacto urgente.`,
                        fecha: new Date().toISOString().split('T')[0],
                        amount: sum.vencido,
                        daysOverdue: sum.maxMora
                    });
                } else {
                    alerts.push({
                        id: `alert-imp-${c.id}`,
                        clientId: c.id,
                        clientName: c.name,
                        tipo: 'imp',
                        titulo: 'Alerta Importante: Deuda Vencida',
                        descripcion: `El cliente posee comprobantes vencidos sin cancelar por un total de ${formatCurrency(sum.vencido)}.`,
                        fecha: new Date().toISOString().split('T')[0],
                        amount: sum.vencido,
                        daysOverdue: sum.maxMora
                    });
                }
            } else {
                const movements = getClientMovementsHelper(c, readings, machines);
                const pendingMovements = movements.filter(m => m.pending > 0 && m.dueDate);
                
                let dueSoon = false;
                let dueToday = false;
                let soonDate = '';
                
                pendingMovements.forEach(m => {
                    const daysToDue = getDaysToDueHelper(m.dueDate);
                    if (daysToDue === 0) {
                        dueToday = true;
                    } else if (daysToDue > 0 && daysToDue <= config.diasAvisoVencimiento) {
                        dueSoon = true;
                        soonDate = m.dueDate;
                    }
                });
                
                if (dueToday) {
                    alerts.push({
                        id: `alert-imp-today-${c.id}`,
                        clientId: c.id,
                        clientName: c.name,
                        tipo: 'imp',
                        titulo: 'Vence Hoy',
                        descripcion: `Comprobante de facturación vence el día de hoy para el cliente ${c.name}.`,
                        fecha: new Date().toISOString().split('T')[0]
                    });
                } else if (dueSoon) {
                    alerts.push({
                        id: `alert-prev-soon-${c.id}`,
                        clientId: c.id,
                        clientName: c.name,
                        tipo: 'prev',
                        titulo: 'Próxima a Vencer',
                        descripcion: `Recordatorio preventivo: factura del cliente vence pronto (${soonDate}).`,
                        fecha: new Date().toISOString().split('T')[0]
                    });
                }
            }
        }
    });
    
    const getPastDateStr = (daysAgo: number) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        return d.toISOString().split('T')[0];
    };
    const lastThreeDays = [getPastDateStr(0), getPastDateStr(1), getPastDateStr(2)];
    gestiones.forEach((g, idx) => {
        const client = clients.find(c => c.id === g.clientId);
        if (client && lastThreeDays.includes(g.date)) {
            if (g.type === 'Pago registrado') {
                alerts.push({
                    id: `alert-info-pay-${g.id || idx}`,
                    clientId: g.clientId,
                    clientName: client.name,
                    tipo: 'info',
                    titulo: 'Pago Recibido',
                    descripcion: `Se registró un cobro/pago para ${client.name}. Detalle: ${g.observations}`,
                    fecha: g.date
                });
            } else if (g.type === 'Regularización') {
                alerts.push({
                    id: `alert-info-reg-${g.id || idx}`,
                    clientId: g.clientId,
                    clientName: client.name,
                    tipo: 'info',
                    titulo: 'Cuenta Regularizada',
                    descripcion: `La cuenta de ${client.name} ha sido completamente regularizada sin deudas activas.`,
                    fecha: g.date
                });
            }
        }
    });
    
    return alerts;
}

// playSystemSound already has 'critico'/'vencido' sound patterns built (see below), but
// nothing ever called them — the audio existed without being wired to the alerts that were
// supposed to trigger it. This decides which sound (if any) a *newly appeared* crit/imp
// alert should play, given the set of alert ids the caller has already announced this
// session — so a page doesn't replay the sound on every render/sync poll for the same
// still-open alert, only when something new actually shows up.
export function getAlertSoundForNewAlerts(alerts: SystemAlert[], previouslySeenIds: Set<string>): 'critico' | 'vencido' | null {
    const newAlerts = alerts.filter(a => !previouslySeenIds.has(a.id));
    if (newAlerts.some(a => a.tipo === 'crit')) return 'critico';
    if (newAlerts.some(a => a.tipo === 'imp')) return 'vencido';
    return null;
}

function getDaysToDueHelper(dueDateStr: string): number {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueParts = dueDateStr.split('-');
    const due = new Date(parseInt(dueParts[0], 10), parseInt(dueParts[1], 10) - 1, parseInt(dueParts[2], 10));
    if (isNaN(due.getTime())) return -999;
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
