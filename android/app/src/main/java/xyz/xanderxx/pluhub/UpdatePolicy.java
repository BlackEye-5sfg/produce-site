package xyz.xanderxx.pluhub;

import java.net.URI;

/** Shared, independently testable restrictions. No manifest can select another host/path. */
public final class UpdatePolicy {
    public static final long MAX_BYTES = 50L * 1024 * 1024;
    private UpdatePolicy() {}
    public static boolean validUrl(String value) {
        try {
            URI u = new URI(value);
            return "https".equals(u.getScheme()) && "plus.xanderxx.xyz".equals(u.getHost())
                && (u.getPort() == -1 || u.getPort() == 443) && u.getUserInfo() == null
                && u.getRawQuery() == null && u.getFragment() == null
                && u.getRawPath().matches("/downloads/plu-hub-[0-9]+\\.[0-9]+\\.[0-9]+\\.apk");
        } catch (Exception e) { return false; }
    }
    public static boolean validRelease(long code, long size, String hash, String url) {
        return code > 0 && code <= 2100000000L && size > 0 && size <= MAX_BYTES
            && hash != null && hash.matches("[a-f0-9]{64}") && validUrl(url);
    }
    public static boolean newer(long installed, long candidate) { return candidate > installed; }
}
