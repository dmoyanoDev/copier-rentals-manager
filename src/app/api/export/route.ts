import { NextResponse } from 'next/server';
import { addAuditLogAction } from '@/app/actions/audit';
import { getSession } from '@/infrastructure/auth/session';

function escapeCSVCell(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // Replace double quotes with escaped double quotes
  str = str.replace(/"/g, '""');
  // Wrap in quotes if it contains commas, newlines, or quotes
  if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
    return `"${str}"`;
  }
  return str;
}

/**
 * POST: Genera y descarga un archivo exportado en CSV o JSON.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    // Antes se tomaba de la query string sin validar sesion — cualquiera podia
    // atribuir la entrada de auditoria a cualquier usuario (spoofing).
    const user = session.username || searchParams.get('user') || 'dmoyano';

    const payload = await request.json();
    const { module, format, data } = payload;

    if (!module || !format || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Parámetros de exportación inválidos.' }, { status: 400 });
    }

    let fileContent = '';
    let contentType = 'text/plain';
    let fileExtension = 'txt';

    if (format === 'json') {
      fileContent = JSON.stringify(data, null, 2);
      contentType = 'application/json';
      fileExtension = 'json';
    } else if (format === 'csv') {
      contentType = 'text/csv;charset=utf-8';
      fileExtension = 'csv';

      if (data.length === 0) {
        fileContent = 'No hay datos para exportar';
      } else {
        // Extract headers from keys of first object
        const sample = data[0];
        const headers = Object.keys(sample);
        const headerRow = headers.map(escapeCSVCell).join(',');
        
        const rows = data.map(item => {
          return headers.map(h => escapeCSVCell(item[h])).join(',');
        });

        // Add BOM (Byte Order Mark) for Excel UTF-8 compatibility
        fileContent = '\uFEFF' + [headerRow, ...rows].join('\n');
      }
    }

    // Log this export audit log entry
    await addAuditLogAction({
      module: 'datos',
      action: 'exportar',
      details: `Exportación del módulo "${module.toUpperCase()}" generada con éxito en formato ${format.toUpperCase()}. Total registros: ${data.length}.`,
      user
    });

    return new Response(fileContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="export_${module}_${new Date().toISOString().split('T')[0]}.${fileExtension}"`,
      },
    });
  } catch (error: any) {
    console.error('Error al exportar datos:', error);
    return NextResponse.json({ error: 'Error del servidor al exportar datos: ' + error.message }, { status: 500 });
  }
}
