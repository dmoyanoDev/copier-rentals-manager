import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { notificationHistory } from '@/infrastructure/db/schema/notificationHistory';
import { desc } from 'drizzle-orm';

// Always read live notification history from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'CDN-Cache-Control': 'no-store',
  'Netlify-CDN-Cache-Control': 'no-store',
};

export async function GET() {
  try {
    const logs = await db.select().from(notificationHistory).orderBy(desc(notificationHistory.createdAt));
    return NextResponse.json(logs, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error('Error fetching notification history:', error);
    return NextResponse.json({ error: 'Failed to fetch notification history' }, { status: 500 });
  }
}
