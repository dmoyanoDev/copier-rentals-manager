export type DiscountType = 'PERCENT' | 'FIXED' | 'NONE';

export type TaxMode = 'INCLUDED' | 'ADD_21' | 'PLUS_IVA' | 'EXEMPT';

export type BudgetStatus = 'borrador' | 'emitido' | 'enviado' | 'anulado';

export type BudgetType = 'alquiler' | 'insumo' | 'repuesto' | 'servicio_tecnico' | 'mixto';

export interface BudgetClientSnapshot {
    nombreRazonSocial: string;
    documento?: string;
    cuitCuil?: string;
    telefono: string;
    email: string;
    domicilio: string;
    localidad?: string;
    provincia?: string;
    contacto?: string;
}

export type BudgetItemCategory = 'ALQUILER' | 'INSUMO' | 'REPUESTO' | 'SERVICIO';

export interface BudgetItem {
    id: string;
    categoria: BudgetItemCategory;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    metadata?: string; // JSON string
}

export interface BudgetMachineConfig {
    id?: string;
    machinePresetId?: string;
    machineName: string;
    machineBrand: string;
    machineModel: string;
    technicalSummary: string;
    editableSpecsText: string;
    planNombre: string;
    copiasIncluidas: number;
    abonoBase: number;
    copiaExcedente: number;
    cantidad: number;
    subtotal: number;
}

export interface BudgetTemplate {
    id: string;
    nombre: string;
    tipo: BudgetType;
    defaultIntroText: string;
    defaultConditionsText: string;
    defaultIncludesText: string;
    defaultExcludesText: string;
    defaultRequirementsText: string;
    defaultTaxMode: TaxMode;
    activo: boolean;
}

export interface MachinePreset {
    id: string;
    marca: string;
    modelo: string;
    nombreComercial: string;
    tipo: string;
    ppm: number;
    funciones: string;
    duplex: boolean;
    escaner: boolean;
    adf: boolean;
    conectividad: string;
    papel: string;
    pantalla: string;
    memoria: string;
    capacidadPapel: string;
    technicalSummary: string;
    commercialNotes: string;
    activo: boolean;
}

export interface BudgetSendLog {
    id: string;
    presupuestoId: string;
    fecha: string;
    canal: 'email' | 'whatsapp';
    destinatario: string;
    asunto?: string;
    mensaje: string;
    exitoso: boolean;
}

export interface Budget {
    id: string;
    numero: string;
    fecha: string;
    estado: BudgetStatus;
    tipo: BudgetType;
    templateId?: string;
    clientId?: string;
    isNewClient: boolean;
    saveNewClient: boolean;
    ivaMode: TaxMode;
    moneda: string;
    subtotal: number;
    discountType: DiscountType;
    discountValue: number;
    discountAmount: number;
    ivaAmount: number;
    total: number;
    validezOferta: string; // e.g., "15 Días"
    plazoMinimoContrato: string; // e.g., "12 Meses"
    ajustePrecios: string; // e.g., "Trimestral según IPC"
    observaciones?: string;
    introText: string;
    includesText: string;
    excludesText: string;
    requirementsText: string;
    conditionsText: string;
    footerText: string;
    clientSnapshot: BudgetClientSnapshot;
    items: BudgetItem[];
    machines: BudgetMachineConfig[];
    createdAt: string;
    updatedAt: string;
    issuedAt?: string;
    sendLogs?: BudgetSendLog[];
}
