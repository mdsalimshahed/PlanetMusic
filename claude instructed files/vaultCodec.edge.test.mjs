import assert from 'assert'; import { packSong, unpackSong } from '../src/Application/services/vaultCodec.js';
const cases = [
 { trackId:1 }, { trackId:2, syncData:[] }, { trackId:3, syncData:null, autoSyncData:null },
 { trackId:4, syncData:[{text:'a',start:null,end:null}] },                        // missing default keys
 { trackId:5, syncData:[{text:'a',singer:'X',color:'#fff',isGradient:true,gradient:'g',isSplit:false,segments:[{text:'a',color:'#fff',isGradient:true,gradient:'g',artists:['X']}]}] },
 { trackId:6, syncData:[{text:'a',singer:'X',color:'#fff',isGradient:false,gradient:'',isSplit:false,segments:[{text:'a',color:'#fff',isGradient:false,gradient:'',artists:['X','Y']}]}] },
 { trackId:7, syncData:[{text:'a',pronunciation:'{"full":"x","chunks":[{"type":"weird","text":"t","trans":"r"}]}',isSplit:true,adlibs:[{text:'(b)',singer:'S',segments:[{text:'(b)',color:'#000',isGradient:false,gradient:'',artists:['S']}],pronunciation:'{bad json'}]}] },
 { trackId:8, syncData:[{text:'a',singer:'X',color:'#1',isGradient:false,gradient:'',isSplit:false}], autoSyncData:[{text:'a',singer:'X',color:'#1',isGradient:false,gradient:'',isSplit:false,extra:5}] },
 { trackId:9, syncData:[{text:'a'},{text:'b'}], autoSyncData:[{text:'a'}] },       // different lengths
 { trackId:10, syncData:[{text:'a',translation:undefined}] },
];
let bad=0; for (const c of cases){ try{ assert.deepStrictEqual(unpackSong(JSON.parse(JSON.stringify(packSong(c)))), JSON.parse(JSON.stringify(c))); }catch(e){ bad++; console.log('FAIL',c.trackId,String(e.message).slice(0,200)); } }
console.log('edge cases',cases.length,'failures',bad);
