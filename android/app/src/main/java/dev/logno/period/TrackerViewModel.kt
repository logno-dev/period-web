package dev.logno.period

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class UiStatus(val busy: Boolean = false, val message: String? = null, val connected: Boolean = false, val revision: Int = 0, val signingIn: Boolean = false)

class TrackerViewModel(application: Application) : AndroidViewModel(application) {
    val repo = application.repository()
    val snapshot = repo.snapshot
    private val mutableStatus = MutableStateFlow(UiStatus(connected = repo.connected))
    val status = mutableStatus.asStateFlow()
    init { refresh() }
    fun message(text: String?) { mutableStatus.value = mutableStatus.value.copy(message = text) }
    fun run(success: String? = null, block: suspend () -> Unit) {
        if (mutableStatus.value.busy) return
        viewModelScope.launch {
            mutableStatus.value = mutableStatus.value.copy(busy = true, message = null)
            try { block(); message(success) }
            catch (e: CancellationException) { throw e }
            catch (e: Exception) { message(e.message ?: "Something went wrong. Please try again.") }
            finally { mutableStatus.value = mutableStatus.value.copy(busy = false, connected = repo.connected, revision = mutableStatus.value.revision + 1) }
        }
    }
    fun refresh() = run { repo.refresh() }
    fun showSignIn(show: Boolean) { mutableStatus.value = mutableStatus.value.copy(signingIn = show) }
    fun signIn(email: String, password: String, clearPassword: () -> Unit) = run("Signed in and history synced.") {
        repo.signIn(email, password)
        clearPassword()
        showSignIn(false)
        repo.refresh()
    }
    fun logout() = run("Disconnected from this device.") { repo.logout() }
    fun save(period: Period, new: Boolean, done: () -> Unit) = run("Period saved.") { repo.savePeriod(period, new); done() }
    fun delete(period: Period) = run("Period deleted.") { repo.deletePeriod(period.id) }
}
