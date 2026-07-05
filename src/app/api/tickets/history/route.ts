import { NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { notificationHistory } from '@/infrastructure/db/schema/notificationHistory';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const logs = await db.select().from(notificationHistory).orderBy(desc(notificationHistory.createdAt));
    return NextResponse.json(logs);
  } catch (error: any) {
    console.error('Error fetching notification history:', error);
    return NextResponse.json({ error: 'Failed to fetch notification history' }, { status: 500 });
  }
}
