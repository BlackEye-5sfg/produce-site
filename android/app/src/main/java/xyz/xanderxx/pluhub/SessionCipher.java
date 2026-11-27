package xyz.xanderxx.pluhub;
import java.security.GeneralSecurityException;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
/** Platform-independent authenticated encryption; Android key creation stays in the plugin. */
public final class SessionCipher {
    public static final class Sealed {
        public final byte[] iv,bytes;
        Sealed(byte[] iv,byte[] bytes){this.iv=iv;this.bytes=bytes;}
    }
    private SessionCipher() {}
    public static Sealed seal(SecretKey key,byte[] plaintext)throws GeneralSecurityException {
        if(plaintext==null||plaintext.length>1024)throw new GeneralSecurityException("Session size");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key);
        return new Sealed(cipher.getIV(),cipher.doFinal(plaintext));
    }
    public static byte[] open(SecretKey key,byte[] iv,byte[] bytes)throws GeneralSecurityException {
        if(iv==null||iv.length!=12||bytes==null||bytes.length<16||bytes.length>2048)throw new GeneralSecurityException("Session envelope");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,iv));return cipher.doFinal(bytes);
    }
}
