package xyz.xanderxx.pluhub;
import org.junit.Test;
import static org.junit.Assert.*;
public class SessionPolicyTest {
    @Test public void sessionBoundaryIsAbsoluteAndBounded() {
        long now=1700000000000L;String token="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        assertTrue(SessionPolicy.valid(token,now+SessionPolicy.MAX_TTL,now));
        assertFalse(SessionPolicy.valid(token,now+SessionPolicy.MAX_TTL+1,now));
        assertFalse(SessionPolicy.valid(token,now,now));
        assertFalse(SessionPolicy.valid("short",now+1000,now));
        assertFalse(SessionPolicy.valid(null,now+1000,now));
        assertFalse(SessionPolicy.valid(token,now+1,now+2));
    }
}
