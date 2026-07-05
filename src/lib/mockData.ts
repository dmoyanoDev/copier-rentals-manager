export interface Client {
    id: string;
    name: string;
    cuit: string;
    taxCategory: 'Responsable Inscripto' | 'Monotributista' | 'Exento';
    address: string;
    phone: string;
    email: string;
    debt: number;
}

export interface Abono {
    id: string;
    name: string;
    price: number;
    limit: number;
    excessPrice: number;
}

export interface Machine {
    id: string;
    clientId: string | null; // null means Available
    abonoId: string | null;
    brand: string;
    model: string;
    serial: string;
    type: 'B&N' | 'Color';
    currentCounter: number;
    lastServiceCounter: number;
    preventiveInterval: number; // in copies, e.g. 15000
    status: 'Disponible' | 'Alquilada' | 'En Taller' | 'Alerta Técnica';
    applyIva: boolean;
}

export interface Reading {
    id: string;
    machineId: string;
    month: string; // YYYY-MM
    initial: number;
    final: number;
    excessCount: number;
    excessPrice: number;
    netAmount: number;
    ivaAmount: number;
    totalAmount: number;
    status: 'pending' | 'paid';
    readingStatus: 'cargada' | 'observada' | 'validada' | 'facturada';
    readingComment?: string;
    history?: { date: string; time: string; action: string; user: string; }[];
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
    date: string; // YYYY-MM-DD
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
}

export const mockUsers: User[] = [
    { id: 'user-admin', username: 'dmoyano', fullname: 'Darío Moyano', email: 'dmoyano@mstecnologia.com.ar', role: 'administrativo' },
    { 
        id: 'user-tech1', 
        username: 'tech1', 
        fullname: 'Marcelo Gómez', 
        email: 'mgomez@mstecnologia.com.ar', 
        role: 'tecnico', 
        phone: '381-4523190',
        whatsapp: '3814523190',
        zone: 'San Miguel de Tucumán (Centro / Norte)',
        specialty: 'HP / Brother / Ricoh Monocromática',
        availability: 'Disponible',
        active: true,
        workHours: '08:00 a 17:00 hs',
        internalNotes: 'Especialista en unidades de fusor y arrastre de papel.'
    },
    { 
        id: 'user-tech2', 
        username: 'tech2', 
        fullname: 'Lucas Peralta', 
        email: 'lperalta@mstecnologia.com.ar', 
        role: 'tecnico', 
        phone: '381-9988776',
        whatsapp: '3819988776',
        zone: 'Yerba Buena / Lules',
        specialty: 'Konica Minolta Color / Ricoh Color',
        availability: 'Disponible',
        active: true,
        workHours: '09:00 a 18:00 hs',
        internalNotes: 'Técnico certificado con experiencia en equipos de producción color.'
    }
];

export const mockAbonos: Abono[] = [
    { id: 'abono-basic', name: 'Plan Básico 2000', price: 45000, limit: 2000, excessPrice: 15.5 },
    { id: 'abono-medium', name: 'Plan Pyme 5000', price: 95000, limit: 5000, excessPrice: 12.0 },
    { id: 'abono-premium', name: 'Plan Corporativo 15000', price: 240000, limit: 15000, excessPrice: 9.0 },
    { id: 'abono-color', name: 'Plan Color Corporativo 5000', price: 180000, limit: 5000, excessPrice: 28.0 }
];

export const mockClients: Client[] = [
    { id: 'c-1', name: 'Estudio Contable Pérez & Asoc.', cuit: '30-71123456-9', taxCategory: 'Responsable Inscripto', address: 'Av. Corrientes 1245, CABA', phone: '11-4382-9900', email: 'info@perezcontable.com.ar', debt: 0 },
    { id: 'c-2', name: 'Sanatorio Güemes - Adm.', cuit: '30-54612345-8', taxCategory: 'Responsable Inscripto', address: 'Francisco Acuña de Figueroa 1240, CABA', phone: '11-4959-8200', email: 'compras@sg.com.ar', debt: 180000 },
    { id: 'c-3', name: 'Colegio San Martín', cuit: '30-99887766-5', taxCategory: 'Exento', address: 'Av. Santa Fe 3400, Palermo, CABA', phone: '11-4821-3030', email: 'administracion@colegiosanmartin.edu.ar', debt: 0 },
    { id: 'c-4', name: 'Logística Sur S.A.', cuit: '30-66228833-2', taxCategory: 'Responsable Inscripto', address: 'Ruta 4 Km 12, Lomas de Zamora', phone: '11-3990-2211', email: 'mantenimiento@logsur.com.ar', debt: 45000 }
];

export const mockMachines: Machine[] = [
    { id: 'm-1', clientId: 'c-1', abonoId: 'abono-basic', brand: 'HP', model: 'LaserJet M428fdw', serial: 'CNB8M5Z99K', type: 'B&N', currentCounter: 14520, lastServiceCounter: 10000, preventiveInterval: 15000, status: 'Alquilada', applyIva: true },
    { id: 'm-2', clientId: 'c-2', abonoId: 'abono-premium', brand: 'Ricoh', model: 'MP 5055', serial: 'W891234567A', type: 'B&N', currentCounter: 254800, lastServiceCounter: 245000, preventiveInterval: 20000, status: 'Alquilada', applyIva: true },
    { id: 'm-3', clientId: 'c-3', abonoId: 'abono-medium', brand: 'Brother', model: 'MFC-L6900DW', serial: 'U64188M7N888', type: 'B&N', currentCounter: 89600, lastServiceCounter: 70000, preventiveInterval: 25000, status: 'Alerta Técnica', applyIva: false },
    { id: 'm-4', clientId: 'c-2', abonoId: 'abono-color', brand: 'Konica Minolta', model: 'bizhub C250i', serial: 'AAV12300456', type: 'Color', currentCounter: 67320, lastServiceCounter: 60000, preventiveInterval: 15000, status: 'Alquilada', applyIva: true },
    { id: 'm-5', clientId: null, abonoId: null, brand: 'HP', model: 'LaserJet M428fdw', serial: 'CNB8M5Z98L', type: 'B&N', currentCounter: 0, lastServiceCounter: 0, preventiveInterval: 15000, status: 'Disponible', applyIva: true }
];

export const mockReadings: Reading[] = [
    { id: 'r-1', machineId: 'm-1', month: '2026-06', initial: 12100, final: 13900, excessCount: 0, excessPrice: 15.5, netAmount: 45000, ivaAmount: 9450, totalAmount: 54450, status: 'paid', readingStatus: 'validada' },
    { id: 'r-2', machineId: 'm-2', month: '2026-06', initial: 235000, final: 252000, excessCount: 2000, excessPrice: 9.0, netAmount: 258000, ivaAmount: 54180, totalAmount: 312180, status: 'pending', readingStatus: 'validada' },
    { id: 'r-3', machineId: 'm-3', month: '2026-06', initial: 84100, final: 89600, excessCount: 500, excessPrice: 12.0, netAmount: 101000, ivaAmount: 0, totalAmount: 101000, status: 'paid', readingStatus: 'cargada' },
    { id: 'r-4', machineId: 'm-4', month: '2026-06', initial: 61200, final: 67320, excessCount: 1120, excessPrice: 28.0, netAmount: 211360, ivaAmount: 44385.6, totalAmount: 255745.6, status: 'pending', readingStatus: 'observada', readingComment: 'Consumo saltó un 80% respecto al mes anterior' }
];

export const mockTickets: Ticket[] = [
    {
        id: 't-1',
        machineId: 'm-3',
        clientId: 'c-3',
        clientName: 'Colegio San Martín',
        clientAddress: 'Av. Santa Fe 3400, Palermo, CABA',
        clientPhone: '11-4821-3030',
        clientEmail: 'administracion@colegiosanmartin.edu.ar',
        clientContact: 'Secretaría de Rectoría',
        machineDesc: 'Brother MFC-L6900DW',
        serialNumber: 'U64188M7N888',
        clientType: 'existente',
        date: '2026-07-01',
        time: '09:30',
        priority: 'alta',
        status: 'asignado',
        category: 'Atasco de papel',
        description: 'Papel trabado constantemente en la unidad de fusión.',
        diagnostic: 'Rodillo fusor con desgaste prematuro y acumulación de tóner.',
        actionTaken: '',
        partsNeeded: 'Filmina fusora Brother 6900',
        partsUsed: '',
        internalNotes: 'Tener especial cuidado al desarmar unidad trasera.',
        assignedTechId: 'user-tech1',
        slaDate: '2026-07-02T13:30:00.000Z',
        createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
        history: [
            { date: '2026-07-01', time: '09:30', action: 'Ticket Creado', user: 'dmoyano' },
            { date: '2026-07-01', time: '11:00', action: 'Asignado a Marcelo Gómez', user: 'dmoyano' }
        ]
    },
    {
        id: 't-2',
        machineId: 'm-4',
        clientId: 'c-2',
        clientName: 'Sanatorio Güemes - Adm.',
        clientAddress: 'Francisco Acuña de Figueroa 1240, CABA',
        clientPhone: '11-4959-8200',
        clientEmail: 'compras@sg.com.ar',
        clientContact: 'Mantenimiento General',
        machineDesc: 'Konica Minolta bizhub C250i',
        serialNumber: 'AAV12300456',
        clientType: 'existente',
        date: '2026-07-03',
        time: '14:20',
        priority: 'media',
        status: 'en-proceso',
        category: 'Calidad de impresión',
        description: 'Líneas blancas en las impresiones a color.',
        diagnostic: 'Láser sucio y unidad de tambor magenta desgastada.',
        actionTaken: 'Limpieza de espejos láser y ajuste de transferencia.',
        partsNeeded: '',
        partsUsed: 'Kit de limpieza estándar',
        internalNotes: 'Se recomendó cambiar el tambor magenta en la próxima visita.',
        assignedTechId: 'user-tech2',
        slaDate: '2026-07-05T14:20:00.000Z',
        createdAt: Date.now() - 24 * 60 * 60 * 1000,
        history: [
            { date: '2026-07-03', time: '14:20', action: 'Ticket Creado', user: 'dmoyano' },
            { date: '2026-07-03', time: '15:00', action: 'Cambio de estado a En Proceso', user: 'tech2' }
        ]
    }
];
