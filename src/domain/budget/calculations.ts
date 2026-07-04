import { BudgetItem, BudgetMachineConfig, TaxMode, DiscountType } from './types';

export interface BudgetFinancials {
    subtotalRaw: number;
    discountAmount: number;
    subtotalNeto: number;
    ivaAmount: number;
    total: number;
}

/**
 * Función pura centralizada para calcular los totales de un presupuesto comercial.
 */
export function calculateBudget(params: {
    items: BudgetItem[];
    machines: BudgetMachineConfig[];
    discountType: DiscountType;
    discountValue: number;
    ivaMode: TaxMode;
}): BudgetFinancials {
    const { items, machines, discountType, discountValue, ivaMode } = params;

    // 1. Calcular Subtotal Bruto
    let subtotalRaw = 0;
    
    items.forEach(item => {
        subtotalRaw += (item.cantidad || 0) * (item.precioUnitario || 0);
    });

    machines.forEach(mac => {
        subtotalRaw += (mac.cantidad || 0) * (mac.abonoBase || 0);
    });

    // 2. Calcular Descuento
    let discountAmount = 0;
    if (discountType === 'PERCENT') {
        discountAmount = subtotalRaw * ((discountValue || 0) / 100);
    } else if (discountType === 'FIXED') {
        discountAmount = discountValue || 0;
    }
    
    // El descuento no puede superar el subtotal
    discountAmount = Math.min(subtotalRaw, Math.max(0, discountAmount));

    // 3. Subtotal Neto
    const subtotalNeto = subtotalRaw - discountAmount;

    // 4. Calcular IVA
    let ivaAmount = 0;
    if (ivaMode === 'ADD_21') {
        ivaAmount = subtotalNeto * 0.21;
    }

    // 5. Total
    let total = subtotalNeto;
    if (ivaMode === 'ADD_21') {
        total = subtotalNeto + ivaAmount;
    }

    return {
        subtotalRaw,
        discountAmount,
        subtotalNeto,
        ivaAmount,
        total
    };
}
