import { Resend } from 'resend';
import { CyclePhase } from '../types/period';

import webPush from 'web-push';

const resend = new Resend(process.env.RESEND_API_KEY);

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:notifications@example.com';

try {
  if (vapidPublicKey && vapidPrivateKey) {
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  }
} catch (error) {
  console.error('Failed to initialize web push VAPID settings:', error);
}

export type NotificationType = 
  | 'ovulation' 
  | 'period' 
  | 'phase_change';

export interface NotificationData {
  email: string;
  type: NotificationType;
  daysUntil?: number;
  phaseTransition?: {
    from: CyclePhase | null;
    to: CyclePhase;
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  data: {
    type: NotificationType;
    daysUntil?: number;
    phaseTransition?: {
      from: CyclePhase | null;
      to: CyclePhase;
    };
  };
}

export interface PushSubscriptionRecord {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

function getPhaseChangeEmailContent(from: CyclePhase | null, to: CyclePhase): { subject: string; message: string; emoji: string } {
  const transitions: Record<string, { subject: string; message: string; emoji: string }> = {
    'null->menstrual': {
      emoji: '🩸',
      subject: 'Your period should be starting today',
      message: 'Based on your cycle, your menstrual phase should be beginning today. Remember to track your flow and take care of yourself.'
    },
    'menstrual->follicular': {
      emoji: '🌸',
      subject: 'Follicular phase may be starting',
      message: 'Your menstrual phase should be ending and you may be entering the follicular phase. Energy levels typically rise during this time.'
    },
    'follicular->ovulation': {
      emoji: '✨',
      subject: 'Ovulation window may be starting',
      message: 'Based on your cycle, you may be entering your ovulation window. This is typically your most fertile time.'
    },
    'ovulation->luteal': {
      emoji: '🌙',
      subject: 'Luteal phase may be starting',
      message: 'Your ovulation window should be ending and you may be entering the luteal phase. You might experience PMS symptoms as your next period approaches.'
    },
    'luteal->menstrual': {
      emoji: '🩸',
      subject: 'Your period may be starting soon',
      message: 'Based on your cycle, your period should be starting today. Your luteal phase is ending and a new cycle may be beginning.'
    }
  };

  const key = `${from || 'null'}->${to}`;
  return transitions[key] || {
    emoji: '🔄',
    subject: `Cycle phase may be changing`,
    message: `Based on your cycle history, you may be entering the ${to} phase of your cycle.`
  };
}

function getNotificationContent(data: NotificationData) {
  let subject: string;
  let message: string;
  let emoji: string;

  if (data.type === 'phase_change' && data.phaseTransition) {
    const content = getPhaseChangeEmailContent(data.phaseTransition.from, data.phaseTransition.to);
    emoji = content.emoji;
    subject = content.subject;
    message = content.message;
  } else if (data.type === 'ovulation') {
    emoji = '🌸';
    subject = 'Ovulation window may start tomorrow';
    message = 'Based on your cycle, your fertile window should begin tomorrow. Your ovulation period is expected to start.';
  } else {
    emoji = '🩸';
    subject = 'Period may start tomorrow';
    message = 'Based on your cycle history, your next period should start tomorrow. This is a prediction and may vary.';
  }

  return { subject, message, emoji, title: `${emoji} ${subject}`, body: message };
}

export async function sendNotificationEmail(data: NotificationData) {
  const { title, subject, message, emoji } = getNotificationContent(data);

  try {
    await resend.emails.send({
      from: 'Period Tracker <notifications@mail.bunch.codes>',
      to: data.email,
      subject: title,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${title}</h2>
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

export async function sendNotificationPush(
  subscription: PushSubscriptionRecord,
  data: NotificationData
): Promise<boolean> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('Push notifications are not configured');
    return false;
  }

  const { title, body } = getNotificationContent(data);

  const payload: PushNotificationPayload = {
    title,
    body,
    data: {
      type: data.type,
      daysUntil: data.daysUntil,
      phaseTransition: data.phaseTransition
    }
  };

  try {
    await webPush.sendNotification(
      subscription,
      JSON.stringify(payload),
      {
        TTL: 86400,
        vapidDetails: {
          subject: vapidSubject,
          publicKey: vapidPublicKey,
          privateKey: vapidPrivateKey
        }
      }
    );
    console.log('Push notification sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
}
