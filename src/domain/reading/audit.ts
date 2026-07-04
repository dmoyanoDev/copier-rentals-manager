export interface ReadingAuditInput {
  initial: number;
  final: number;
  limit: number;
  price: number;
  excessPrice: number;
  applyIva: boolean;
  ivaRate: number;
  isUnofficial: boolean;
  creditNote: number;
  debitNote: number;
  billingStatus: string;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  historicalReadings: { initial: number; final: number }[];
}

export interface ReadingAlert {
  type: 'danger' | 'warning';
  message: string;
}

/**
 * Realiza una auditoría automatizada sobre los datos de lectura ingresados
 * para detectar anomalías y emitir advertencias de negocio.
 */
export function auditReading(input: ReadingAuditInput): ReadingAlert[] {
  const alerts: ReadingAlert[] = [];
  const diff = input.final - input.initial;

  // 1. Lectura Final < Inicial
  if (input.final < input.initial) {
    alerts.push({
      type: 'danger',
      message: 'Lectura final es menor que la lectura inicial.',
    });
  }

  // 2. Inicial en cero y final alta
  if (input.initial === 0 && input.final > 10000) {
    alerts.push({
      type: 'danger',
      message: 'Lectura inicial está en cero y la lectura final es extremadamente alta.',
    });
  }

  // 3. Excedente desproporcionado (excess > 3x limit)
  const excess = Math.max(0, diff - input.limit);
  if (input.limit > 0 && excess > input.limit * 3) {
    alerts.push({
      type: 'warning',
      message: `El excedente (${excess.toLocaleString('es-AR')}) es desproporcionado respecto al límite del plan (${input.limit.toLocaleString('es-AR')}).`,
    });
  }

  // 4. Monto total fuera de rango normal
  const excCost = excess * input.excessPrice;
  const netCost = input.price + excCost;
  const actualIvaRate = (!input.isUnofficial && input.applyIva) ? input.ivaRate : 0;
  const ivaCost = netCost * (actualIvaRate / 100);
  const total = netCost + ivaCost - input.creditNote + input.debitNote;

  if (total > 500000 || (input.price > 0 && total > input.price * 4)) {
    alerts.push({
      type: 'warning',
      message: `El monto total (${total.toLocaleString('es-AR')}) está fuera de rango normal respecto al precio base (${input.price.toLocaleString('es-AR')}).`,
    });
  }

  // 5. Consumo mensual supera el promedio histórico
  if (input.historicalReadings.length >= 2) {
    const validHistory = input.historicalReadings.filter(r => r.final > r.initial);
    if (validHistory.length >= 2) {
      const sum = validHistory.reduce((acc, curr) => acc + (curr.final - curr.initial), 0);
      const avg = sum / validHistory.length;
      if (avg > 0 && diff > avg * 2) {
        alerts.push({
          type: 'warning',
          message: `Consumo mensual (${diff.toLocaleString('es-AR')}) supera en más del 100% el promedio histórico (${Math.round(avg).toLocaleString('es-AR')}).`,
        });
      }
    }
  }

  // 6. Datos faltantes para facturación
  if (input.billingStatus === 'facturada' && (!input.invoiceNumber || !input.invoiceDate)) {
    alerts.push({
      type: 'warning',
      message: 'Estado es Facturada pero no se ingresó número de factura o fecha de emisión.',
    });
  }

  return alerts;
}
