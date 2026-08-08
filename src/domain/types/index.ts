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

// Sede/oficina dentro de un cliente (ej: un hospital con varias áreas, cada una con sus
// propios equipos). Pertenece a exactamente un cliente — no tiene sentido sin él.
export interface Oficina {
    id: string;
    clientId: string;
    nombre: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface Machine {
    id: string;
    clientId: string | null;
    abonoId: string | null;
    // Solo tiene sentido cuando clientId está seteado, y debe pertenecer a ESE cliente.
    oficinaId?: string | null;
    brand: string;
    model: string;
    serial: string;
    type: 'B&N' | 'Color';
    currentCounter: number;
    lastServiceCounter: number;
    preventiveInterval: number;
    status: 'Disponible' | 'Alquilada' | 'En Taller' | 'Alerta Técnica' | 'Vendida';
    applyIva: boolean;
    // Placeholder manual de costo de insumos por copia — ver comentario en
    // infrastructure/db/schema/machines.ts. null = sin cargar, no asumir $0.
    costoPorCopiaInsumos?: number | null;
    // Etapa 4 del plan de rentabilidad: datos para amortización lineal (costo ÷ vida útil
    // en meses, desde la fecha de adquisición). Los 3 son opcionales y se tratan como un
    // solo bloque "todo o nada" — si falta alguno, la máquina no tiene amortización
    // calculable ("s/d"), nunca se asume un valor.
    acquisitionCost?: number | null;
    acquisitionDate?: string | null;
    usefulLifeMonths?: number | null;
    // Etapa 6 del plan de rentabilidad: "casilleros" de consumibles instalados
    // actualmente (tóner, módulo de imagen, fusor). Cada uno es independiente y
    // opcional — catalogId apunta a un PartCatalogItem con rendimientoCopias
    // cargado, installedAtCounter es el valor de currentCounter al momento de
    // instalarlo. % de uso = (currentCounter - installedAtCounter) / rendimiento.
    tonerCatalogId?: string | null;
    tonerInstalledAtCounter?: number | null;
    imageUnitCatalogId?: string | null;
    imageUnitInstalledAtCounter?: number | null;
    fuserCatalogId?: string | null;
    fuserInstalledAtCounter?: number | null;
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
    partsNeededItems?: PartUsageEntry[];
    partsUsedItems?: PartUsageEntry[];
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
export type SyncEntityType = 'clients' | 'machines' | 'readings' | 'tickets' | 'abonos' | 'users' | 'rentals' | 'budgets' | 'gestiones' | 'cobranzaConfig' | 'payments' | 'machinePresets' | 'templates' | 'partsCatalog' | 'gastosGenerales' | 'ventas' | 'oficinas' | 'pricingSettings' | 'dollarSettings';

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

// Parts Catalog / Usage Types
// Taxonomía real del catálogo de venta (hoja "PRECIO DE VENTA INSUMOS Y EQUIP" del Excel
// de la empresa) — deliberadamente separada de `PartCatalogItem.categoria` (Insumo/Repuesto),
// que ya la usan Ventas y PartsPicker con un significado distinto. `tipoProducto` es la
// clave de nivel "categoría" para la config de precios en 3 niveles (ver pricing.ts).
export const TIPO_PRODUCTO_VALUES = ['INSUMOS', 'MULTIFUNCION MONOCROMATICA', 'MULTIFUNCION COLOR', 'REPUESTO', 'IMPRESORA INKJET', 'IMPRESORA MONOCROMATICA', 'ESCANER'] as const;
export type TipoProducto = typeof TIPO_PRODUCTO_VALUES[number];

export interface PartCatalogItem {
    id: string;
    nombre: string;
    categoria: 'Insumo' | 'Repuesto';
    unidad: string;
    costoUnitario: number;
    stockActual: number;
    stockMinimo: number;
    notas?: string | null;
    activo?: boolean;
    // Etapa 6 del plan de rentabilidad: cuántas copias rinde esta unidad (tóner,
    // módulo de imagen, fusor). Opcional — items donde no aplica (correas,
    // repuestos genéricos) lo dejan vacío. null/undefined = no aplica, no asumir 0.
    rendimientoCopias?: number | null;
    // Módulo Catálogo/Stock — campos del catálogo de venta. `costoUnitario` de arriba
    // queda como caché en ARS calculado desde costoBase+moneda+dólar manual; estos son
    // el dato de entrada real.
    codigo?: string | null;
    descripcion?: string | null;
    tipoProducto?: TipoProducto | null;
    subcategoria?: string | null;
    marca?: string | null;
    modelo?: string | null;
    proveedor?: string | null;
    moneda?: 'ARS' | 'USD' | null;
    costoBase?: number | null;
    createdAt?: string;
    updatedAt?: string;
}

// Módulo Catálogo/Stock — parámetros comerciales resueltos en 3 niveles: una fila
// scope='global' (siempre completa), y filas scope='categoria'/'unidad' que sobrescriben
// solo los campos no-nulos que traen (el resto se hereda). Ver pricing.ts para la
// resolución (unidad > categoría > global, por campo, no en bloque).
export type PricingScope = 'global' | 'categoria' | 'unidad';

export interface PricingSetting {
    id: string;
    scope: PricingScope;
    scopeKey?: string | null; // null en global; TipoProducto en categoria; PartCatalogItem.id en unidad
    transportePct?: number | null;
    precioListaPct?: number | null;
    precioEfectivoPct?: number | null;
    licitacionesPct?: number | null;
    insumosRepuestosPct?: number | null;
    equiposPct?: number | null;
    promocionesPct?: number | null;
    promocionesActiva?: boolean | null;
    createdAt?: string;
    updatedAt?: string;
}

// Módulo Catálogo/Stock — singleton (mismo patrón que CobranzaConfig). manualStockRate es
// el dólar realmente usado para calcular; lastOficialVenta/lastBlueVenta son solo de
// referencia (se completan desde /api/dolar, pueden quedar sin actualizar sin romper nada).
export interface DollarSettings {
    id: 'singleton';
    manualStockRate: number;
    lastOficialVenta?: number | null;
    lastBlueVenta?: number | null;
    lastFetchedAt?: string | null;
    lastFetchStatus: 'ok' | 'error' | 'never';
    updatedAt?: string;
}

// Snapshot of a catalog item at the moment it was used on a ticket — survives the
// catalog item being renamed/deleted later, same reasoning as Payment's snapshot fields.
export interface PartUsageEntry {
    catalogId: string;
    nombre: string;
    categoria: 'Insumo' | 'Repuesto';
    unidad: string;
    cantidad: number;
    costoUnitario: number;
}

// Gastos Generales — ledger mensual de costos de estructura del negocio (no se
// prorratean por máquina, ver Etapa 2 del plan de rentabilidad: se restan del
// resultado operativo total del negocio en el período, no de cada equipo).
export const GASTO_CATEGORIAS = ['Alquiler', 'Seguros', 'Sueldos Administrativos', 'Transporte', 'Servicios', 'Impuestos', 'Otros'] as const;
export type GastoCategoria = typeof GASTO_CATEGORIAS[number];

export interface GastoGeneral {
    id: string;
    categoria: GastoCategoria;
    monto: number;
    fecha: string;
    descripcion?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

// Ventas — equipos, insumos y repuestos vendidos (Etapa 3 del plan de rentabilidad).
// Su margen (precioVenta - costoVenta) se suma al Resultado del Negocio del período,
// junto a los resultadoOperativo de máquinas y restando gastosGenerales — ver getBusinessResult.
export const VENTA_TIPOS = ['Equipo', 'Insumo', 'Repuesto'] as const;
export type VentaTipo = typeof VENTA_TIPOS[number];

// 'flota': el equipo vendido era parte de la flota de alquiler (machineId apunta a él,
// se marca Machine.status='Vendida' y se cierra cualquier alquiler activo).
// 'externo': equipo que nunca fue parte de la flota (reventa directa), o siempre para
// insumo/repuesto — va con descripcion libre, sin machineId.
export const VENTA_ORIGENES = ['flota', 'externo'] as const;
export type VentaOrigen = typeof VENTA_ORIGENES[number];

export interface Venta {
    id: string;
    tipo: VentaTipo;
    origen: VentaOrigen;
    machineId?: string | null;
    catalogId?: string | null;
    descripcion?: string | null;
    clientId?: string | null;
    clientNameSnapshot?: string | null;
    cantidad: number;
    precioVenta: number;
    costoVenta: number;
    fecha: string;
    notas?: string | null;
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

