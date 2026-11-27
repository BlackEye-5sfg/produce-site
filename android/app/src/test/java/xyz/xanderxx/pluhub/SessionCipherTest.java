package xyz.xanderxx.pluhub;
import org.junit.Test;
import static org.junit.Assert.*;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
public class SessionCipherTest {
    private SecretKey key()throws Exception{KeyGenerator g=KeyGenerator.getInstance("AES");g.init(256);return g.generateKey();}
    @Test public void ciphertextRoundTripUsesFreshNonceAndDoesNotContainPlaintext()throws Exception{
        SecretKey key=key();byte[] data="synthetic-session-only".getBytes(StandardCharsets.UTF_8);
        SessionCipher.Sealed a=SessionCipher.seal(key,data),b=SessionCipher.seal(key,data);
        assertEquals(12,a.iv.length);assertFalse(Arrays.equals(a.iv,b.iv));assertFalse(Arrays.equals(data,a.bytes));assertArrayEquals(data,SessionCipher.open(key,a.iv,a.bytes));
    }
    @Test public void modifiedCiphertextWrongKeyAndBadBoundsFailClosed()throws Exception{
        SecretKey key=key();SessionCipher.Sealed value=SessionCipher.seal(key,new byte[]{1,2,3});byte[] tampered=value.bytes.clone();tampered[0]^=1;
        try{SessionCipher.open(key,value.iv,tampered);fail();}catch(java.security.GeneralSecurityException expected){}
        try{SessionCipher.open(key(),value.iv,value.bytes);fail();}catch(java.security.GeneralSecurityException expected){}
        try{SessionCipher.open(key,new byte[4],value.bytes);fail();}catch(java.security.GeneralSecurityException expected){}
        try{SessionCipher.seal(key,new byte[1025]);fail();}catch(java.security.GeneralSecurityException expected){}
    }
}
