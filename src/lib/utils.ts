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
