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
        nombre: 'Alquiler de Copiadoras Multifunción',
        tipo: 'alquiler',
        defaultIntroText: 'Tenemos el agrado de presentar a ustedes nuestra propuesta formal para el alquiler de fotocopiadoras multifunción M&S Tecnología Digital.',
        defaultIncludesText: '• Suministro de todos los consumibles necesarios para el correcto funcionamiento del equipo.\n• Suministro de repuestos en caso de avería y desgaste del equipo.\n• Servicio técnico para el mantenimiento y reparación del equipo.\n• Asesoramiento sobre el manejo adecuado del equipo.\n• Instalación del equipo.\n• Capacitación del personal designado en el manejo del equipo en el momento de la instalación.',
        defaultExcludesText: '• El suministro de papel.\n• Desperfectos por mal uso del equipo o fallas eléctricas.\n• Roturas ocasionadas por el personal.',
        defaultRequirementsText: 'Para poder realizar el contrato de alquiler del equipo solicitamos:\n\nDocumentación necesaria:\n• Foto o copia del DNI.\n• Constancia de CUIL o CUIT.\n• Constancia de domicilio (puede ser un servicio a su nombre o contrato de alquiler).\n• Datos de contacto (teléfono y correo electrónico).\n\nCondiciones:\n• Firma de contrato de alquiler no menos de 6 meses y pagaré.\n• El equipo debe estar ubicado en un lugar con instalación eléctrica adecuada.',
        defaultConditionsText: 'Plazo Mínimo Contrato: 12 meses. Ajuste de Precios: Trimestral según el Índice de Precios al Consumidor (IPC). Validez de Oferta: 7 días hábiles.',
        defaultTaxMode: 'ADD_21',
        activo: true
    },
    {
        id: 'temp-insumos',
        nombre: 'Cotización de Insumos y Consumibles',
        tipo: 'insumo',
        defaultIntroText: 'Tenemos el agrado de acercarle la cotización correspondiente de insumos, tóners y consumibles originales de primera línea para garantizar el rendimiento óptimo de su parque de impresión.',
        defaultIncludesText: '• Entrega a domicilio del insumo o consumible sin cargo dentro de la zona urbana.\n• Asesoramiento técnico preventivo para verificar la correcta colocación.',
        defaultExcludesText: '• Instalación física interna o mantenimiento correctivo del equipo (se cotiza por separado).\n• Garantía por daños derivados del uso de papel inadecuado o humedad.',
        defaultRequirementsText: '• Confirmar marca, modelo exacto y número de serie del equipo para verificar compatibilidad de parte antes del despacho.',
        defaultConditionsText: 'Plazo de entrega: Sujeto a disponibilidad de stock (estimado 24/48 hs). Validez de Oferta: 5 días hábiles debido a fluctuaciones del mercado. Pago: Contado contra entrega.',
        defaultTaxMode: 'INCLUDED',
        activo: true
    },
    {
        id: 'temp-repuesto',
        nombre: 'Venta de Repuestos Técnicos',
        tipo: 'repuesto',
        defaultIntroText: 'A solicitud de su personal, presentamos la propuesta económica para la adquisición de repuestos y piezas originales para el restablecimiento operativo de sus equipos de copiado.',
        defaultIncludesText: '• Provisión de la pieza de repuesto original / legítima con certificación de origen.\n• Garantía limitada de fábrica sobre el repuesto adquirido.',
        defaultExcludesText: '• Mano de obra para la colocación/instalación física del repuesto, salvo indicación expresa.\n• Configuración de software o conectividad del equipo.',
        defaultRequirementsText: '• Firma de conformidad al recibir el repuesto.\n• Verificación técnica previa del modelo y número de serie del equipamiento de destino.',
        defaultConditionsText: 'Forma de pago: Transferencia bancaria o efectivo a la entrega del repuesto. Plazo de entrega: Inmediato sujeto a stock. Validez de Oferta: 7 días hábiles.',
        defaultTaxMode: 'ADD_21',
        activo: true
    },
    {
        id: 'temp-servicio',
        nombre: 'Servicio Técnico Especializado',
        tipo: 'servicio_tecnico',
        defaultIntroText: 'Presentamos la propuesta comercial correspondiente al servicio técnico correctivo, mantenimiento preventivo y mano de obra especializada para su parque de impresión multifunción.',
        defaultIncludesText: '• Diagnóstico exhaustivo de fallas mecánicas y electrónicas por técnicos certificados.\n• Ajuste mecánico general, limpieza óptica y calibración de arrastre de papel.',
        defaultExcludesText: '• Provisión de repuestos, rodillos de calor, películas de fusor o tóners (se presupuestan por separado).\n• Reparación de daños ocasionados por cortocircuitos eléctricos.',
        defaultRequirementsText: '• Coordinación de la visita técnica con 24 horas de antelación.\n• Acceso del técnico al lugar de emplazamiento con energía eléctrica adecuada.',
        defaultConditionsText: 'Garantía del servicio: 30 días corridos sobre la mano de obra de la falla reparada. Pago: A los 7 días de finalizado el servicio correctivo.',
        defaultTaxMode: 'ADD_21',
        activo: true
    },
    {
        id: 'temp-mixto',
        nombre: 'Propuesta Comercial Integral (Mixto)',
        tipo: 'mixto',
        defaultIntroText: 'Nos es grato presentarle nuestra propuesta comercial integral para la provisión combinada de servicios de alquiler de equipos, insumos y asistencia técnica para su organización.',
        defaultIncludesText: '• Suministro y colocación de insumos y repuestos incluidos dentro de los abonos pactados.\n• Servicio técnico especializado correctivo ilimitado.\n• Instalación, configuración en red e instrucción de uso inicial.',
        defaultExcludesText: '• Suministro de resmas de papel para impresión.\n• Reparaciones derivadas de mal uso, golpes, humedad o fluctuaciones de voltaje.',
        defaultRequirementsText: '• Firma de contrato de servicios combinados.\n• Cumplimiento de instalación eléctrica y de red adecuada en el domicilio del cliente.',
        defaultConditionsText: 'Plazo de contrato integral: 12 meses renovables. Ajuste de abonos: Trimestral según el IPC. Pago de adicionales: Del 1 al 10 de cada mes vencido. Validez de la oferta: 10 días hábiles.',
        defaultTaxMode: 'ADD_21',
        activo: true
    }
];
