import { MachinePreset, BudgetTemplate } from './types';

export const defaultMachinePresets: MachinePreset[] = [
    {
        id: 'preset-hp-432',
        marca: 'HP',
        modelo: 'Laser MFP 432fdn',
        nombreComercial: 'HP Laser MFP 432fdn',
        tipo: 'Monocromática (B&N)',
        ppm: 42,
        funciones: 'Impresión, copia, escaneo, fax',
        duplex: true,
        escaner: true,
        adf: true,
        conectividad: 'Red Gigabit Ethernet + USB 2.0',
        papel: 'A4, Carta, Oficio',
        pantalla: 'LCD de 2 líneas',
        memoria: '256 MB',
        capacidadPapel: 'Bandeja de 250 hojas + multipropósito de 50 hojas',
        technicalSummary: 'Multifuncional láser monocromática de alta velocidad para oficina. Velocidad de hasta 42 ppm, resolución de 1200x1200dpi, doble faz automática, recomendada para volumen mensual de hasta 3.500 páginas.',
        commercialNotes: 'Ideal para pymes o departamentos pequeños con requerimiento básico de impresión en blanco y negro y escaneo ágil.',
        activo: true
    },
    {
        id: 'preset-brother-5660',
        marca: 'Brother',
        modelo: 'DCP-L5660DN',
        nombreComercial: 'Brother DCP-L5660DN',
        tipo: 'Monocromática (B&N)',
        ppm: 50,
        funciones: 'Impresión, copia, escaneo dúplex',
        duplex: true,
        escaner: true,
        adf: true,
        conectividad: 'Gigabit Ethernet + USB 2.0 + Impresión Móvil',
        papel: 'A4, Carta, Legal, Ejecutivo',
        pantalla: 'Pantalla táctil color de 3.5 pulgadas',
        memoria: '512 MB',
        capacidadPapel: 'Bandeja de 250 hojas (expandible) + multipropósito de 100 hojas',
        technicalSummary: 'Multifuncional láser empresarial de alta durabilidad. Velocidad de hasta 50 ppm, resolución 1200x1200dpi, ADF de 70 hojas con escaneo dúplex de un solo paso, recomendada para volumen de hasta 5.000 hojas.',
        commercialNotes: 'Equipo de gran robustez ideal para alto tráfico de copiado y escaneo digital en red corporativa.',
        activo: true
    },
    {
        id: 'preset-ricoh-430',
        marca: 'Ricoh',
        modelo: 'IM 430F',
        nombreComercial: 'Ricoh IM 430F',
        tipo: 'Monocromática (B&N)',
        ppm: 45,
        funciones: 'Impresión, copia, escaneo, fax',
        duplex: true,
        escaner: true,
        adf: true,
        conectividad: 'Ethernet Gigabit + USB + Lector de tarjetas SD',
        papel: 'A4, Carta, Oficio, Legal',
        pantalla: 'Panel de operación inteligente táctil de 10.1 pulgadas (Android)',
        memoria: '2 GB RAM + 320 GB HDD',
        capacidadPapel: 'Bandeja de 500 hojas + bypass de 100 hojas (máximo 2.100 hojas)',
        technicalSummary: 'Multifunción B/N de alta gama. Velocidad de 45 ppm, panel inteligente táctil, disco rígido integrado de seguridad, SPDF de paso único de 50 hojas. Integración total con aplicaciones en la nube.',
        commercialNotes: 'Equipo corporativo premium. Su panel interactivo permite accesos directos personalizados y digitalización directa a carpetas de red.',
        activo: true
    }
];

export const defaultBudgetTemplates: BudgetTemplate[] = [
    {
        id: 'temp-alquiler',
        nombre: 'Plantilla de Alquiler Estándar',
        tipo: 'alquiler',
        defaultIntroText: 'Nos complace presentar nuestra propuesta formal para el alquiler y provisión de equipamiento de copiado e impresión multifunción para vuestra organización, detallando características del equipo y condiciones del abono mensual.',
        defaultConditionsText: 'Plazo mínimo de contrato: 12 meses. Ajuste de precios: Trimestral según el Índice de Precios al Consumidor (IPC). Validez de la oferta: 15 días corridos a partir de la fecha de emisión.',
        defaultIncludesText: 'Consumibles y tóners incluidos (excepto papel), Repuestos legítimos por desgaste u avería del equipo sin cargo adicional, Servicio técnico preventivo y correctivo oficial en un plazo menor a 24 horas hábiles, Capacitación del personal de uso e instalación inicial.',
        defaultExcludesText: 'Papel para impresión, Operador del equipo, Daños ocasionados por negligencia, mal uso o siniestros ajenos al desgaste normal, Instalación eléctrica inadecuada o problemas de red local.',
        defaultRequirementsText: 'Constancia de CUIT/CUIL, Acreditación de Domicilio Comercial de Instalación, Firma de contrato de locación mínimo de 12 meses, Instalación eléctrica certificada con cable a tierra exclusivo para la copiadora.',
        defaultTaxMode: 'ADD_21',
        activo: true
    },
    {
        id: 'temp-servicio',
        nombre: 'Plantilla de Servicio Técnico',
        tipo: 'servicio_tecnico',
        defaultIntroText: 'Detallamos a continuación el presupuesto correspondiente al servicio técnico correctivo, diagnóstico de fallas y mano de obra para la reparación del equipamiento de impresión solicitado por su personal.',
        defaultConditionsText: 'Mano de obra y reparaciones garantizadas por un periodo de 30 días únicamente sobre la falla reparada. Forma de pago: Transferencia bancaria a 7 días de finalizado el servicio técnico.',
        defaultIncludesText: 'Diagnóstico en taller o planta del cliente, Ajustes mecánicos y calibraciones generales del equipo tras el servicio correctivo.',
        defaultExcludesText: 'Repuestos que deban ser reemplazados (se presupuestan por separado), Reparación de otras fallas no declaradas en la solicitud inicial.',
        defaultRequirementsText: 'Coordinación previa de horario de visita técnica con un mínimo de 12 horas de anticipación.',
        defaultTaxMode: 'ADD_21',
        activo: true
    },
    {
        id: 'temp-insumos',
        nombre: 'Plantilla de Insumos y Repuestos',
        tipo: 'insumo',
        defaultIntroText: 'Presupuesto de insumos, tóners y repuestos mecánicos originales solicitados para la flota de impresión de su firma.',
        defaultConditionsText: 'Forma de pago: Contado contra entrega. Los precios indicados no sufren alteración durante la validez de la oferta.',
        defaultIncludesText: 'Envío e instalación del tóner / repuesto en el domicilio del cliente sin cargo extra.',
        defaultExcludesText: 'Cualquier otro repuesto o insumo no detallado explícitamente en el listado de este presupuesto.',
        defaultRequirementsText: 'Verificar compatibilidad exacta del modelo de cartucho con el número de serie de su equipo antes de confirmar.',
        defaultTaxMode: 'INCLUDED',
        activo: true
    }
];
