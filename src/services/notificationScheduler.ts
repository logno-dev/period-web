async function checkNotifications() {
  console.log('Running daily notification check...');
  
  try {
    const { db } = await import('../db');
    const { users, periods } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    const { calculateNextPeriodPrediction, getCyclePhaseForDate, formatDate, calculateAverageCycleLength } = await import('../utils/periodUtils');
    const { sendNotificationEmail } = await import('./notifications');

    // Get all users with notifications enabled
    const allUsers = await db.select().from(users).where(eq(users.notificationsEnabled, true));
    
    for (const user of allUsers) {
      // Get user's periods
      const userPeriods = await db.select()
        .from(periods)
        .where(eq(periods.userId, user.id));

      if (userPeriods.length < 2) continue; // Need at least 2 periods for predictions

      // Use local timezone dates to match what user sees in their calendar
      // The formatDate function creates dates at midnight in the local timezone
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = formatDate(today);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDate(yesterday);

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

      const averageCycleLength = calculateAverageCycleLength(userPeriods);

      // Check for phase change between yesterday and today
      const yesterdayPhase = getCyclePhaseForDate(yesterdayStr, userPeriods, averageCycleLength);
      const todayPhase = getCyclePhaseForDate(todayStr, userPeriods, averageCycleLength);

      // If phase changed, send notification
      if (todayPhase && yesterdayPhase?.phase !== todayPhase.phase) {
        for (const email of emailAddresses) {
          await sendNotificationEmail({
            email,
            type: 'phase_change',
            phaseTransition: {
              from: yesterdayPhase?.phase || null,
              to: todayPhase.phase
            }
          });
        }
      }

      // For legacy support: Check for ovulation notification (tomorrow)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatDate(tomorrow);
      const tomorrowPhase = getCyclePhaseForDate(tomorrowStr, userPeriods, averageCycleLength);
      
      // Only send if tomorrow is ovulation and today is NOT ovulation (i.e., entering ovulation tomorrow)
      if (tomorrowPhase?.phase === 'ovulation' && todayPhase?.phase !== 'ovulation') {
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