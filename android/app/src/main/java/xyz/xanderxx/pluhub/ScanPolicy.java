package xyz.xanderxx.pluhub;

/** Only reviewed one-dimensional formats. No URL navigation or payload rewriting. */
public final class ScanPolicy {
    private ScanPolicy() {}
    public static String type(String format) {
        if(format==null)return null;
        switch(format){
            case "UPC_A": return "upca";
            case "UPC_E": return "upce";
            case "EAN_13": return "ean13";
            case "EAN_8": return "ean8";
            case "CODE_128": return "code128";
            case "CODE_39": return "code39";
            case "ITF": return "itf";
            default: return null;
        }
    }
    public static boolean valid(String value,String format) {
        String type=type(format);
        if(type==null||value==null||value.length()<1||value.length()>80||!value.equals(value.trim())||!value.matches("[\\x20-\\x7e]+"))return false;
        if(type.equals("code128")&&value.startsWith("]C1"))return false; // GS1/FNC1 needs explicit structured support.
        switch(type){
            case "upca": return value.matches("[0-9]{12}");
            case "upce": case "ean8": return value.matches("[0-9]{8}");
            case "ean13": return value.matches("[0-9]{13}");
            case "itf": return value.matches("[0-9]{6,80}")&&value.length()%2==0;
            case "code39": return value.matches("[0-9A-Z\\-. $/+%]+");
            default: return true;
        }
    }
}
