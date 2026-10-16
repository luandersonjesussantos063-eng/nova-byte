import tls from 'node:tls';
import {X509Certificate,createHash,timingSafeEqual} from 'node:crypto';

const failure=code=>Object.assign(Error('Provider certificate verification failed'),{code});
const digest=raw=>createHash('sha256').update(raw).digest();

// Explicit local opt-in after comparing the SHA-256 on an independent device.
// The approved fingerprint is the identity for this one origin (including when
// its self-signed certificate has a generic CN). No global CA store is changed.
export class ProviderTlsTrust {
 constructor({origin,fingerprint}){
  const u=new URL(origin),hex=String(fingerprint||'').replace(/:/g,'');
  if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!u.hostname.includes('.')||!/^[a-f0-9]{64}$/i.test(hex))throw failure('NPLAY_TLS_CONFIG');
  this.origin=u.origin;this.host=u.hostname;this.port=Number(u.port)||443;
  this.fingerprint=Buffer.from(hex,'hex');this.certificate=null;this.pending=null;
 }
 matches(u){return u.origin===this.origin;}
 normalize(raw){
  const u=new URL(raw);
  if(u.protocol==='http:'&&u.hostname===this.host&&!u.port&&this.port===443){u.protocol='https:';}
  return u;
 }
 verify(raw){
  if(!raw||!timingSafeEqual(digest(raw),this.fingerprint))throw failure('NPLAY_TLS_PIN_MISMATCH');
  const cert=new X509Certificate(raw),now=Date.now();
  if(now<Date.parse(cert.validFrom)||now>Date.parse(cert.validTo))throw failure('NPLAY_TLS_PIN_EXPIRED');
 }
 async options(u,address,signal){
  if(!this.matches(u))return {};
  if(signal?.aborted)throw signal.reason;
  if(!this.certificate){
   // Bootstrap reads ONLY the public certificate: no HTTP request, cookies,
   // provider login or video bytes are sent on this untrusted TLS connection.
   // The actual authenticated request below still requires TLS authorization.
   if(!this.pending){
    this.pending=this.readCertificate(address).finally(()=>{this.pending=null;});
   }
   if(!signal)await this.pending;
   else await new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
    this.pending.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
   });
  }
  const checkServerIdentity=(host,cert)=>{
   try{if(host!==this.host)throw failure('NPLAY_TLS_PIN_MISMATCH');this.verify(cert.raw);}
   catch(error){return error;}
  };
  return {ca:this.certificate,rejectUnauthorized:true,checkServerIdentity,minVersion:'TLSv1.2',agent:false};
 }
 readCertificate(address){
  return new Promise((resolve,reject)=>{
   let socket;
   const finish=(error)=>{clearTimeout(timer);socket?.destroy();if(error)reject(error);else resolve();};
   const timer=setTimeout(()=>finish(failure('ETIMEDOUT')),5000);
   socket=tls.connect({host:address,port:this.port,servername:this.host,rejectUnauthorized:false,minVersion:'TLSv1.2'},()=>{
    try{
     const cert=socket.getPeerCertificate();this.verify(cert.raw);
     this.certificate=new X509Certificate(cert.raw).toString();finish();
    }catch(error){finish(error);}
   });
   socket.once('error',()=>finish(failure('NPLAY_TLS_PIN_CONNECTION')));
  });
 }
}

const host=process.env.NPLAY_TLS_PINNED_HOST||'',fingerprint=process.env.NPLAY_TLS_PINNED_SHA256||'';
export const providerTrust=host||fingerprint?new ProviderTlsTrust({origin:'https://'+host,fingerprint}):null;
export const providerUrl=raw=>providerTrust?providerTrust.normalize(raw):new URL(raw);
