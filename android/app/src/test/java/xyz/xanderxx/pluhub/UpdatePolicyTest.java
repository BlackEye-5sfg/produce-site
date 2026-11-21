package xyz.xanderxx.pluhub;
import org.junit.Test;
import static org.junit.Assert.*;
public class UpdatePolicyTest {
 @Test public void acceptsOnlyExpectedImmutableHttpsApks(){
  assertTrue(UpdatePolicy.validUrl("https://plus.xanderxx.xyz/downloads/plu-hub-2.2.0.apk"));
  for(String url:new String[]{"http://plus.xanderxx.xyz/downloads/plu-hub-2.2.0.apk","https://evil.example/downloads/plu-hub-2.2.0.apk","https://plus.xanderxx.xyz.evil.example/downloads/plu-hub-2.2.0.apk","https://user@plus.xanderxx.xyz/downloads/plu-hub-2.2.0.apk","https://plus.xanderxx.xyz/downloads/../secret.apk","https://plus.xanderxx.xyz/downloads/plu-hub-2.2.0.apk?x=1","https://plus.xanderxx.xyz:444/downloads/plu-hub-2.2.0.apk"})assertFalse(url,UpdatePolicy.validUrl(url));
 }
 @Test public void requiresBoundedSizeHashAndForwardVersion(){
  String hash=new String(new char[64]).replace('\0','a');String url="https://plus.xanderxx.xyz/downloads/plu-hub-2.2.0.apk";
  assertTrue(UpdatePolicy.validRelease(20200,3500000,hash,url));
  assertFalse(UpdatePolicy.validRelease(20200,0,hash,url));assertFalse(UpdatePolicy.validRelease(20200,UpdatePolicy.MAX_BYTES+1,hash,url));assertFalse(UpdatePolicy.validRelease(20200,123,"bad",url));assertFalse(UpdatePolicy.validRelease(-1,123,hash,url));
  assertFalse(UpdatePolicy.newer(20200,20200));assertFalse(UpdatePolicy.newer(20200,20101));assertTrue(UpdatePolicy.newer(20200,20300));
 }
}
