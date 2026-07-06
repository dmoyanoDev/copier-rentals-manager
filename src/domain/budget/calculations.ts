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

    // 1. Calcular Subtotal Bruto y descuentos por línea
    let subtotalRaw = 0;
    let itemsDiscountAmount = 0;
    
    items.forEach(item => {
        const lineBruto = (item.cantidad || 0) * (item.precioUnitario || 0);
        subtotalRaw += lineBruto;
        
        let disc = 0;
        if (item.descuento) {
            disc = Math.min(lineBruto, Math.max(0, item.descuento));
        }
        itemsDiscountAmount += disc;
    });

    machines.forEach(mac => {
        subtotalRaw += (mac.cantidad || 0) * (mac.abonoBase || 0);
    });

    // 2. Calcular Descuento General
    let generalDiscountAmount = 0;
    const subtotalAfterLineDiscounts = subtotalRaw - itemsDiscountAmount;
    
    if (discountType === 'PERCENT') {
        generalDiscountAmount = subtotalAfterLineDiscounts * ((discountValue || 0) / 100);
    } else if (discountType === 'FIXED') {
        generalDiscountAmount = discountValue || 0;
    }
    
    // El descuento general no puede superar el subtotal remanente
    generalDiscountAmount = Math.min(subtotalAfterLineDiscounts, Math.max(0, generalDiscountAmount));

    const discountAmount = itemsDiscountAmount + generalDiscountAmount;

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
