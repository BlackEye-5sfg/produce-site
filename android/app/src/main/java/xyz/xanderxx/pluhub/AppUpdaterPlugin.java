package xyz.xanderxx.pluhub;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String FEED = "https://plus.xanderxx.xyz/updates/latest.json";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private JSONObject latest;
    private File folder() { File d = new File(getContext().getCacheDir(), "updates"); d.mkdirs(); return d; }
    private File apk(JSONObject release) throws Exception { return new File(folder(), "update-" + release.getLong("versionCode") + ".apk"); }
    private int flags() { return Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES; }
    private long code(PackageInfo p) { return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode; }
    private PackageInfo installed() throws Exception { return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), flags()); }
    private boolean allowed() { return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls(); }
    private boolean unmetered() {
        ConnectivityManager cm = (ConnectivityManager)getContext().getSystemService(android.content.Context.CONNECTIVITY_SERVICE);
        NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED);
    }
    private static String hex(byte[] bytes) { StringBuilder s = new StringBuilder(); for(byte b:bytes)s.append(String.format(Locale.ROOT,"%02x",b & 255)); return s.toString(); }
    private String digest(File file) throws Exception {
        MessageDigest hash = MessageDigest.getInstance("SHA-256"); try(InputStream in = new FileInputStream(file)){byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)hash.update(b,0,n);} return hex(hash.digest());
    }
    private Set<String> signers(PackageInfo p) throws Exception {
        Signature[] sigs;
        if(Build.VERSION.SDK_INT >= 28) { if(p.signingInfo==null)throw new IOException("Missing APK signer"); sigs=p.signingInfo.getApkContentsSigners(); }
        else sigs=p.signatures;
        if(sigs==null||sigs.length==0)throw new IOException("Missing APK signer");Set<String> result=new TreeSet<>();
        for(Signature sig:sigs)result.add(hex(MessageDigest.getInstance("SHA-256").digest(sig.toByteArray()))); return result;
    }
    private JSONObject validate(JSONObject r) throws Exception {
        if(!getContext().getPackageName().equals(r.optString("appId")) || !UpdatePolicy.validRelease(r.getLong("versionCode"),r.getLong("size"),r.getString("sha256"),r.getString("url"))) throw new IOException("Invalid release metadata");
        if(!r.getString("versionName").matches("[0-9]+\\.[0-9]+\\.[0-9]+"))throw new IOException("Invalid release version");
        return r;
    }
    private HttpURLConnection connection(String target) throws Exception {
        HttpURLConnection c=(HttpURLConnection)new URL(target).openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(10000);c.setReadTimeout(20000);
        c.setRequestProperty("User-Agent","PLUHubAndroidUpdater/2.2");c.setRequestProperty("Cache-Control","no-cache");
        if(c.getResponseCode()!=200){c.disconnect();throw new IOException("Update server unavailable");}return c;
    }
    private JSONObject fetchRelease() throws Exception {
        HttpURLConnection c=connection(FEED+"?check="+System.currentTimeMillis());
        try(InputStream in=c.getInputStream();ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
            byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(bytes.size()+n>65536)throw new IOException("Release metadata too large");bytes.write(b,0,n);}return validate(new JSONObject(bytes.toString(StandardCharsets.UTF_8.name())));
        }finally{c.disconnect();}
    }
    private void verify(File file, JSONObject release) throws Exception {
        if(!file.isFile() || file.length()!=release.getLong("size") || !digest(file).equals(release.getString("sha256")))throw new IOException("Download hash or size mismatch");
        PackageInfo archive=getContext().getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(),flags());PackageInfo own=installed();
        if(archive==null || !own.packageName.equals(archive.packageName) || !release.getString("versionName").equals(archive.versionName) || code(archive)!=release.getLong("versionCode") || !UpdatePolicy.newer(code(own),code(archive)) || !signers(own).equals(signers(archive)))throw new IOException("APK package, version or signer mismatch");
    }
    private JSONObject cached() {
        try{File metadata=new File(folder(),"ready.json");if(!metadata.isFile()||metadata.length()>65536)return null;
            byte[] b=new byte[(int)metadata.length()];try(DataInputStream in=new DataInputStream(new FileInputStream(metadata))){in.readFully(b);}JSONObject r=validate(new JSONObject(new String(b,StandardCharsets.UTF_8)));verify(apk(r),r);return r;
        }catch(Exception e){return null;}
    }
    private JSObject result(JSONObject release, boolean offline) throws Exception {
        PackageInfo own=installed();JSObject r=new JSObject();r.put("installedVersion",own.versionName);r.put("installedCode",code(own));r.put("canInstall",allowed());r.put("unmetered",unmetered());r.put("offline",offline);
        boolean available=release!=null && UpdatePolicy.newer(code(own),release.getLong("versionCode"));r.put("available",available);
        if(available){r.put("versionName",release.getString("versionName"));r.put("versionCode",release.getLong("versionCode"));r.put("size",release.getLong("size"));boolean ready=false;try{verify(apk(release),release);ready=true;}catch(Exception ignored){}r.put("ready",ready);}
        return r;
    }
    @PluginMethod public void info(PluginCall call) { worker.execute(()->{try{JSONObject r=cached();if(r!=null)latest=r;call.resolve(result(latest,false));}catch(Exception e){call.reject("Could not read installed app version.");}}); }
    @PluginMethod public void check(PluginCall call) { worker.execute(()->{
        try{latest=fetchRelease();call.resolve(result(latest,false));}
        catch(Exception e){JSONObject saved=cached();if(saved!=null){latest=saved;try{call.resolve(result(saved,true));return;}catch(Exception ignored){}}call.reject("Could not check for updates. The catalogue still works; try again when connected.");}
    }); }
    @PluginMethod public void download(PluginCall call) { worker.execute(()->{
        File part=null;try{
            boolean unmeteredOnly=Boolean.TRUE.equals(call.getBoolean("unmeteredOnly",false));if(unmeteredOnly&&!unmetered())throw new IOException("Unmetered connection required");
            JSONObject r=fetchRelease();if(!UpdatePolicy.newer(code(installed()),r.getLong("versionCode")))throw new IOException("No newer release");latest=r;
            File target=apk(r);try{verify(target,r);call.resolve(result(r,false));return;}catch(Exception ignored){}
            part=new File(folder(),"download.part.apk");HttpURLConnection c=connection(r.getString("url"));long total=0,start=System.currentTimeMillis();
            try(InputStream in=c.getInputStream();OutputStream out=new FileOutputStream(part)){
                byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1){total+=n;if(unmeteredOnly&&!unmetered())throw new IOException("Connection became metered");if(total>r.getLong("size") || total>UpdatePolicy.MAX_BYTES || System.currentTimeMillis()-start>120000)throw new IOException("Download limit exceeded");out.write(b,0,n);}
            }finally{c.disconnect();}
            verify(part,r);if(target.exists()&&!target.delete())throw new IOException("Could not replace cached update");if(!part.renameTo(target))throw new IOException("Could not cache update");
            File metadata=new File(folder(),"ready.tmp");try(OutputStream out=new FileOutputStream(metadata)){out.write(r.toString().getBytes(StandardCharsets.UTF_8));}
            File ready=new File(folder(),"ready.json");if(ready.exists())ready.delete();if(!metadata.renameTo(ready))throw new IOException("Could not store update metadata");
            File[] old=folder().listFiles();if(old!=null)for(File f:old)if(f.getName().matches("update-[0-9]+\\.apk")&&!f.equals(target))f.delete();
            call.resolve(result(r,false));
        }catch(Exception e){if(part!=null)part.delete();call.reject("Update download failed verification or connection checks. Nothing was installed.");}
    }); }
    @PluginMethod public void install(PluginCall call) { worker.execute(()->{
        try{JSONObject r=latest!=null?latest:cached();if(r==null)throw new IOException("No downloaded release");File file=apk(r);verify(file,r);
            if(!allowed()){call.reject("Allow PLU Hub to install app updates in Android settings, then tap Install again.");return;}
            Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".updates",file);
            getActivity().runOnUiThread(()->{try{Intent intent=new Intent(Intent.ACTION_VIEW);intent.setDataAndType(uri,"application/vnd.android.package-archive");intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);getActivity().startActivity(intent);JSObject out=new JSObject();out.put("installerOpened",true);call.resolve(out);}catch(Exception e){call.reject("Android installer could not be opened.");}});
        }catch(Exception e){call.reject("No verified newer APK is ready. Check/download again.");}
    }); }
    @PluginMethod public void settings(PluginCall call) {
        if(Build.VERSION.SDK_INT<26){call.resolve();return;}
        getActivity().runOnUiThread(()->{try{getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getContext().getPackageName())));call.resolve();}catch(Exception e){call.reject("Open Android Settings > Special app access > Install unknown apps for PLU Hub.");}});
    }
    @Override protected void handleOnDestroy() { worker.shutdownNow(); }
}
