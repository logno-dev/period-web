import { Cron } from 'croner';
import { db } from '../db';
import { users, periods } from '../db/schema';
import { eq } from 'drizzle-orm';
import { calculateNextPeriodPrediction, getCyclePhaseForDate, formatDate } from '../utils/periodUtils';
import { sendNotificationEmail } from './notifications';

async function checkNotifications() {
  console.log('Running daily notification check...');
  
  try {
    // Get all users with notifications enabled
    const allUsers = await db.select().from(users).where(eq(users.notificationsEnabled, true));
    
    for (const user of allUsers) {
      // Get user's periods
      const userPeriods = await db.select()
        .from(periods)
        .where(eq(periods.userId, user.id));

      if (userPeriods.length < 2) continue; // Need at least 2 periods for predictions

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatDate(tomorrow);

      // Get all email addresses for this user
      const emailAddresses = [user.email];
      if (user.notificationEmails) {
        try {
          const additionalEmails = JSON.parse(user.notificationEmails);
          if (Array.isArray(additionalEmails)) {
            emailAddresses.push(...additionalEmails);
          }
        } catch (error) {
          console.error('Error parsing notification emails for user', user.id, error);
        }
      }

      // Check for ovulation notification
      const cyclePhase = getCyclePhaseForDate(tomorrowStr, userPeriods);
      if (cyclePhase?.phase === 'ovulation') {
        for (const email of emailAddresses) {
          await sendNotificationEmail({
            email,
            type: 'ovulation',
            daysUntil: 1
          });
        }
      }

      // Check for period prediction notification
      const prediction = calculateNextPeriodPrediction(userPeriods);
      if (prediction.predictedDate === tomorrowStr && prediction.confidence !== 'insufficient') {
        for (const email of emailAddresses) {
          await sendNotificationEmail({
            email,
            type: 'period',
            daysUntil: 1
          });
        }
      }
    }
  } catch (error) {
    console.error('Error in notification check:', error);
  }
}

// Run daily at 9 AM
export const notificationScheduler = new Cron('0 9 * * *', checkNotifications);

console.log('Notification scheduler started - will run daily at 9 AM');