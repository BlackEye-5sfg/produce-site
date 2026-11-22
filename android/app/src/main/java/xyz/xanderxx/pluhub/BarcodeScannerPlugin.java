package xyz.xanderxx.pluhub;

import android.Manifest;
import android.content.pm.PackageManager;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import com.journeyapps.barcodescanner.ScanIntentResult;
import com.journeyapps.barcodescanner.ScanOptions;

@CapacitorPlugin(name="BarcodeScanner",permissions={@Permission(alias="camera",strings={Manifest.permission.CAMERA})})
public class BarcodeScannerPlugin extends Plugin {
    private boolean scanning=false;
    @PluginMethod public void scan(PluginCall call){
        if(scanning){call.reject("Scanner is already open.");return;}
        if(!getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)){call.reject("No camera is available. Enter or paste the code instead.");return;}
        scanning=true;
        if(getPermissionState("camera")!=PermissionState.GRANTED)requestPermissionForAlias("camera",call,"cameraPermission");else open(call);
    }
    @PermissionCallback private void cameraPermission(PluginCall call){
        if(getPermissionState("camera")==PermissionState.GRANTED)open(call);
        else{scanning=false;call.reject("Camera permission was not granted. You can still enter or paste a code.");}
    }
    private void open(PluginCall call){
        try{
            ScanOptions options=new ScanOptions().setDesiredBarcodeFormats("UPC_A","UPC_E","EAN_13","EAN_8","CODE_128","CODE_39","ITF")
                .addExtra("ASSUME_GS1", true)
                .setPrompt("Scan one barcode. Review the code and fill in the item before saving.")
                .setBeepEnabled(false).setBarcodeImageEnabled(false).setOrientationLocked(false).setTimeout(120000);
            startActivityForResult(call,options.createScanIntent(getContext()),"scanResult");
        }catch(Exception e){scanning=false;call.reject("Could not open the camera scanner. Enter or paste the code instead.");}
    }
    @ActivityCallback private void scanResult(PluginCall call,ActivityResult result){
        scanning=false;if(call==null)return;
        try{
            ScanIntentResult scan=ScanIntentResult.parseActivityResult(result.getResultCode(),result.getData());
            JSObject out=new JSObject();
            if(scan.getContents()==null){out.put("cancelled",true);call.resolve(out);return;}
            if(!ScanPolicy.valid(scan.getContents(),scan.getFormatName())){call.reject("Unsupported barcode payload. Use a standard retail barcode or plain Code128/Code39 up to80 characters.");return;}
            out.put("cancelled",false);out.put("value",scan.getContents());out.put("type",ScanPolicy.type(scan.getFormatName()));out.put("format",scan.getFormatName());call.resolve(out);
        }catch(Exception e){call.reject("Could not read the scan. Nothing was saved.");}
    }
}
