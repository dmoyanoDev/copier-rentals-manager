import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { dollarSettings } from '@/infrastructure/db/schema/dollarSettings';
import { getSession } from '@/infrastructure/auth/session';
import { ensureSchemaSynced } from '@/app/api/backup/route';
import { eq } from 'drizzle-orm';

const DOLAR_API_URL = 'https://dolarapi.com/v1/dolares';
const FETCH_TIMEOUT_MS = 5000;

// Cotización de referencia (oficial/blue) — sirve solo para mostrar en el panel, nunca
// para calcular precios (eso usa dollarSettings.manualStockRate, editado por el usuario).
// dolarapi.com en vez de scrapear lanacion.com.ar: es una API JSON pública, sin key,
// pensada exactamente para esto — scrapear esa página HTML sería frágil (rompe con
// cualquier cambio de diseño) y no es necesario cuando existe una fuente ya estructurada.
async function fetchReferenceQuotes(): Promise<{ oficial: number | null; blue: number | null } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(DOLAR_API_URL, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    const oficial = data.find((d: any) => d.casa === 'oficial');
    const blue = data.find((d: any) => d.casa === 'blue');
    return {
      oficial: typeof oficial?.venta === 'number' ? oficial.venta : null,
      blue: typeof blue?.venta === 'number' ? blue.venta : null,
    };
  } catch (e) {
    // Timeout (AbortError), red caída, JSON inválido, etc. — se trata como fallo, nunca
    // como excepción no manejada. El panel muestra "sin actualización", no rompe.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
    }

    await ensureSchemaSynced(db);

    const quotes = await fetchReferenceQuotes();

    // Un fallo de red no debe borrar la última cotización buena conocida — "sin
    // actualización" significa "no pudimos traer una fresca", no "no tenemos ninguna".
    // Solo se pisan los valores cuando la consulta realmente trajo un número nuevo.
    await db.update(dollarSettings).set({
      ...(quotes ? { lastOficialVenta: quotes.oficial, lastBlueVenta: quotes.blue } : {}),
      lastFetchedAt: new Date(),
      lastFetchStatus: quotes ? 'ok' : 'error',
      updatedAt: new Date(),
    }).where(eq(dollarSettings.id, 'singleton'));

    const [current] = await db.select().from(dollarSettings).where(eq(dollarSettings.id, 'singleton')).limit(1);

    return NextResponse.json({ ok: true, dollarSettings: current ?? null });
  } catch (error: any) {
    console.error('Error al consultar cotización de dólar:', error);
    // Aunque falle todo (incluida la DB), devolvemos 200 con ok:false — el panel de
    // /catalogo no debe romperse por esto, solo mostrar "sin actualización".
    return NextResponse.json({ ok: false, error: 'No se pudo actualizar la cotización.' }, { status: 200 });
  }
}
