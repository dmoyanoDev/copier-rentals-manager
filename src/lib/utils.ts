import { Client, Ticket } from './mockData';

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
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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
    const today = new Date('2026-07-05T00:00:00');
    const due = new Date(dueDateStr + 'T00:00:00');
    if (isNaN(due.getTime()) || due.getTime() >= today.getTime()) return 0;
    const diffTime = today.getTime() - due.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function getClientMovementsHelper(client: Client, readings: any[], machines: any[]) {
    const clientReadings = readings.filter(r => {
        if ((r as any).clientId) return (r as any).clientId === client.id;
        const mach = machines.find(m => m.id === r.machineId);
        return mach && mach.clientId === client.id;
    });

    const movements: any[] = [];

    // Initial Debt Adjustment
    if (client.debt && client.debt > 0) {
        movements.push({
            id: `init-debt-${client.id}`,
            date: '2026-05-01',
            type: 'Ajuste',
            number: 'AJ-000001',
            period: 'Saldo Inicial',
            concept: 'Saldo deudor inicial pendiente de cobro',
            original: client.debt,
            paid: 0,
            pending: client.debt,
            dueDate: '2026-05-15',
            status: 'Vencido',
            daysOverdue: getDaysOverdue('2026-05-15'),
            notes: 'Carga contable de apertura'
        });
    }

    // Map readings as Facturas & Recibos
    clientReadings.forEach(r => {
        const isPaid = r.status === 'paid';
        const invoiceDate = `${r.month}-01`;
        const dueDate = `${r.month}-15`;
        const days = isPaid ? 0 : getDaysOverdue(dueDate);
        const status = isPaid ? 'Pagado' : (days > 0 ? 'Vencido' : 'Pendiente');

        movements.push({
            id: `fact-${r.id}`,
            date: invoiceDate,
            type: 'Factura',
            number: `FC-${r.id.replace('r-', '00005')}`,
            period: r.month,
            concept: `Abono y excedente período ${r.month}`,
            original: r.totalAmount,
            paid: isPaid ? r.totalAmount : 0,
            pending: isPaid ? 0 : r.totalAmount,
            dueDate: dueDate,
            status: status,
            daysOverdue: days,
            notes: r.readingComment || 'Facturación automatizada'
        });

        if (isPaid) {
            movements.push({
                id: `rec-${r.id}`,
                date: `${r.month}-10`,
                type: 'Recibo',
                number: `RC-${r.id.replace('r-', '00005')}`,
                period: r.month,
                concept: `Cobro de facturación período ${r.month}`,
                original: r.totalAmount,
                paid: r.totalAmount,
                pending: 0,
                dueDate: '',
                status: 'Pagado',
                daysOverdue: 0,
                notes: 'Recibido por transferencia bancaria'
            });
        }
    });

    return movements;
}

export function getClientFinancialSummaryHelper(client: Client, readings: any[], machines: any[]) {
    const movements = getClientMovementsHelper(client, readings, machines);
    
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

    // Calculate historical average days to pay (emission to payment)
    const paidInvoices = movements.filter(m => m.type === 'Factura' && m.status === 'Pagado');
    let totalPaidDays = 0;
    paidInvoices.forEach(inv => {
        const receipt = movements.find(r => r.type === 'Recibo' && r.number === inv.number.replace('FC-', 'RC-'));
        if (receipt) {
            const d1 = new Date(inv.date + 'T00:00:00');
            const d2 = new Date(receipt.date + 'T00:00:00');
            const diff = d2.getTime() - d1.getTime();
            if (diff > 0) {
                totalPaidDays += Math.floor(diff / (1000 * 60 * 60 * 24));
            } else {
                totalPaidDays += 9;
            }
        } else {
            totalPaidDays += 9;
        }
    });
    const avgPayDays = paidInvoices.length > 0 ? Math.round(totalPaidDays / paidInvoices.length) : 0;

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

export function getSystemAlerts(clients: Client[], readings: any[], machines: any[], gestiones: any[], config: any): SystemAlert[] {
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
                        fecha: '2026-07-05',
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
                        fecha: '2026-07-05',
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
                        fecha: '2026-07-05'
                    });
                } else if (dueSoon) {
                    alerts.push({
                        id: `alert-prev-soon-${c.id}`,
                        clientId: c.id,
                        clientName: c.name,
                        tipo: 'prev',
                        titulo: 'Próxima a Vencer',
                        descripcion: `Recordatorio preventivo: factura del cliente vence pronto (${soonDate}).`,
                        fecha: '2026-07-05'
                    });
                }
            }
        }
    });
    
    const lastThreeDays = ['2026-07-05', '2026-07-04', '2026-07-03'];
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

function getDaysToDueHelper(dueDateStr: string): number {
    const today = new Date('2026-07-05T00:00:00');
    const due = new Date(dueDateStr + 'T00:00:00');
    if (isNaN(due.getTime())) return -999;
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
