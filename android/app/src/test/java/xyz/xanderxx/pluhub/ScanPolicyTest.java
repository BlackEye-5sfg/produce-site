package xyz.xanderxx.pluhub;
import org.junit.Test;
import static org.junit.Assert.*;
public class ScanPolicyTest {
 @Test public void retainsSupportedRetailPayloads(){assertEquals("upca",ScanPolicy.type("UPC_A"));assertTrue(ScanPolicy.valid("012345678905","UPC_A"));assertTrue(ScanPolicy.valid("0012345678905","EAN_13"));assertTrue(ScanPolicy.valid("04210007","UPC_E"));assertTrue(ScanPolicy.valid("ABC-000012345678901234","CODE_128"));assertTrue(ScanPolicy.valid("12345678901234","ITF"));}
 @Test public void rejectsUnknownFormatsControlCharsAndUnboundedInputs(){assertNull(ScanPolicy.type("QR_CODE"));assertFalse(ScanPolicy.valid("https://example.org","QR_CODE"));assertFalse(ScanPolicy.valid("abc\n123","CODE_128"));assertFalse(ScanPolicy.valid("a".repeat(81),"CODE_128"));assertFalse(ScanPolicy.valid("12345","UPC_A"));assertFalse(ScanPolicy.valid("1234567","ITF"));assertFalse(ScanPolicy.valid("lowercase","CODE_39"));assertFalse(ScanPolicy.valid(" 123","CODE_128"));assertFalse(ScanPolicy.valid("]C101012345678905","CODE_128"));}
}
