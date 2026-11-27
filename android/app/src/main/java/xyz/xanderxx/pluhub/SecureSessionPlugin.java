package xyz.xanderxx.pluhub;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

/** Only an opaque session is persisted, never a password or private list. */
@CapacitorPlugin(name="SecureSession")
public class SecureSessionPlugin extends Plugin {
    private static final String PREFS="plu_secure_session", ALIAS="plu-session-aes-v1";
    private static long generation=0;
    private static final Object LOCK=new Object();
    private SharedPreferences prefs(){return getContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
    private SecretKey key(boolean create)throws Exception{
        KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
        if(ks.containsAlias(ALIAS))return (SecretKey)ks.getKey(ALIAS,null);
        if(!create)throw new IllegalStateException("Missing session key");
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }
    private void erase()throws Exception{
        generation++;
        // Destroy the decrypting key even if a later preferences write fails.
        KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);if(ks.containsAlias(ALIAS))ks.deleteEntry(ALIAS);
        if(!prefs().edit().clear().commit())throw new IllegalStateException("Session erase failed");
    }
    @PluginMethod public void load(PluginCall call){synchronized(LOCK){
        try{
            String sealed=prefs().getString("sealed",null),iv=prefs().getString("iv",null);
            JSObject result=new JSObject();result.put("generation",generation);
            if(sealed==null&&iv==null){call.resolve(result);return;}
            if(sealed==null||iv==null||sealed.length()>2048||iv.length()>64)throw new IllegalStateException("Invalid stored session");
            byte[] nonce=Base64.decode(iv,Base64.NO_WRAP);if(nonce.length!=12)throw new IllegalStateException("Invalid nonce");
            JSONObject data=new JSONObject(new String(SessionCipher.open(key(false),nonce,Base64.decode(sealed,Base64.NO_WRAP)),StandardCharsets.UTF_8));
            String token=data.getString("token");long expires=data.getLong("expiresAt"),now=System.currentTimeMillis();
            if(!SessionPolicy.valid(token,expires,now))throw new IllegalStateException("Expired or invalid session");
            result.put("token",token);result.put("expiresAt",expires);call.resolve(result);
        }catch(Exception error){try{erase();JSObject result=new JSObject();result.put("generation",generation);call.resolve(result);}catch(Exception ignored){call.reject("Secure session storage unavailable");}}
    }}
    @PluginMethod public void save(PluginCall call){synchronized(LOCK){
        try{
            Long expected=call.getLong("generation"),expires=call.getLong("expiresAt");String token=call.getString("token");long now=System.currentTimeMillis();
            if(expected==null||expected!=generation||expires==null||!SessionPolicy.valid(token,expires,now))throw new IllegalArgumentException("Invalid or cancelled session");
            JSONObject data=new JSONObject();data.put("token",token);data.put("expiresAt",expires);
            SessionCipher.Sealed envelope=SessionCipher.seal(key(true),data.toString().getBytes(StandardCharsets.UTF_8));
            String sealed=Base64.encodeToString(envelope.bytes,Base64.NO_WRAP);
            if(!prefs().edit().putString("iv",Base64.encodeToString(envelope.iv,Base64.NO_WRAP)).putString("sealed",sealed).commit())throw new IllegalStateException("Write failed");
            call.resolve();
        }catch(Exception error){call.reject("Secure session could not be saved");}
    }}
    @PluginMethod public void clear(PluginCall call){synchronized(LOCK){
        try{erase();JSObject result=new JSObject();result.put("generation",generation);call.resolve(result);}catch(Exception error){call.reject("Secure session could not be erased");}
    }}
}
