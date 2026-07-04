import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64, filename } = await req.json();

    if (!pdfBase64 || !filename) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (pdfBase64 o filename).' }, { status: 400 });
    }

    // Carpeta de destino local pública
    const targetDir = path.join(process.cwd(), 'public', 'temp-pdf');

    // Crear carpeta si no existe
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Guardar archivo binario
    const filePath = path.join(targetDir, filename);
    const buffer = Buffer.from(pdfBase64, 'base64');
    fs.writeFileSync(filePath, buffer);

    // Retornar la URL relativa pública para el cliente
    const url = `/temp-pdf/${filename}`;
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Error al compartir PDF:', error);
    return NextResponse.json({ error: 'Error interno del servidor al procesar el PDF.' }, { status: 500 });
  }
}
