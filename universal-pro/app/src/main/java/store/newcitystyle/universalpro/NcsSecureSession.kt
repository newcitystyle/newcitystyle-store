package store.newcitystyle.universalpro

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Android Keystore AES-GCM. Nothing financial and no password is persisted.
 * Saved tokens are encrypted with a device-bound, non-exportable key.
 */
internal object NcsSecureSession {
    private const val alias="ncs_universal_owner_session_v1"
    private const val preferences="ncs_universal_owner_secure"
    private const val field="sealed_session"

    private fun key():SecretKey {
        val ks=KeyStore.getInstance("AndroidKeyStore").apply{load(null)}
        val saved=ks.getKey(alias,null)
        if(saved is SecretKey)return saved
        val generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build())
        return generator.generateKey()
    }
    fun save(context:Context,session:NcsCloud.Session) {
        if(session.refreshToken.isBlank())return
        val j=JSONObject()
            .put("access_token",session.accessToken)
            .put("refresh_token",session.refreshToken)
            .put("email",session.email)
            .put("expires_at",session.expiresAt)
        val cipher=Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE,key())
        val ciphertext=cipher.doFinal(j.toString().toByteArray(Charsets.UTF_8))
        val stored=Base64.encodeToString(cipher.iv+ciphertext,Base64.NO_WRAP)
        context.getSharedPreferences(preferences,Context.MODE_PRIVATE).edit().putString(field,stored).apply()
    }
    fun restore(context:Context):NcsCloud.Session? {
        return try {
            val stored=context.getSharedPreferences(preferences,Context.MODE_PRIVATE).getString(field,null)?:return null
            val bytes=Base64.decode(stored,Base64.NO_WRAP)
            require(bytes.size>13)
            val cipher=Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,bytes.copyOfRange(0,12)))
            val data=JSONObject(String(cipher.doFinal(bytes.copyOfRange(12,bytes.size)),Charsets.UTF_8))
            NcsCloud.Session(
                accessToken=data.getString("access_token"),
                email=data.getString("email"),
                refreshToken=data.getString("refresh_token"),
                expiresAt=data.optLong("expires_at")
            )
        }catch(_:Exception){clear(context);null}
    }
    fun clear(context:Context){
        context.getSharedPreferences(preferences,Context.MODE_PRIVATE).edit().remove(field).apply()
    }
}
