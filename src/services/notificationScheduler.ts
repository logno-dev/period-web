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