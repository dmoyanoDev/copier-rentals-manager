// Domain Types — M&S Tecnología Digital
// Centralized type definitions for all business entities
// These types are the source of truth — DO NOT define types in mockData.ts

export interface Client {
    id: string;
    name: string;
    cuit: string;
    taxCategory: 'Responsable Inscripto' | 'Monotributista' | 'Exento';
    address: string;
    phone: string;
    email: string;
    debt: number;
    active?: boolean;
    cobranzaNotas?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface Abono {
    id: string;
    name: string;
    price: number;
    limit: number;
    excessPrice: number;
    active?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface Machine {
    id: string;
    clientId: string | null;
    abonoId: string | null;
    brand: string;
    model: string;
    serial: string;
    type: 'B&N' | 'Color';
    currentCounter: number;
    lastServiceCounter: number;
    preventiveInterval: number;
    status: 'Disponible' | 'Alquilada' | 'En Taller' | 'Alerta Técnica';
    applyIva: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface Reading {
    id: string;
    machineId: string;
    clientId?: string;
    abonoId?: string;
    month: string;
    initial: number;
    final: number;
    excessCount: number;
    excessPrice: number;
    netAmount: number;
    ivaAmount: number;
    totalAmount: number;
    readingStatus: 'cargada' | 'observada' | 'validada' | 'facturada';
    collectionStatus?: 'Impago' | 'Parcial' | 'Pagado';
    paymentAmount?: number;
    paymentDate?: string;
    billingStatus?: 'No facturado' | 'Facturado';
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    readingComment?: string;
    history?: { date: string; time: string; action: string; user: string; }[];
    createdAt?: string;
    updatedAt?: string;
}

export interface Rental {
    id: string;
    clientId: string;
    machineId: string;
    abonoId: string;
    startDate: string;
    endDate?: string;
    status: 'activo' | 'pausado' | 'finalizado' | 'vencido';
    observations?: string;
    history?: { date: string; time: string; action: string; user: string; }[];
    createdAt?: string;
    updatedAt?: string;
}

export interface Ticket {
    id: string;
    machineId: string | null;
    clientId: string | null;
    clientName: string;
    clientAddress?: string;
    clientPhone?: string;
    clientEmail?: string;
    clientContact?: string;
    machineDesc: string;
    serialNumber: string;
    clientType: 'existente' | 'externo';
    date: string;
    time: string;
    priority: 'baja' | 'media' | 'alta' | 'urgente';
    status: 'nuevo' | 'asignado' | 'en-camino' | 'en-proceso' | 'esperando-repuesto' | 'resuelto' | 'cerrado';
    category: string;
    description: string;
    diagnostic: string;
    actionTaken: string;
    partsNeeded: string;
    partsUsed: string;
    internalNotes: string;
    assignedTechId: string | null;
    technicalCost?: number;
    observations?: string;
    slaDate: string;
    resolvedAt?: number;
    closedAt?: number;
    createdAt?: number;
    history?: {
        date: string;
        time: string;
        action: string;
        user: string;
    }[];
    deleted?: boolean;
    updatedAt?: string;
}

export interface User {
    id: string;
    username: string;
    fullname: string;
    email: string;
    role: 'administrativo' | 'tecnico';
    phone?: string;
    whatsapp?: string;
    zone?: string;
    specialty?: string;
    availability?: 'Disponible' | 'No disponible' | 'Licencia';
    active?: boolean;
    workHours?: string;
    internalNotes?: string;
    createdAt?: string;
    updatedAt?: string;
}

// Extended types
export type LocalClient = Client;

export interface LocalReading extends Reading {
    clientId?: string;
}

// Sync Queue Types — strongly typed, no 'any'
export type SyncOperation = 'create' | 'update' | 'delete';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';
export type SyncEntityType = 'clients' | 'machines' | 'readings' | 'tickets' | 'abonos' | 'users' | 'rentals' | 'budgets' | 'gestiones' | 'cobranzaConfig' | 'payments' | 'machinePresets' | 'templates';

export interface SyncQueueItem {
    id: string;
    entityId: string;
    entityType: SyncEntityType;
    operation: SyncOperation;
    payload: Record<string, unknown>;
    updatedAt: string;
    status: SyncStatus;
    retryCount: number;
}

// Cobranza/Gestión Types
export interface Gestion {
    id: string;
    clientId: string;
    date: string;
    type: 'WhatsApp' | 'Email' | 'Llamado' | 'Pago registrado' | 'Promesa de pago' | 'Regularización' | 'Auditoría';
    user: string;
    channel: string;
    result: string;
    observations: string;
}

// Payment / Receipt Types
export const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Cheque', 'Tarjeta de Débito', 'Tarjeta de Crédito', 'Otro'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export interface Payment {
    id: string;
    receiptNumber: string;
    clientId: string | null;
    readingId: string | null;
    amount: number;
    method: PaymentMethod;
    date: string;
    invoiceReference?: string | null;
    receivedByUserId?: string | null;
    receivedByName: string;
    clientNameSnapshot: string;
    clientCuitSnapshot?: string | null;
    period?: string | null;
    concept?: string | null;
    readingTotalSnapshot?: number | null;
    balanceAfter: number;
    notes?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface CobranzaConfig {
    diasAvisoVencimiento: number;
    montoMinimoAlerta: number;
    diasMoraCritica: number;
    plantillaEmail: string;
    plantillaWhatsapp: string;
    plantillaPreventivoEmail: string;
    plantillaPreventivoWhatsapp: string;
    plantillaDeudaVencidaEmail: string;
    plantillaDeudaVencidaWhatsapp: string;
    plantillaSegundoAvisoEmail: string;
    plantillaSegundoAvisoWhatsapp: string;
    plantillaPagoRecibidoEmail: string;
    plantillaPagoRecibidoWhatsapp: string;
    sonidosActivos: boolean;
    volumenSonidos: number;
    autoAlertasActivas: boolean;
}

// System alerts
export interface SystemAlert {
    type: 'preventivo' | 'deuda_vencida' | 'critico' | 'pago' | 'regularizado';
    clientId: string;
    clientName: string;
    message: string;
    amount?: number;
    severity: 'info' | 'warning' | 'danger' | 'success';
}

// History entry shared type
export interface HistoryEntry {
    date: string;
    time: string;
    action: string;
    user: string;
}

// Constants
export const MAX_SYNC_QUEUE_SIZE = 500;
export const MAX_SYNC_RETRIES = 5;
export const SYNC_DEBOUNCE_MS = 500;
// Poll every 1.5 seconds when tab is visible — achieves ultra-responsive near-instant real-time sync across devices
// Safe for Turso: incremental queries using ?since= timestamp return 0 bytes when nothing changed
export const SYNC_POLL_INTERVAL_MS = 1500;

