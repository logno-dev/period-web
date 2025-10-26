import { sendNotificationEmail } from '../../services/notifications';

export async function GET() {
  try {
    // Test ovulation notification
    await sendNotificationEmail({
      email: 'loganbunch@gmail.com', // Replace with your email
      type: 'ovulation',
      daysUntil: 1
    });

    // Test period notification
    await sendNotificationEmail({
      email: 'loganbunch@gmail.com', // Replace with your email
      type: 'period',
      daysUntil: 1
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Test notifications sent successfully'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Test notification failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
