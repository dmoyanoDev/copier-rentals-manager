import { z } from 'zod';
import { PAYMENT_METHODS, GASTO_CATEGORIAS, VENTA_TIPOS, VENTA_ORIGENES, TIPO_PRODUCTO_VALUES } from '@/domain/types';

const dateSchema = z.union([z.string(), z.number(), z.date()]).transform(val => {
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
});

// Helper Schemas replacing z.any()
export const historyEntrySchema = z.object({
  date: z.string(),
  time: z.string(),
  action: z.string(),
  user: z.string(),
});

export const budgetClientSnapshotSchema = z.object({
  nombreRazonSocial: z.string(),
  documento: z.string().optional().nullable(),
  cuitCuil: z.string().optional().nullable(),
  telefono: z.string().default(''),
  email: z.string().default(''),
  domicilio: z.string().default(''),
  localidad: z.string().optional().nullable(),
  provincia: z.string().optional().nullable(),
  contacto: z.string().optional().nullable(),
});

export const budgetItemSchema = z.object({
  id: z.string(),
  categoria: z.enum(['ALQUILER', 'INSUMO', 'REPUESTO', 'SERVICIO', 'VENTA', 'OTROS', 'ABONO']),
  descripcion: z.string(),
  cantidad: z.number().default(1),
  precioUnitario: z.number().default(0),
  subtotal: z.number().default(0),
  descuento: z.number().optional().nullable(),
  origen: z.enum(['manual', 'abono', 'maquina', 'servicio']).optional().nullable(),
  origenId: z.string().optional().nullable(),
  nombre: z.string().optional().nullable(),
  metadata: z.string().optional().nullable(),
});

export const budgetMachineConfigSchema = z.object({
  id: z.string().optional().nullable(),
  machinePresetId: z.string().optional().nullable(),
  machineName: z.string(),
  machineBrand: z.string(),
  machineModel: z.string(),
  technicalSummary: z.string().default(''),
  editableSpecsText: z.string().default(''),
  planNombre: z.string(),
  copiasIncluidas: z.number().default(0),
  abonoBase: z.number().default(0),
  copiaExcedente: z.number().default(0),
  cantidad: z.number().default(1),
  subtotal: z.number().default(0),
});

export const partUsageEntrySchema = z.object({
  catalogId: z.string().min(1),
  nombre: z.string().default(''),
  categoria: z.enum(['Insumo', 'Repuesto']).default('Insumo'),
  unidad: z.string().default('Unidad'),
  cantidad: z.number().default(1),
  costoUnitario: z.number().default(0),
});

export const budgetSendLogSchema = z.object({
  id: z.string(),
  presupuestoId: z.string(),
  fecha: z.string(),
  canal: z.enum(['email', 'whatsapp']),
  destinatario: z.string(),
  asunto: z.string().optional().nullable(),
  mensaje: z.string(),
  exitoso: z.boolean().default(true),
});

// Entity Sync Schemas
export const clientSyncSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  cuit: z.string().nullable().optional(),
  // Accept both 'notes' (DB name) and 'cobranzaNotas' (frontend name, the only one
  // clientes/page.tsx actually reads/writes) — same accept-both-and-normalize pattern
  // as machineCounter/currentCounter and comments/readingComment.
  notes: z.string().nullable().optional(),
  cobranzaNotas: z.string().nullable().optional(),
  taxCategory: z.enum(['Responsable Inscripto', 'Monotributista', 'Exento']).default('Monotributista'),
  debt: z.number().default(0),
  active: z.boolean().default(true),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
}).transform((data) => {
  const notes = data.cobranzaNotas !== undefined ? data.cobranzaNotas : data.notes;
  const { cobranzaNotas, ...rest } = data;
  return { ...rest, notes };
});

export const planSyncSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  limit: z.number().int().default(0),
  price: z.number().default(0),
  excessPrice: z.number().default(0),
  ivaRate: z.number().default(21),
  active: z.boolean().default(true),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const machineSyncSchema = z.object({
  id: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  serial: z.string().min(1),
  type: z.string().default('B&N'),
  status: z.string().default('Usado'),
  // Accept both 'machineCounter' (DB name) and 'currentCounter' (frontend name)
  machineCounter: z.number().int().default(0),
  currentCounter: z.number().int().optional(), // frontend alias — used in transform below
  clientId: z.string().nullable().optional(),
  abonoId: z.string().nullable().optional(),
  oficinaId: z.string().nullable().optional(),
  installationDate: z.string().nullable().optional(),
  initialCounter: z.number().int().default(0),
  lastServiceCounter: z.number().int().default(0),
  preventiveInterval: z.number().int().default(15000),
  applyIva: z.boolean().default(false),
  readingDay: z.number().int().default(10),
  isAvailable: z.boolean().default(true),
  pdfUrl: z.string().nullable().optional(),
  features: z.string().nullable().optional(),
  costoPorCopiaInsumos: z.number().nullable().optional(),
  acquisitionCost: z.number().nullable().optional(),
  acquisitionDate: z.string().nullable().optional(),
  usefulLifeMonths: z.number().int().nullable().optional(),
  tonerCatalogId: z.string().nullable().optional(),
  tonerInstalledAtCounter: z.number().int().nullable().optional(),
  imageUnitCatalogId: z.string().nullable().optional(),
  imageUnitInstalledAtCounter: z.number().int().nullable().optional(),
  fuserCatalogId: z.string().nullable().optional(),
  fuserInstalledAtCounter: z.number().int().nullable().optional(),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
}).transform((data) => {
  // Normalize: if frontend sends currentCounter, use it as machineCounter
  const counter = data.currentCounter !== undefined ? data.currentCounter : data.machineCounter;
  const { currentCounter, ...rest } = data;
  return { ...rest, machineCounter: counter };
});


export const readingSyncSchema = z.object({
  id: z.string().min(1),
  machineId: z.string().min(1),
  clientId: z.string().nullable().optional(),
  abonoId: z.string().nullable().optional(),
  month: z.string().min(1),
  initial: z.number().int().default(0),
  final: z.number().int().default(0),
  // Financial fields — CRITICAL: must be persisted to DB, not defaulted to 0
  excessCount: z.number().int().default(0),
  excessPrice: z.number().default(0),
  netAmount: z.number().default(0),
  ivaAmount: z.number().default(0),
  totalAmount: z.number().default(0),
  readingStatus: z.string().default('Lectura tomada'),
  billingStatus: z.string().default('No facturado'),
  collectionStatus: z.string().default('Impago'),
  // Accept both 'comments' (DB name) and 'readingComment' (frontend name)
  comments: z.string().nullable().optional(),
  readingComment: z.string().nullable().optional(), // frontend alias — used in transform below
  invoiceNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  paymentDate: z.string().nullable().optional(),
  paymentAmount: z.number().default(0),
  isUnofficial: z.boolean().default(false),
  creditNote: z.number().default(0),
  creditNoteReason: z.string().nullable().optional(),
  debitNote: z.number().default(0),
  debitNoteReason: z.string().nullable().optional(),
  invoiceFile: z.string().nullable().optional(),
  history: z.array(historyEntrySchema).default([]),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
}).transform((data) => {
  // Normalize: if frontend sends readingComment, use it as comments
  const comments = data.readingComment !== undefined ? data.readingComment : data.comments;
  const { readingComment, ...rest } = data;
  return { ...rest, comments };
});


export const ticketSyncSchema = z.object({
  id: z.string().min(1),
  clientType: z.string().default('existente'),
  clientId: z.string().nullable().optional(),
  clientName: z.string().min(1),
  clientAddress: z.string().nullable().optional(),
  clientPhone: z.string().nullable().optional(),
  clientEmail: z.string().nullable().optional(),
  clientContact: z.string().nullable().optional(),
  machineId: z.string().nullable().optional(),
  machineDesc: z.string().default('Equipo'),
  serialNumber: z.string().nullable().optional(),
  category: z.string().default('Servicio'),
  requestType: z.string().default('Telefono'),
  priority: z.string().default('Media'),
  status: z.string().default('nuevo'),
  description: z.string().default('Sin descripción'),
  diagnostic: z.string().nullable().optional(),
  partsNeeded: z.string().nullable().optional(),
  partsUsed: z.string().nullable().optional(),
  partsNeededItems: z.array(partUsageEntrySchema).default([]),
  partsUsedItems: z.array(partUsageEntrySchema).default([]),
  internalNotes: z.string().nullable().optional(),
  actionTaken: z.string().nullable().optional(),
  assignedTechId: z.string().nullable().optional(),
  technicalCost: z.number().nullable().optional(),
  observations: z.string().nullable().optional(),
  slaDate: dateSchema.nullable().optional(),
  resolvedAt: dateSchema.nullable().optional(),
  closedAt: dateSchema.nullable().optional(),
  history: z.array(historyEntrySchema).default([]),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const rentalSyncSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  machineId: z.string().min(1),
  abonoId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  status: z.string().default('activo'),
  observations: z.string().nullable().optional(),
  history: z.array(historyEntrySchema).default([]),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const budgetSyncSchema = z.object({
  id: z.string().min(1),
  numero: z.string().min(1),
  fecha: z.string().min(1),
  estado: z.string().default('borrador'),
  tipo: z.string().min(1),
  templateId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  isNewClient: z.boolean().default(false),
  saveNewClient: z.boolean().default(false),
  ivaMode: z.string().default('ADD_21'),
  moneda: z.string().default('ARS'),
  subtotal: z.number().default(0),
  discountType: z.string().default('NONE'),
  discountValue: z.number().default(0),
  discountAmount: z.number().default(0),
  ivaAmount: z.number().default(0),
  total: z.number().default(0),
  validezOferta: z.string().default('15 Días'),
  plazoMinimoContrato: z.string().default('12 Meses'),
  ajustePrecios: z.string().default('Trimestral según IPC'),
  observaciones: z.string().nullable().optional(),
  introText: z.string().default(''),
  includesText: z.string().default(''),
  excludesText: z.string().default(''),
  requirementsText: z.string().default(''),
  conditionsText: z.string().default(''),
  footerText: z.string().default(''),
  clientSnapshot: budgetClientSnapshotSchema,
  items: z.array(budgetItemSchema).default([]),
  machines: z.array(budgetMachineConfigSchema).default([]),
  sendLogs: z.array(budgetSendLogSchema).default([]),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
  issuedAt: dateSchema.nullable().optional(),
});

export const userSyncSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  fullname: z.string().min(1),
  email: z.string().min(1),
  // passwordHash is required (NOT NULL in DB, no default) — must be present on user create
  passwordHash: z.string().default(''),
  role: z.string().default('administrativo'), // matches DB default
  isMaster: z.number().int().default(0),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  zone: z.string().nullable().optional(),
  specialty: z.string().nullable().optional(),
  availability: z.string().default('Disponible'),
  active: z.number().int().default(1),
  workHours: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  // Audit / login tracking fields
  lastLoginAt: dateSchema.nullable().optional(),
  failedLoginAttempts: z.number().int().default(0),
  lockedUntil: dateSchema.nullable().optional(),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const gestionSyncSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  date: z.string().min(1),
  type: z.string().min(1),
  user: z.string().default(''),
  channel: z.string().default(''),
  result: z.string().default(''),
  observations: z.string().default(''),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const paymentSyncSchema = z.object({
  id: z.string().min(1),
  receiptNumber: z.string().min(1),
  clientId: z.string().nullable().optional(),
  readingId: z.string().nullable().optional(),
  amount: z.number().default(0),
  method: z.enum(PAYMENT_METHODS).default('Efectivo'),
  date: z.string().min(1),
  invoiceReference: z.string().nullable().optional(),
  receivedByUserId: z.string().nullable().optional(),
  receivedByName: z.string().default(''),
  clientNameSnapshot: z.string().default(''),
  clientCuitSnapshot: z.string().nullable().optional(),
  period: z.string().nullable().optional(),
  concept: z.string().nullable().optional(),
  readingTotalSnapshot: z.number().nullable().optional(),
  balanceAfter: z.number().default(0),
  notes: z.string().nullable().optional(),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const machinePresetSyncSchema = z.object({
  id: z.string().min(1),
  marca: z.string().min(1),
  modelo: z.string().min(1),
  nombreComercial: z.string().default(''),
  tipo: z.string().default('B&N'),
  ppm: z.number().default(40),
  funciones: z.string().default(''),
  duplex: z.boolean().default(true),
  escaner: z.boolean().default(true),
  adf: z.boolean().default(true),
  conectividad: z.string().default(''),
  papel: z.string().default(''),
  pantalla: z.string().default(''),
  memoria: z.string().default(''),
  capacidadPapel: z.string().default(''),
  technicalSummary: z.string().default(''),
  commercialNotes: z.string().default(''),
  activo: z.boolean().default(true),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const partCatalogItemSyncSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  categoria: z.enum(['Insumo', 'Repuesto']).default('Insumo'),
  unidad: z.string().default('Unidad'),
  costoUnitario: z.number().default(0),
  stockActual: z.number().int().default(0),
  stockMinimo: z.number().int().default(0),
  notas: z.string().nullable().optional(),
  activo: z.boolean().default(true),
  rendimientoCopias: z.number().int().nullable().optional(),
  codigo: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  tipoProducto: z.enum(TIPO_PRODUCTO_VALUES).nullable().optional(),
  subcategoria: z.string().nullable().optional(),
  marca: z.string().nullable().optional(),
  modelo: z.string().nullable().optional(),
  proveedor: z.string().nullable().optional(),
  moneda: z.enum(['ARS', 'USD']).nullable().optional(),
  costoBase: z.number().nullable().optional(),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const pricingSettingSyncSchema = z.object({
  id: z.string().min(1),
  scope: z.enum(['global', 'categoria', 'unidad']),
  scopeKey: z.string().nullable().optional(),
  transportePct: z.number().nullable().optional(),
  precioListaPct: z.number().nullable().optional(),
  precioEfectivoPct: z.number().nullable().optional(),
  licitacionesPct: z.number().nullable().optional(),
  insumosRepuestosPct: z.number().nullable().optional(),
  equiposPct: z.number().nullable().optional(),
  promocionesPct: z.number().nullable().optional(),
  promocionesActiva: z.boolean().nullable().optional(),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const dollarSettingsSyncSchema = z.object({
  id: z.string().default('singleton'),
  manualStockRate: z.number().default(0),
  lastOficialVenta: z.number().nullable().optional(),
  lastBlueVenta: z.number().nullable().optional(),
  lastFetchedAt: dateSchema.nullable().optional(),
  lastFetchStatus: z.enum(['ok', 'error', 'never']).default('never'),
  updatedAt: dateSchema.optional(),
});

export const gastoGeneralSyncSchema = z.object({
  id: z.string().min(1),
  categoria: z.enum(GASTO_CATEGORIAS).default('Otros'),
  monto: z.number().default(0),
  fecha: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const oficinaSyncSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  nombre: z.string().min(1),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const ventaSyncSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum(VENTA_TIPOS).default('Insumo'),
  origen: z.enum(VENTA_ORIGENES).default('externo'),
  machineId: z.string().nullable().optional(),
  catalogId: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  clientNameSnapshot: z.string().nullable().optional(),
  cantidad: z.number().default(1),
  precioVenta: z.number().default(0),
  costoVenta: z.number().default(0),
  fecha: z.string().min(1),
  notas: z.string().nullable().optional(),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const budgetTemplateSyncSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  tipo: z.enum(['alquiler', 'insumo', 'repuesto', 'servicio_tecnico', 'mixto', 'venta']),
  defaultIntroText: z.string().default(''),
  defaultConditionsText: z.string().default(''),
  defaultIncludesText: z.string().default(''),
  defaultExcludesText: z.string().default(''),
  defaultRequirementsText: z.string().default(''),
  defaultTaxMode: z.enum(['INCLUDED', 'ADD_21', 'PLUS_IVA', 'EXEMPT']).default('ADD_21'),
  activo: z.boolean().default(true),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const cobranzaConfigSyncSchema = z.object({
  id: z.string().default('singleton'),
  diasAvisoVencimiento: z.number().int().default(3),
  montoMinimoAlerta: z.number().default(50000),
  diasMoraCritica: z.number().int().default(15),
  plantillaEmail: z.string().default(''),
  plantillaWhatsapp: z.string().default(''),
  plantillaPreventivoEmail: z.string().default(''),
  plantillaPreventivoWhatsapp: z.string().default(''),
  plantillaDeudaVencidaEmail: z.string().default(''),
  plantillaDeudaVencidaWhatsapp: z.string().default(''),
  plantillaSegundoAvisoEmail: z.string().default(''),
  plantillaSegundoAvisoWhatsapp: z.string().default(''),
  plantillaPagoRecibidoEmail: z.string().default(''),
  plantillaPagoRecibidoWhatsapp: z.string().default(''),
  sonidosActivos: z.boolean().default(true),
  volumenSonidos: z.number().int().default(50),
  autoAlertasActivas: z.boolean().default(true),
  updatedAt: dateSchema.optional(),
});

export const syncQueueItemSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  entityType: z.enum(['clients', 'machines', 'readings', 'tickets', 'plans', 'users', 'rentals', 'budgets', 'gestiones', 'cobranzaConfig', 'payments', 'machinePresets', 'templates', 'partsCatalog', 'gastosGenerales', 'ventas']),
  operation: z.enum(['create', 'update', 'delete']),
  payload: z.any(),
  updatedAt: z.string(),
  status: z.enum(['pending', 'syncing', 'synced', 'failed']),
  retryCount: z.number().int().nonnegative().default(0),
});

