import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { sharedPdfs } from '@/infrastructure/db/schema/sharedPdfs';

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64, filename } = await req.json();

    if (!pdfBase64 || !filename) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (pdfBase64 o filename).' }, { status: 400 });
    }

    // Generar un ID único (slug) para el PDF compartido
    const id = 'pdf-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

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
