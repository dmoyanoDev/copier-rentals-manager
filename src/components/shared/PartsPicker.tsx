'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import { PartCatalogItem, PartUsageEntry } from '@/domain/types';
import { formatCurrency } from '@/lib/utils';

export interface PartsPickerProps {
  catalog: PartCatalogItem[];
  value: PartUsageEntry[];
  onChange: (items: PartUsageEntry[]) => void;
  disabled?: boolean;
}

export const PartsPicker: React.FC<PartsPickerProps> = ({ catalog, value, onChange, disabled }) => {
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState('1');

  const activeCatalog = catalog.filter(c => c.activo !== false);

  const handleAdd = () => {
    // Sin este guard, "Agregar" sin nada seleccionado en el Select (placeholder value='')
    // pasaba la validación local (el ticket tiene de sobra otros campos válidos), mostraba
    // "guardado" y fallaba la sincronización real en silencio — mismo patrón de bug ya
    // encontrado esta sesión con selects + campos requeridos.
    if (!selectedId) return;
    const item = catalog.find(c => c.id === selectedId);
    if (!item) return;
    const cantidad = parseFloat(qty);
    if (isNaN(cantidad) || cantidad <= 0) return;

    const existing = value.find(v => v.catalogId === item.id);
    const nextItems = existing
      ? value.map(v => v.catalogId === item.id ? { ...v, cantidad: v.cantidad + cantidad } : v)
      : [...value, {
          catalogId: item.id,
          nombre: item.nombre,
          categoria: item.categoria,
          unidad: item.unidad,
          cantidad,
          costoUnitario: item.costoUnitario,
        }];
    onChange(nextItems);
    setSelectedId('');
    setQty('1');
  };

  const handleRemove = (catalogId: string) => {
    onChange(value.filter(v => v.catalogId !== catalogId));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={disabled}
            options={[
              { value: '', label: activeCatalog.length ? 'Seleccionar ítem...' : 'Sin ítems en el catálogo' },
              ...activeCatalog.map(c => ({ value: c.id, label: `${c.nombre} (${c.categoria})` })),
            ]}
          />
        </div>
        <div className="w-20">
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={disabled}
          />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={handleAdd} disabled={disabled || !selectedId}>
          Agregar
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(v => (
            <span
              key={v.catalogId}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-850 border border-slate-800 text-[11px] text-slate-200"
            >
              {v.nombre} × {v.cantidad} {v.unidad}
              {v.costoUnitario > 0 && (
                <span className="text-slate-450">({formatCurrency(v.costoUnitario * v.cantidad)})</span>
              )}
              {!disabled && (
                <button type="button" onClick={() => handleRemove(v.catalogId)} className="text-slate-450 hover:text-red-400 cursor-pointer">
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
