import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { sharedPdfs } from '@/infrastructure/db/schema/sharedPdfs';
import { eq } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return new NextResponse('ID de PDF inválido', { status: 400 });
    }

    // Consultar la base de datos Turso
    const records = await db
      .select()
      .from(sharedPdfs)
      .where(eq(sharedPdfs.id, id))
      .limit(1);

    if (records.length === 0) {
      return new NextResponse('Archivo PDF no encontrado.', { status: 404 });
    }

    const record = records[0];
    
    // Check expiration (30 days limit)
    const createdAt = new Date(record.createdAt);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (createdAt < thirtyDaysAgo) {
      return new NextResponse('El archivo PDF ha expirado.', { status: 404 });
    }

    const pdfBuffer = Buffer.from(record.pdfBase64, 'base64');

    // Devolver el archivo PDF con las cabeceras HTTP correctas
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${record.filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: any) {
    console.error('Error al servir PDF:', error);
    return new NextResponse('Error del servidor al cargar el PDF.', { status: 500 });
  }
}
