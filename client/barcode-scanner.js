import {registerPlugin} from '@capacitor/core';
import {native} from './api';
import {validateCode} from '../shared/codes';
const Scanner=registerPlugin('BarcodeScanner');
export async function scanBarcode(){
 if(!native)throw Error('Camera scanning is available in the Android app. Enter, paste or use a keyboard/USB scanner here.');
 const result=await Scanner.scan();if(result.cancelled)return null;
 const code=validateCode(result.value,result.type);if(code.error)throw Error(code.error);
 return{value:code.value,type:code.type};
}
