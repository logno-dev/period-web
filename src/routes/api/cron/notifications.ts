import { checkNotifications } from '../../../services/notificationScheduler';

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await checkNotifications();
    return new Response('Notifications checked successfully', { status: 200 });
  } catch (error) {
    console.error('Cron job failed:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}