// TEMPORARY authenticated shipping API diagnostic; remove after single controlled test.
// Never issues or purchases shipping labels. Uses illustrative dimensions, not shop inventory.
const reply=(result,status=200)=>new Response(JSON.stringify(result),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const safeEq=(a,b)=>{const x=String(a||''),y=String(b||'');if(!x||x.length!==y.length)return false;let n=0;for(let i=0;i<x.length;i++)n|=x.charCodeAt(i)^y.charCodeAt(i);return n===0};
export async function onRequestPost({request,env}){
 if(!safeEq(request.headers.get('x-kaia-diagnostic'),env.KAIA_INTERNAL_DIAGNOSTIC_KEY))return reply({code:'NOT_FOUND'},404);
 if(env.KAIA_SHIPPING_PROVIDER!=='superfrete'||!env.KAIA_SF_ACCESS_TOKEN)return reply({code:'CONFIGURACAO_INCOMPLETA'},503);
 const payload={
  from:{postal_code:'01550000'},to:{postal_code:'01001000'},services:'1,2,17',
  products:[{quantity:1,height:4,width:11,length:17,weight:0.3}],
  options:{own_hand:false,receipt:false,insurance_value:50,use_insurance_value:false}
 };
 let response;
 try{response=await fetch('https://api.superfrete.com/api/v0/calculator',{
  method:'POST',headers:{
   'Authorization':'Bearer '+env.KAIA_SF_ACCESS_TOKEN,
   'User-Agent':'KaiaGlow/1.0 (usekaiaglow@gmail.com)',
   'Content-Type':'application/json','Accept':'application/json'
  },body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)
 });}catch(error){return reply({code:'ERRO_CONEXAO',error_type:error?.name||'unknown'},503)}
 let data;
 try{data=await response.json()}catch{return reply({code:'RESPOSTA_NAO_JSON',provider_http:response.status},502)}
 if(!response.ok){
  const e=typeof data?.message==='string'?data.message:'';
  return reply({code:'ERRO_SUPERFRETE',provider_http:response.status,provider_code:String(data?.code||''),error_summary:e.slice(0,180),response_fields:Object.keys(data||{}).slice(0,14)},502);
 }
 const services=Array.isArray(data)?data.map(x=>({
  id:String(x.id||''),servico:String(x.name||''),transportadora:String(x.company?.name||''),
  disponivel:x.has_error===false,preco:typeof x.price==='number'||typeof x.price==='string'?String(x.price):null,
  prazoDias:Number.isFinite(Number(x.delivery_time))?Number(x.delivery_time):null,
  erro:x.has_error===true
 })):null;
 return reply({code:'COTACAO_TESTE',provider_http:response.status,servicos:services,
  campos:services===null?Object.keys(data||{}).slice(0,14):undefined,
  pacoteSimulado:true,comprimentoCm:17,larguraCm:11,alturaCm:4,pesoKg:0.3,
  origemCep:'01550000',destinoCep:'01001000',
  aviso:'Cotação diagnóstica apenas, sem compra de etiqueta, sem estoque vinculado.'});
}
