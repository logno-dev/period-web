import type { CyclePhase } from "../types/period";

async function checkNotifications() {
  console.log('Running daily notification check...');
  
  try {
    const { db } = await import('../db');
    const { users, periods } = await import('../db/schema');
    const { eq, or } = await import('drizzle-orm');
    const {
      calculateNextPeriodPrediction,
      getCyclePhaseForDate,
      formatDate,
      calculateAverageCycleLength
    } = await import('../utils/periodUtils');
    const { sendNotificationEmail, sendNotificationPush, PushSubscriptionRecord } = await import('./notifications');

    const parseEmails = (rawEmails: unknown): string[] => {
      if (!rawEmails || typeof rawEmails !== 'string') {
        return [];
      }

      try {
        const parsed = JSON.parse(rawEmails);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const sendPush = async (
      subscription: PushSubscriptionRecord | null,
        payload: {
          email: string;
          type: 'ovulation' | 'period' | 'phase_change';
          daysUntil?: number;
          phaseTransition?: {
           from: CyclePhase | null;
           to: CyclePhase;
          };
        }
      ) => {
      if (!subscription) return;

      await sendNotificationPush(subscription, payload);
    };

    // Get users with either email or push notifications enabled
    const allUsers = await db.select().from(users).where(
      or(
        eq(users.notificationsEnabled, true),
        eq(users.pushNotificationsEnabled, true)
      )
    );
    
    for (const user of allUsers) {
      // Get user's periods
      const userPeriods = await db.select()
        .from(periods)
        .where(eq(periods.userId, user.id));

      if (userPeriods.length < 2) continue; // Need at least 2 periods for predictions

      // Get current time in user's timezone
      const userTimezone = user.timezone || 'America/Los_Angeles';
      const now = new Date();
      const hourInUserTz = parseInt(now.toLocaleString('en-US', { 
        timeZone: userTimezone, 
        hour: 'numeric', 
        hour12: false 
      }));
      
      // Only send notifications at 9 AM in the user's timezone
      if (hourInUserTz !== 9) continue;

      // Get current date in user's timezone as YYYY-MM-DD string
      const formatter = new Intl.DateTimeFormat('en-CA', { 
        timeZone: userTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const todayStr = formatter.format(new Date());
      
      // Parse today's date and calculate yesterday and tomorrow
      const [year, month, day] = todayStr.split('-').map(Number);
      const todayDate = new Date(year, month - 1, day);
      
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const yesterdayStr = formatDate(yesterdayDate);
      
      const tomorrowDate = new Date(todayDate);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowStr = formatDate(tomorrowDate);

      const shouldSendEmail = Boolean(user.notificationsEnabled);
      const shouldSendPush = Boolean(user.pushNotificationsEnabled);

      let pushSubscription: PushSubscriptionRecord | null = null;
      if (shouldSendPush && user.pushSubscription) {
        try {
          const parsed = JSON.parse(user.pushSubscription);
          if (parsed?.endpoint && parsed?.keys?.p256dh && parsed?.keys?.auth) {
            pushSubscription = parsed as PushSubscriptionRecord;
          }
        } catch (error) {
          console.error('Error parsing push subscription for user', user.id, error);
        }
      }

      // Get all email addresses for this user
      const emailAddresses = shouldSendEmail ? [user.email, ...parseEmails(user.notificationEmails)] : [];

      const averageCycleLength = calculateAverageCycleLength(userPeriods);

      // Check for phase change between yesterday and today
      const yesterdayPhase = getCyclePhaseForDate(yesterdayStr, userPeriods, averageCycleLength);
      const todayPhase = getCyclePhaseForDate(todayStr, userPeriods, averageCycleLength);

      // If phase changed, send notification
      if (todayPhase && yesterdayPhase?.phase !== todayPhase.phase) {
        const payload = {
          email: user.email,
          type: 'phase_change',
          phaseTransition: {
            from: yesterdayPhase?.phase || null,
            to: todayPhase.phase
          }
        };

        for (const email of emailAddresses) {
          await sendNotificationEmail({ ...payload, email });
        }

        await sendPush(shouldSendPush ? pushSubscription : null, payload);
      }

      // For legacy support: Check for ovulation notification (tomorrow)
      const tomorrowPhase = getCyclePhaseForDate(tomorrowStr, userPeriods, averageCycleLength);
      
      // Only send if tomorrow is ovulation and today is NOT ovulation (i.e., entering ovulation tomorrow)
      if (tomorrowPhase?.phase === 'ovulation' && todayPhase?.phase !== 'ovulation') {
        const payload = {
          email: user.email,
          type: 'ovulation' as const,
          daysUntil: 1
        };

        for (const email of emailAddresses) {
          await sendNotificationEmail({ ...payload, email });
        }

        await sendPush(shouldSendPush ? pushSubscription : null, payload);
      }

      // Check for period prediction notification
      const prediction = calculateNextPeriodPrediction(userPeriods);
      if (prediction.predictedDate === tomorrowStr && prediction.confidence !== 'insufficient') {
        const payload = {
          email: user.email,
          type: 'period' as const,
          daysUntil: 1
        };

        for (const email of emailAddresses) {
          await sendNotificationEmail({ ...payload, email });
        }

        await sendPush(shouldSendPush ? pushSubscription : null, payload);
      }
    }
  } catch (error) {
    console.error('Error in notification check:', error);
  }
}

// Initialize scheduler only in production runtime
export async function initNotificationScheduler() {
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    try {
      const { Cron } = await import('croner');
      const scheduler = new Cron('0 9 * * *', checkNotifications);
      console.log('Notification scheduler started - will run daily at 9 AM');
      return scheduler;
    } catch (error) {
      console.error('Failed to initialize notification scheduler:', error);
    }
  }
}

// Export the check function for manual testing
export { checkNotifications };
