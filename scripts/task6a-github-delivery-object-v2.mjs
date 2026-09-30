import {createHash} from 'node:crypto';

// Pure object protocol only. Expected identities and GitHub verdicts supplied
// here are untrusted data, not delivery, signature trust or runtime authority.
const SHA=/^[a-f0-9]{40}$/;
const MAX_BLOB=2*1024*1024;
function refuse() {throw Error('TASK6A_GITHUB_OBJECT_PROTOCOL_REFUSED');}
function plain(value) {
  if(!value||Object.getPrototypeOf(value)!==Object.prototype) refuse();
  const keys=Reflect.ownKeys(value);
  if(keys.length>64) refuse();
  for(const key of keys) {
    const d=Object.getOwnPropertyDescriptor(value,key);
    if(typeof key!=='string'||!d||!('value' in d)||!d.enumerable) refuse();
  }
  return value;
}
function field(record,key) {
  const d=Object.getOwnPropertyDescriptor(record,key);
  if(!d||!('value' in d)||!d.enumerable) refuse();
  return d.value;
}
function dataArray(value,max) {
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype
    ||value.length>max||Reflect.ownKeys(value).length!==value.length+1) refuse();
  for(let i=0;i<value.length;i++) field(value,String(i));
  return value;
}
function text(value,max) {
  if(typeof value!=='string'||value.length>max||/[\r\0]/.test(value)) refuse();
  const bytes=Buffer.from(value,'utf8');
  if(bytes.length>max||bytes.toString('utf8')!==value) refuse();
  return value;
}
function oid(value) {if(typeof value!=='string'||!SHA.test(value)) refuse();return value;}
function size(value) {if(!Number.isSafeInteger(value)||value<0||value>MAX_BLOB) refuse();return value;}
function identity(record,expected) {
  plain(record);oid(expected);
  if(oid(field(record,'sha'))!==expected) refuse();
}
function framed(kind,bytes) {
  return createHash('sha1').update(Buffer.from(`${kind} ${bytes.length}\0`)).update(bytes).digest('hex');
}
function characterization(objectKind,sha,details) {
  return Object.freeze({schema:'setfarm.task6a-github-object-protocol.v2',
    scope:'object-protocol-only',productionAuthority:false,objectKind,sha,...details});
}
function pgpArmor(signature) {
  const lines=signature.split('\n');
  if(lines.at(-1)==='') lines.pop();
  if(lines.shift()!=='-----BEGIN PGP SIGNATURE-----'
    ||lines.pop()!=='-----END PGP SIGNATURE-----') refuse();
  const headers=new Set();
  while(lines.length&&/^(?:Version|Comment): [\x20-\x7e]+$/.test(lines[0])) {
    const line=lines.shift(),name=line.slice(0,line.indexOf(':'));
    if(headers.has(name)) refuse();headers.add(name);
  }
  if(lines.shift()!=='') refuse();
  if(lines.at(-1)?.startsWith('=')) {
    if(!/^=[A-Za-z0-9+/]{4}$/.test(lines.pop())) refuse();
  }
  if(!lines.length||lines.some(line=>line.length>76||!/^[A-Za-z0-9+/]+={0,2}$/.test(line))) refuse();
  const encoded=lines.join('');
  if(encoded.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
    ||Buffer.from(encoded,'base64').toString('base64')!==encoded) refuse();
  // Syntax only: neither CRC nor the supplied verification verdict is
  // independent local cryptographic signature verification or provenance.
}

export function verifyTask6aGithubSignedMergeObjectV2(record,expectedSha) {
  if(arguments.length!==2) refuse();
  identity(record,expectedSha);
  const verification=plain(field(record,'verification'));
  if(field(verification,'verified')!==true||field(verification,'reason')!=='valid') refuse();
  const payload=text(field(verification,'payload'),65536);
  const signature=text(field(verification,'signature'),16384);
  pgpArmor(signature);
  const split=payload.indexOf('\n\n');
  if(split<0) refuse();
  const headers=payload.slice(0,split).split('\n');
  if(headers.length!==5||!/^tree [a-f0-9]{40}$/.test(headers[0])
    ||!/^parent [a-f0-9]{40}$/.test(headers[1])||!/^parent [a-f0-9]{40}$/.test(headers[2])) refuse();
  for(const [index,kind] of [[3,'author'],[4,'committer']]) {
    if(!new RegExp(`^${kind} [^<>\\n]+ <[^<>\\n]+> (?:0|[1-9][0-9]{0,11}) [+-](?:0[0-9]|1[0-4])[0-5][0-9]$`).test(headers[index])) refuse();
  }
  const treeSha=oid(field(plain(field(record,'tree')),'sha'));
  const parents=dataArray(field(record,'parents'),2);
  if(parents.length!==2) refuse();
  const parentShas=parents.map(parent=>oid(field(plain(parent),'sha')));
  if(parentShas[0]===parentShas[1]||headers[0]!==`tree ${treeSha}`
    ||headers[1]!==`parent ${parentShas[0]}`||headers[2]!==`parent ${parentShas[1]}`) refuse();
  // Preserve signature trailing newline: even the empty continuation gets SP.
  const raw=Buffer.from(payload.slice(0,split)+'\ngpgsig '+signature.split('\n').join('\n ')+payload.slice(split));
  if(framed('commit',raw)!==expectedSha) refuse();
  return characterization('commit',expectedSha,{treeSha,parentShas:Object.freeze(parentShas)});
}

export function verifyTask6aGithubTreeObjectV2(record,expectedSha) {
  if(arguments.length!==2) refuse();
  identity(record,expectedSha);
  if(field(record,'truncated')!==false) refuse();
  const entries=dataArray(field(record,'tree'),4096),names=new Set();
  const parts=entries.map(input=>{
    const entry=plain(input),name=text(field(entry,'path'),255);
    if(!/^[A-Za-z0-9._@+-]+$/.test(name)||name==='.'||name==='..'
      ||names.has(name.toLowerCase())) refuse();
    names.add(name.toLowerCase());
    const mode=field(entry,'mode'),kind=field(entry,'type'),sha=oid(field(entry,'sha'));
    if(mode==='040000'&&kind==='tree') {
      if(Object.hasOwn(entry,'size')) refuse();
    } else if((mode==='100644'||mode==='100755')&&kind==='blob') size(field(entry,'size'));
    else refuse();
    const directory=mode==='040000';
    return {sort:Buffer.from(name+(directory?'/':'')),
      bytes:Buffer.concat([Buffer.from(`${directory?'40000':mode} ${name}\0`),Buffer.from(sha,'hex')])};
  });
  parts.sort((a,b)=>Buffer.compare(a.sort,b.sort));
  if(framed('tree',Buffer.concat(parts.map(part=>part.bytes)))!==expectedSha) refuse();
  return characterization('tree',expectedSha,{entryCount:entries.length});
}

export function verifyTask6aGithubBlobObjectV2(record,expectedSha) {
  if(arguments.length!==2) refuse();
  identity(record,expectedSha);
  const byteLength=size(field(record,'size'));
  if(field(record,'encoding')!=='base64') refuse();
  const content=text(field(record,'content'),4*1024*1024);
  if(!/^[A-Za-z0-9+/=\n]*$/.test(content)) refuse();
  const encoded=content.replaceAll('\n','');
  if(encoded.length!==4*Math.ceil(byteLength/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) refuse();
  const bytes=Buffer.from(encoded,'base64');
  if(bytes.length!==byteLength||bytes.toString('base64')!==encoded||framed('blob',bytes)!==expectedSha) refuse();
  return characterization('blob',expectedSha,{byteLength,
    contentSha256:createHash('sha256').update(bytes).digest('hex')});
}
