import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/infrastructure/db/client';
import { notificationSettings } from '@/infrastructure/db/schema/notificationSettings';
import { getOrCreateNotificationSettings } from '@/infrastructure/notifications/notificationService';
import { eq } from 'drizzle-orm';

// Always read live config from database
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
    const settings = await getOrCreateNotificationSettings();
    return NextResponse.json(settings, { headers: NO_CACHE_HEADERS });

  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { whatsappEnabled, emailEnabled, eventsConfig, templatesConfig } = body;

    // Check if configuration exists
    const settingsQuery = await db.select().from(notificationSettings).where(eq(notificationSettings.id, 'settings-global')).limit(1);

    const values = {
      whatsappEnabled: whatsappEnabled ? 1 : 0,
      emailEnabled: emailEnabled ? 1 : 0,
      eventsConfig: JSON.stringify(eventsConfig),
      templatesConfig: JSON.stringify(templatesConfig),
      updatedAt: new Date()
    };

    if (settingsQuery.length > 0) {
      await db.update(notificationSettings).set(values).where(eq(notificationSettings.id, 'settings-global'));
    } else {
      await db.insert(notificationSettings).values({
        id: 'settings-global',
        ...values
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
