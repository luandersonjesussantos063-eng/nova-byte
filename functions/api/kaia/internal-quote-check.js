// Temporary authenticated QA for a single Nuvemshop-confirmed Kaia package; remove immediately after test.
const response=(result,status=200)=>new Response(JSON.stringify(result),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
function eq(a,b){a=String(a||'');b=String(b||'');if(!a||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
export async function onRequestPost({request,env}){
 if(!eq(request.headers.get('x-kaia-qa'),env.KAIA_QA_CHECK_SECRET))return response({code:'NOT_FOUND'},404);
 if(!env.KAIA_SF_ACCESS_TOKEN)return response({code:'NOT_CONFIGURED'},503);
 const payload={
  from:{postal_code:'01550000'},to:{postal_code:'01001000'},
  services:'1,2,17',
  products:[{quantity:1,height:7,width:15,length:22,weight:0.3}],
  options:{own_hand:false,receipt:false,use_insurance_value:false}
 };
 let r;try{r=await fetch('https://api.superfrete.com/api/v0/calculator',{method:'POST',
 headers:{Authorization:'Bearer '+env.KAIA_SF_ACCESS_TOKEN,'User-Agent':'KaiaGlow/1.0 (usekaiaglow@gmail.com)','content-type':'application/json',accept:'application/json'},
 body:JSON.stringify(payload),signal:AbortSignal.timeout(14000)})}catch(e){return response({code:'NETWORK_FAIL',reason:e.name},503)}
 let data;try{data=await r.json()}catch{return response({code:'BAD_JSON',providerHttp:r.status},502)}
 if(!r.ok)return response({code:'QUOTE_FAILED',providerHttp:r.status,category:String(data.code||''),message:String(data.message||'').slice(0,150)},502);
 return response({code:'QUOTE_TEST_PRODUCT',providerHttp:r.status,
 sampleSku:'KG-MED-ZEROPAD2-70P',samplePackage:{grams:300,lengthCm:22,widthCm:15,heightCm:7},postalOrigin:'01550000',postalDestination:'01001000',
 options:Array.isArray(data)?data.map(x=>({id:x.id,name:x.name,carrier:x.company?.name,price:x.price,deliveryTime:x.delivery_time,hasError:x.has_error})):[],
 comment:'Quote-only using Nuvemshop confirmed packaging; no label or payment was created.'});
}
