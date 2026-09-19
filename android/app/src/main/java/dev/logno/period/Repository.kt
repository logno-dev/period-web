package dev.logno.period

import android.content.Context
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.LocalDate
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private fun JSONObject.nullable(name: String): String? = if (isNull(name)) null else getString(name)
private fun parsePeriod(json: JSONObject) = Period(json.getString("id"), LocalDate.parse(json.getString("startDate")), json.nullable("endDate")?.let(LocalDate::parse))
private fun parseMood(json: JSONObject) = Mood(json.getString("id"), LocalDate.parse(json.getString("date")), json.getString("mood"))
private fun parseSnapshot(json: JSONObject) = Snapshot(
    json.getJSONArray("periods").let { array -> (0 until array.length()).map { index ->
        parsePeriod(array.getJSONObject(index))
    } },
    json.getJSONArray("markers").let { array -> (0 until array.length()).map { index ->
        parseMood(array.getJSONObject(index))
    } }, json.optLong("syncedAt")
)

/** Secrets are encrypted with a non-exportable Android Keystore key. */
private class TokenVault(context: Context) {
    private val prefs = context.getSharedPreferences("credentials", Context.MODE_PRIVATE)
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        return (store.getKey("period-session", null) as? SecretKey) ?: KeyGenerator.getInstance("AES", "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("period-session", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    fun read(): String? = prefs.getString("token", null)?.let { encoded ->
        runCatching {
            val bytes = Base64.decode(encoded, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
            String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
        }.getOrNull()
    }
    fun write(token: String?) {
        if (token == null) { prefs.edit().clear().commit(); return }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        check(prefs.edit().putString("token", Base64.encodeToString(cipher.iv + cipher.doFinal(token.toByteArray()), Base64.NO_WRAP)).commit())
    }
}

class AuthExpired : Exception("Your connection expired. Reconnect your account in Settings.")

class Repository(private val context: Context) {
    val prefs = context.getSharedPreferences("tracker", Context.MODE_PRIVATE)
    private val vault = TokenVault(context)
    private val mutex = Mutex()
    private val client = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).callTimeout(30, TimeUnit.SECONDS)
        .followRedirects(false).build()
    private val mutable = MutableStateFlow(runCatching { parseSnapshot(JSONObject(prefs.getString("cache", "")!!)) }.getOrDefault(Snapshot()))
    val snapshot = mutable.asStateFlow()
    val connected get() = vault.read() != null
    val server get() = prefs.getString("server", "https://p.logno.app")!!
    val email get() = prefs.getString("email", "")!!
    val enabled get() = prefs.getBoolean("reminders", false)
    val hour get() = prefs.getInt("hour", 9)
    val minute get() = prefs.getInt("minute", 0)
    val privateNotifications get() = prefs.getBoolean("private", true)

    fun beginLogin(input: String): Uri {
        val uri = Uri.parse(input.trim().trimEnd('/'))
        require(uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.userInfo == null &&
            (uri.path.isNullOrEmpty() || uri.path == "/") && uri.query == null && uri.fragment == null) { "Enter the HTTPS origin of your web app (for example https://tracker.example.com)." }
        val random = SecureRandom()
        fun nonce() = Base64.encodeToString(ByteArray(32).also(random::nextBytes), Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
        val verifier = nonce()
        val state = nonce()
        val challenge = Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()), Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
        prefs.edit().putString("pendingServer", uri.toString()).putString("verifier", verifier).putString("state", state).apply()
        return Uri.parse("$uri/api/mobile/authorize").buildUpon().appendQueryParameter("challenge", challenge).appendQueryParameter("state", state).build()
    }

    suspend fun completeLogin(uri: Uri) = withContext(Dispatchers.IO) { mutex.withLock {
        require(uri.scheme == "dev.logno.period" && uri.host == "authorize") { "Invalid callback." }
        val state = prefs.getString("state", null)
        require(state != null && uri.getQueryParameter("state") == state) { "Connection request expired. Try again." }
        val origin = prefs.getString("pendingServer", null) ?: error("No pending connection")
        val body = JSONObject().put("code", uri.getQueryParameter("code")).put("verifier", prefs.getString("verifier", null))
        val result = request(origin, "/api/mobile/token", "POST", body, null)
        // Never show one account's cached data under another account.
        Reminders.cancel(context)
        mutable.value = Snapshot()
        prefs.edit().remove("cache").remove("delivered").putString("server", origin).putString("email", result.getString("email"))
            .remove("state").remove("verifier").remove("pendingServer").commit()
        vault.write(result.getString("token"))
        refreshLocked()
    } }

    private fun request(origin: String, path: String, method: String = "GET", json: JSONObject? = null, token: String? = vault.read()): JSONObject {
        val body = json?.toString()?.toRequestBody("application/json".toMediaType())
        val builder = Request.Builder().url(origin + path).header("Accept", "application/json").method(method, body)
        if (token != null) builder.header("Authorization", "Bearer $token")
        client.newCall(builder.build()).execute().use { response ->
            if (response.code == 401 && token != null) throw AuthExpired()
            if (!response.isSuccessful) throw Exception("Server request failed (${response.code}). Check the web deployment and try again.")
            return JSONObject(response.body?.string() ?: error("Empty response"))
        }
    }

    private fun refreshLocked() {
        if (!connected) return
        val periods = request(server, "/api/periods").getJSONArray("periods")
        val markers = request(server, "/api/mood-markers").getJSONArray("markers")
        val json = JSONObject().put("periods", periods).put("markers", markers).put("syncedAt", System.currentTimeMillis())
        val parsed = parseSnapshot(json)
        check(prefs.edit().putString("cache", json.toString()).commit()) { "Could not save local history." }
        mutable.value = parsed
        Reminders.schedule(context)
    }

    suspend fun refresh() = withContext(Dispatchers.IO) { mutex.withLock { refreshLocked() } }

    private fun saveCache(snapshot: Snapshot) {
        val periods = JSONArray().apply { snapshot.periods.forEach {
            put(JSONObject().put("id", it.id).put("startDate", it.start.toString()).put("endDate", it.end?.toString() ?: JSONObject.NULL))
        } }
        val moods = JSONArray().apply { snapshot.moods.forEach {
            put(JSONObject().put("id", it.id).put("date", it.date.toString()).put("mood", it.mood))
        } }
        val json = JSONObject().put("periods", periods).put("markers", moods).put("syncedAt", snapshot.syncedAt)
        // The server already confirmed this edit; retain it locally even if a subsequent sync fails.
        prefs.edit().putString("cache", json.toString()).apply()
        mutable.value = snapshot
        Reminders.schedule(context)
    }

    suspend fun savePeriod(period: Period, new: Boolean) = withContext(Dispatchers.IO) { mutex.withLock {
        Cycle.validate(period, mutable.value.periods)
        val body = JSONObject().put("startDate", period.start.toString()).put("endDate", period.end?.toString() ?: JSONObject.NULL)
        if (!new) body.put("id", period.id)
        val saved = parsePeriod(request(server, "/api/periods", if (new) "POST" else "PUT", body).getJSONObject("period"))
        saveCache(mutable.value.copy(periods = mutable.value.periods.filter { it.id != saved.id } + saved))
    } }

    suspend fun deletePeriod(id: String) = withContext(Dispatchers.IO) { mutex.withLock {
        request(server, "/api/periods?id=${Uri.encode(id)}", "DELETE")
        saveCache(mutable.value.copy(periods = mutable.value.periods.filter { it.id != id }))
    } }
    suspend fun addMood(date: LocalDate, mood: String) = withContext(Dispatchers.IO) { mutex.withLock {
        val result = request(server, "/api/mood-markers", "POST", JSONObject().put("date", date.toString()).put("mood", mood))
        val saved = parseMood(result.getJSONObject("marker"))
        saveCache(mutable.value.copy(moods = mutable.value.moods.filter { it.id != saved.id } + saved))
    } }
    suspend fun deleteMood(id: String) = withContext(Dispatchers.IO) { mutex.withLock {
        request(server, "/api/mood-markers?id=${Uri.encode(id)}", "DELETE")
        saveCache(mutable.value.copy(moods = mutable.value.moods.filter { it.id != id }))
    } }

    suspend fun logout() = withContext(Dispatchers.IO) { mutex.withLock {
        Reminders.cancel(context)
        vault.write(null)
        prefs.edit().clear().commit()
        mutable.value = Snapshot()
    } }

    fun settings(enabled: Boolean = this.enabled, hour: Int = this.hour, minute: Int = this.minute, private: Boolean = privateNotifications) {
        prefs.edit().putBoolean("reminders", enabled).putInt("hour", hour).putInt("minute", minute).putBoolean("private", private).apply()
        Reminders.schedule(context)
    }
}
