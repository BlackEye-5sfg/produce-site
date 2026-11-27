package xyz.xanderxx.pluhub;
/** Pure validation shared by the Keystore bridge and JVM boundary tests. */
public final class SessionPolicy {
    public static final long MAX_TTL=30L*24*60*60*1000;
    private SessionPolicy() {}
    public static boolean valid(String token,long expiresAt,long now) {
        return token!=null && token.matches("[A-Za-z0-9_-]{43}") && expiresAt>now && expiresAt<=now+MAX_TTL;
    }
}
