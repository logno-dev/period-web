import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface NotificationData {
  email: string;
  type: 'ovulation' | 'period';
  daysUntil: number;
}

export async function sendNotificationEmail(data: NotificationData) {
  const subject = data.type === 'ovulation'
    ? '🌸 Ovulation window starting tomorrow'
    : '🩸 Period expected tomorrow';

  const message = data.type === 'ovulation'
    ? 'Your fertile window begins tomorrow. Your ovulation period is expected to start.'
    : 'Your next period is predicted to start tomorrow based on your cycle history.';

  try {
    await resend.emails.send({
      from: 'Period Tracker <notifications@mail.bunch.codes>',
      to: data.email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${subject}</h2>
          <p>${message}</p>
          <p style="color: #666; font-size: 14px;">
            This is an automated notification from your Period Tracker app.
          </p>
        </div>
      `
    });

    console.log(`Notification sent to ${data.email} for ${data.type}`);
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}
