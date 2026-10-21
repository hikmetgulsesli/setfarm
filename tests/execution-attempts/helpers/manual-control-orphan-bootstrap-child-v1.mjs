import {TextDecoder,types} from 'node:util';

export const MANUAL_ORPHAN_BASENAME_V1='manual-control-orphan-bootstrap-v1.integration.test.ts';
export const MANUAL_ORPHAN_VECTOR_V1=Object.freeze([
  'node','--import','tsx','--test','--test-concurrency=1',
  'tests/execution-attempts/'+MANUAL_ORPHAN_BASENAME_V1,
]);

function validateCellsV1(cells){
  if(!Array.isArray(cells))throw Error('MANUAL_ORPHAN_FRAME_REFUSED');
  for(let index=0;index<cells.length;index++){
    if(!Object.hasOwn(cells,index)||typeof cells[index]!=='string'){
      throw Error('MANUAL_ORPHAN_FRAME_REFUSED');
    }
  }
}

export function mentionsManualOrphanFileV1(cells){
  validateCellsV1(cells);
  return cells.some(cell=>cell.toLowerCase().includes(MANUAL_ORPHAN_BASENAME_V1));
}

export function classifyManualOrphanVectorV1(cells){
  validateCellsV1(cells);
  const same=cells.length===MANUAL_ORPHAN_VECTOR_V1.length
    &&cells.every((cell,index)=>cell===MANUAL_ORPHAN_VECTOR_V1[index]);
  return same?'exact':mentionsManualOrphanFileV1(cells)?'near':'unrelated';
}

function probeFrameRefusalV1(){
  return Error('MANUAL_ORPHAN_FRAME_REFUSED');
}

// Inspect every own descriptor before reading values. Reject proxies before any
// reflective operation so validation cannot execute their property traps either.
function probeOwnDataV1(value,keys){
  if(value===null||typeof value!=='object'||types.isProxy(value)
    ||Object.getPrototypeOf(value)!==Object.prototype)throw probeFrameRefusalV1();
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(descriptors).length!==keys.length)throw probeFrameRefusalV1();
  for(const key of keys){
    if(!Object.hasOwn(descriptors,key)||!descriptors[key].enumerable
      ||!Object.hasOwn(descriptors[key],'value'))throw probeFrameRefusalV1();
  }
  return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
}

function probeHexV1(value){
  return typeof value==='string'&&value.length===64&&/^[0-9a-f]{64}$/.test(value);
}

function probeIntegerV1(value,minimum){
  return Number.isSafeInteger(value)&&value>=minimum&&value<=2147483647;
}

function probeTimestampV1(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(value))return false;
  const date=new Date(value);
  return Number.isFinite(date.getTime())&&date.toISOString()===value;
}

function probeExecutableV1(value){
  // POSIX normalization is syntactic here; no path is resolved or opened.
  return typeof value==='string'&&value.length>1&&value.startsWith('/')
    &&Buffer.byteLength(value,'utf8')<=4096&&!/[\u0000-\u001f\u007f-\u009f]/.test(value)
    &&Buffer.from(value,'utf8').toString('utf8')===value
    &&value.split('/').slice(1).every(part=>part!==''&&part!=='.'&&part!=='..');
}

function orderedProbeProcessV1(value){
  const data=probeOwnDataV1(value,[
    'pid','ppid','uid','pgid','startedAtUTC','executable','executableSha256','commandSha256',
  ]);
  if(!probeIntegerV1(data.pid,1)||!probeIntegerV1(data.ppid,1)
    ||!probeIntegerV1(data.uid,0)||!probeIntegerV1(data.pgid,1)
    ||!probeTimestampV1(data.startedAtUTC)||!probeExecutableV1(data.executable)
    ||!probeHexV1(data.executableSha256)||!probeHexV1(data.commandSha256))throw probeFrameRefusalV1();
  return {
    pid:data.pid,ppid:data.ppid,uid:data.uid,pgid:data.pgid,
    startedAtUTC:data.startedAtUTC,executable:data.executable,
    executableSha256:data.executableSha256,commandSha256:data.commandSha256,
  };
}

function orderedProbeFrameV1(value){
  const data=probeOwnDataV1(value,['schema','nonce','parent','child','source']);
  if(data.schema!=='setfarm.manual-orphan-lifecycle-probe.v1'||!probeHexV1(data.nonce))throw probeFrameRefusalV1();
  const parent=orderedProbeProcessV1(data.parent),child=orderedProbeProcessV1(data.child);
  const source=probeOwnDataV1(data.source,['helperSha256','issuerTestSha256']);
  if(!probeHexV1(source.helperSha256)||!probeHexV1(source.issuerTestSha256))throw probeFrameRefusalV1();
  return {
    schema:data.schema,nonce:data.nonce,parent,child,
    source:{helperSha256:source.helperSha256,issuerTestSha256:source.issuerTestSha256},
  };
}

export function encodeManualOrphanProbeFrameV1(frame){
  try{
    const bytes=Buffer.from(JSON.stringify(orderedProbeFrameV1(frame))+'\n','utf8');
    if(bytes.length>16384)throw probeFrameRefusalV1();
    return bytes;
  }catch{
    throw probeFrameRefusalV1();
  }
}

export function decodeManualOrphanProbeFrameV1(bytes){
  try{
    if(types.isProxy(bytes)||!Buffer.isBuffer(bytes))throw probeFrameRefusalV1();
    // Read the actual view size, independent of any own length/byteLength data.
    const size=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get.call(bytes);
    if(size<1||size>16384||bytes[size-1]!==0x0a)throw probeFrameRefusalV1();
    // Retain a BOM rather than stripping it; both parse and exact bytes remain
    // strict. Fatal decoding must precede JSON parsing to reject replacement UTF8.
    const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
    const frame=orderedProbeFrameV1(JSON.parse(text.slice(0,-1)));
    if(Buffer.compare(bytes,encodeManualOrphanProbeFrameV1(frame))!==0)throw probeFrameRefusalV1();
    Object.freeze(frame.parent);Object.freeze(frame.child);Object.freeze(frame.source);
    return Object.freeze(frame);
  }catch{
    throw probeFrameRefusalV1();
  }
}
