import { NextResponse } from 'next/server';

function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentCell = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentCell.trim());
      if (row.some(c => c !== '')) {
        lines.push(row);
      }
      row = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell || row.length > 0) {
    row.push(currentCell.trim());
    if (row.some(c => c !== '')) {
      lines.push(row);
    }
  }
  return lines;
}

/**
 * POST: Procesa un archivo CSV y devuelve la previsualización y validación.
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { module, csvText, existingData } = payload;

    if (!module || !csvText) {
      return NextResponse.json({ error: 'Parámetros de importación incompletos.' }, { status: 400 });
    }

    const lines = parseCSV(csvText);
    if (lines.length < 2) {
      return NextResponse.json({ error: 'El archivo CSV debe contener una fila de encabezados y al menos una fila de datos.' }, { status: 400 });
    }

    const headers = lines[0].map(h => h.toLowerCase().trim());
    const dataRows = lines.slice(1);

    const preview: any[] = [];
    const errors: string[] = [];
    const duplicates: any[] = [];

    // Helper functions for duplicate check in existing data arrays sent by the client
    const existingClients = existingData?.clients || [];
    const existingMachines = existingData?.machines || [];
    const existingReadings = existingData?.readings || [];

    if (module === 'clientes') {
      // Expected headers mapping
      const nameIdx = headers.findIndex(h => h === 'nombre' || h === 'name');
      const cuitIdx = headers.findIndex(h => h === 'cuit');
      const taxIdx = headers.findIndex(h => h === 'categoria_iva' || h === 'taxcategory');
      const addressIdx = headers.findIndex(h => h === 'direccion' || h === 'address');
      const phoneIdx = headers.findIndex(h => h === 'telefono' || h === 'phone');
      const emailIdx = headers.findIndex(h => h === 'email');
      const notesIdx = headers.findIndex(h => h === 'notas' || h === 'notes');

      if (nameIdx === -1 || cuitIdx === -1) {
        return NextResponse.json({ error: 'El CSV de clientes debe incluir obligatoriamente las columnas "Nombre" y "CUIT".' }, { status: 400 });
      }

      dataRows.forEach((row, index) => {
        const lineNum = index + 2;
        const name = row[nameIdx]?.trim() || '';
        const cuit = row[cuitIdx]?.trim() || '';
        const taxCategory = row[taxIdx]?.trim() || 'Responsable Inscripto';
        const address = row[addressIdx]?.trim() || '';
        const phone = row[phoneIdx]?.trim() || '';
        const email = row[emailIdx]?.trim() || '';
        const notes = row[notesIdx]?.trim() || '';

        const rowErrors: string[] = [];

        if (!name) {
          rowErrors.push(`Línea ${lineNum}: El nombre es obligatorio.`);
        }
        if (!cuit) {
          rowErrors.push(`Línea ${lineNum}: El CUIT es obligatorio.`);
        } else {
          // Normalize cuit for validation (removing spaces and hyphens)
          const cleanCuit = cuit.replace(/[^0-9]/g, '');
          if (cleanCuit.length !== 11) {
            rowErrors.push(`Línea ${lineNum}: CUIT inválido "${cuit}". Debe tener 11 dígitos.`);
          }
        }

        const isDuplicate = existingClients.some((c: any) => c.cuit === cuit);

        const mappedItem = {
          id: 'client-import-' + Date.now() + '-' + index,
          name,
          cuit,
          taxCategory: ['Responsable Inscripto', 'Monotributista', 'Exento'].includes(taxCategory) ? taxCategory : 'Responsable Inscripto',
          address,
          phone,
          email,
          notes,
          debt: 0,
          active: true,
          isValid: rowErrors.length === 0,
          errors: rowErrors,
          isDuplicate
        };

        preview.push(mappedItem);
        if (rowErrors.length > 0) {
          errors.push(...rowErrors);
        }
        if (isDuplicate) {
          duplicates.push({ line: lineNum, label: `${name} (CUIT: ${cuit})` });
        }
      });

    } else if (module === 'maquinas') {
      const brandIdx = headers.findIndex(h => h === 'marca' || h === 'brand');
      const modelIdx = headers.findIndex(h => h === 'modelo' || h === 'model');
      const serialIdx = headers.findIndex(h => h === 'serie' || h === 'serial');
      const typeIdx = headers.findIndex(h => h === 'tipo' || h === 'type');
      const statusIdx = headers.findIndex(h => h === 'estado' || h === 'status');
      const counterIdx = headers.findIndex(h => h === 'contador' || h === 'currentcounter');
      const intervalIdx = headers.findIndex(h => h === 'intervalo_preventivo' || h === 'preventiveinterval');
      const applyIvaIdx = headers.findIndex(h => h === 'aplica_iva' || h === 'applyiva');

      if (brandIdx === -1 || modelIdx === -1 || serialIdx === -1) {
        return NextResponse.json({ error: 'El CSV de máquinas debe incluir obligatoriamente las columnas "Marca", "Modelo" y "Serie".' }, { status: 400 });
      }

      dataRows.forEach((row, index) => {
        const lineNum = index + 2;
        const brand = row[brandIdx]?.trim() || '';
        const model = row[modelIdx]?.trim() || '';
        const serial = row[serialIdx]?.trim() || '';
        const type = row[typeIdx]?.trim() || 'B&N';
        const status = row[statusIdx]?.trim() || 'Disponible';
        const currentCounter = parseInt(row[counterIdx]?.trim() || '0', 10);
        const preventiveInterval = parseInt(row[intervalIdx]?.trim() || '15000', 10);
        const applyIva = row[applyIvaIdx]?.trim().toLowerCase() === 'si' || row[applyIvaIdx]?.trim().toLowerCase() === 'true';

        const rowErrors: string[] = [];

        if (!brand) rowErrors.push(`Línea ${lineNum}: La marca es obligatoria.`);
        if (!model) rowErrors.push(`Línea ${lineNum}: El modelo es obligatorio.`);
        if (!serial) rowErrors.push(`Línea ${lineNum}: El número de serie es obligatorio.`);
        if (isNaN(currentCounter) || currentCounter < 0) {
          rowErrors.push(`Línea ${lineNum}: El contador de copias debe ser un número entero válido.`);
        }

        const isDuplicate = existingMachines.some((m: any) => m.serial === serial);

        const mappedItem = {
          id: 'machine-import-' + Date.now() + '-' + index,
          clientId: null,
          abonoId: null,
          brand,
          model,
          serial,
          type: type === 'Color' ? 'Color' : 'B&N',
          currentCounter: isNaN(currentCounter) ? 0 : currentCounter,
          lastServiceCounter: isNaN(currentCounter) ? 0 : currentCounter,
          preventiveInterval: isNaN(preventiveInterval) ? 15000 : preventiveInterval,
          status: ['Disponible', 'Alquilada', 'En Taller', 'Alerta Técnica'].includes(status) ? status : 'Disponible',
          applyIva,
          isValid: rowErrors.length === 0,
          errors: rowErrors,
          isDuplicate
        };

        preview.push(mappedItem);
        if (rowErrors.length > 0) {
          errors.push(...rowErrors);
        }
        if (isDuplicate) {
          duplicates.push({ line: lineNum, label: `${brand} ${model} (S/N: ${serial})` });
        }
      });

    } else if (module === 'lecturas') {
      const serialIdx = headers.findIndex(h => h === 'serie_copiadora' || h === 'machineserial' || h === 'serial');
      const monthIdx = headers.findIndex(h => h === 'mes' || h === 'month');
      const initialIdx = headers.findIndex(h => h === 'inicial' || h === 'initial');
      const finalIdx = headers.findIndex(h => h === 'final' || h === 'final');
      const commentIdx = headers.findIndex(h => h === 'comentario' || h === 'readingcomment' || h === 'comment');

      if (serialIdx === -1 || monthIdx === -1 || initialIdx === -1 || finalIdx === -1) {
        return NextResponse.json({ error: 'El CSV de lecturas debe incluir las columnas "Serie_Copiadora", "Mes" (AAAA-MM), "Inicial" y "Final".' }, { status: 400 });
      }

      dataRows.forEach((row, index) => {
        const lineNum = index + 2;
        const serial = row[serialIdx]?.trim() || '';
        const month = row[monthIdx]?.trim() || '';
        const initial = parseInt(row[initialIdx]?.trim() || '0', 10);
        const final = parseInt(row[finalIdx]?.trim() || '0', 10);
        const readingComment = row[commentIdx]?.trim() || '';

        const rowErrors: string[] = [];

        if (!serial) rowErrors.push(`Línea ${lineNum}: El número de serie de copiadora es obligatorio.`);
        
        const monthRegex = /^\d{4}-\d{2}$/;
        if (!month || !monthRegex.test(month)) {
          rowErrors.push(`Línea ${lineNum}: El mes debe tener formato AAAA-MM (ej. 2026-07).`);
        }

        if (isNaN(initial) || initial < 0) {
          rowErrors.push(`Línea ${lineNum}: El contador inicial debe ser un número entero válido.`);
        }
        if (isNaN(final) || final < 0) {
          rowErrors.push(`Línea ${lineNum}: El contador final debe ser un número entero válido.`);
        }
        if (!isNaN(initial) && !isNaN(final) && final < initial) {
          rowErrors.push(`Línea ${lineNum}: El contador final no puede ser menor al inicial.`);
        }

        // Find associated machine in state to link properly
        const machine = existingMachines.find((m: any) => m.serial === serial);
        if (!machine && serial) {
          rowErrors.push(`Línea ${lineNum}: No se encontró ninguna copiadora en inventario con S/N "${serial}".`);
        }

        const isDuplicate = machine && existingReadings.some((r: any) => r.machineId === machine.id && r.month === month);

        const mappedItem = {
          id: 'reading-import-' + Date.now() + '-' + index,
          machineId: machine ? machine.id : 'unknown',
          machineSerial: serial,
          month,
          initial: isNaN(initial) ? 0 : initial,
          final: isNaN(final) ? 0 : final,
          excessCount: 0,
          excessPrice: 0,
          netAmount: 0,
          ivaAmount: 0,
          totalAmount: 0,
          status: 'pending',
          readingStatus: 'cargada',
          readingComment: readingComment || undefined,
          isValid: rowErrors.length === 0,
          errors: rowErrors,
          isDuplicate
        };

        preview.push(mappedItem);
        if (rowErrors.length > 0) {
          errors.push(...rowErrors);
        }
        if (isDuplicate) {
          duplicates.push({ line: lineNum, label: `Lectura S/N: ${serial} - Mes: ${month}` });
        }
      });
    }

    const stats = {
      total: preview.length,
      ready: preview.filter(item => item.isValid).length,
      errors: preview.filter(item => !item.isValid).length,
      duplicates: duplicates.length
    };

    return NextResponse.json({
      success: true,
      preview,
      stats,
      errors,
      duplicates
    });

  } catch (error: any) {
    console.error('Error al procesar CSV para importación:', error);
    return NextResponse.json({ error: 'Error del servidor al procesar archivo: ' + error.message }, { status: 500 });
  }
}
