// Only the postal code is transmitted to the public address lookup service.
export const cepDigits=value=>String(value??"").replace(/\D/g,"").slice(0,8);
export function formatCep(value){const s=cepDigits(value);return s.length>5?s.slice(0,5)+"-"+s.slice(5):s}
export const cepAddressFields=["street","neighborhood","city","state"];
export async function lookupCep(cep,{fetcher=globalThis.fetch,signal}={}){
 if(!/^\d{8}$/.test(cep))throw new Error("invalid");
 const response=await fetcher("https://viacep.com.br/ws/"+cep+"/json/",{signal,credentials:"omit",referrerPolicy:"no-referrer",headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("unavailable");
 const data=await response.json();
 if(data?.erro===true||data?.erro==="true")throw new Error("not_found");
 if(!data||cepDigits(data.cep)!==cep||!String(data.localidade||"").trim()||!(/^[A-Z]{2}$/.test(data.uf||"")))throw new Error("unavailable");
 return {street:String(data.logradouro||"").trim().slice(0,160),neighborhood:String(data.bairro||"").trim().slice(0,100),city:String(data.localidade||"").trim().slice(0,100),state:data.uf};
}
// Never overwrite manual changes made while an asynchronous lookup is pending.
export function mergeCepAddress(before,current,address){
 return Object.fromEntries(cepAddressFields.filter(k=>current[k]===before[k]).map(k=>[k,address[k]||""]));
}
