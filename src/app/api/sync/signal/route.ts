import { NextResponse } from 'next/server';
import { getSession } from '@/infrastructure/auth/session';

// In-memory timestamp storing the last DB write execution time.
// Note: In serverless environments (Netlify Edge / Lambdas), instance memory is ephemeral,
// but updates to this global variable provide immediate sub-second change signals
// to polling clients connected to the same active serverless worker instance.
let globalLastChangeTimestamp = Date.now();

export async function GET(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    return NextResponse.json({
      timestamp: globalLastChangeTimestamp,
      serverTime: Date.now()
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    globalLastChangeTimestamp = Date.now();
    return NextResponse.json({ success: true, timestamp: globalLastChangeTimestamp });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export function notifyDatabaseChange() {
  globalLastChangeTimestamp = Date.now();
}
