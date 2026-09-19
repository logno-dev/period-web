package dev.logno.period

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.os.Build
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeSmokeTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    @Test fun nativeSignInNeedsCredentialsWithoutServerOrBrowser() {
        compose.onNodeWithText("Sign in").assertIsDisplayed().assertIsNotEnabled()
        compose.onNodeWithText("Email").performTextInput("one@example.test")
        compose.onNodeWithText("Sign in").assertIsNotEnabled()
        compose.onNodeWithText("Password").performTextInput("test-password")
        compose.onNodeWithText("Sign in").assertIsEnabled()
        compose.onNodeWithText("Web app URL").assertDoesNotExist()
        compose.onNodeWithText("Connect in browser").assertDoesNotExist()
    }

    @Test fun nativeNotificationsUseChannelPrivacyAndTapIntent() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        if (Build.VERSION.SDK_INT >= 33) {
            instrumentation.uiAutomation.grantRuntimePermission(context.packageName, Manifest.permission.POST_NOTIFICATIONS)
        }
        val manager = context.getSystemService(NotificationManager::class.java)
        Reminders.channels(context)
        context.repository().settings(private = true)
        assertTrue(Reminders.post(context, 731, "Sensitive title", "Sensitive details"))
        Thread.sleep(500)
        val notification = manager.activeNotifications.single { it.id == 731 }.notification
        assertEquals(Reminders.CHANNEL, notification.channelId)
        assertEquals("Period Tracker", notification.extras.getString(Notification.EXTRA_TITLE))
        assertFalse(notification.extras.getString(Notification.EXTRA_TEXT)!!.contains("Sensitive"))
        assertNotNull(notification.contentIntent)
        context.repository().settings(private = false)
        assertTrue(Reminders.post(context, 732, "Test title", "Test details"))
        Thread.sleep(500)
        assertEquals("Test details", manager.activeNotifications.single { it.id == 732 }.notification.extras.getString(Notification.EXTRA_TEXT))
        Reminders.cancel(context)
        context.repository().settings(private = true)
    }
}
