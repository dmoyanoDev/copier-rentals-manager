import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { sharedPdfs } from '@/infrastructure/db/schema/sharedPdfs';
import { getSession } from '@/infrastructure/auth/session';

export async function POST(req: NextRequest) {
  try {
    // Sin este chequeo, cualquiera podia subir un PDF arbitrario y obtener un
    // link publico alojado bajo el dominio de la empresa por 30 dias (hosting
    // gratuito de archivos anonimo). El GET en pdf/[id] sigue siendo publico
    // a proposito — es el link que se comparte con el cliente.
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });
    }

    const { pdfBase64, filename } = await req.json();

    if (!pdfBase64 || !filename) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (pdfBase64 o filename).' }, { status: 400 });
    }

    // Generar un ID único (slug) para el PDF compartido usando UUID seguro
    const id = crypto.randomUUID();

    // Guardar en la base de datos Turso
    await db.insert(sharedPdfs).values({
      id,
      filename,
      pdfBase64,
      createdAt: new Date().toISOString(),
    });

    // Retornar la URL relativa pública para el cliente
    const url = `/api/pdf/${id}`;
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Error al compartir PDF en base de datos:', error);
    return NextResponse.json({ error: 'Error interno del servidor al procesar el PDF.' }, { status: 500 });
  }
}
