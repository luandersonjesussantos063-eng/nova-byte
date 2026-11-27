const merchantId=5917546308;
const brazilDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'});

export function surveyDetails(order,email,now=new Date()){
 if(order.status!=='approved'||order.fulfillmentStatus==='cancelled'||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(order.id||'')||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email||'')||
    !Number.isInteger(order.estimatedDays)||order.estimatedDays<1||order.estimatedDays>90||
    !order.createdAt)return null;
 const created=new Date(order.createdAt);
 if(!Number.isFinite(created.getTime()))return null;

 const delivery=new Date(brazilDate.format(created)+'T12:00:00Z');
 // The carrier quote is in business days. Kaia Glow needs one business day to dispatch.
 let remaining=order.estimatedDays+1;
 while(remaining>0){
  delivery.setUTCDate(delivery.getUTCDate()+1);
  if(delivery.getUTCDay()!==0&&delivery.getUTCDay()!==6)remaining--;
 }
 const estimated=delivery.toISOString().slice(0,10);
 if(estimated<brazilDate.format(now))return null;
 return {
  merchant_id:merchantId,
  order_id:'KG-'+order.id.replace(/-/g,'').toUpperCase(),
  email,
  delivery_country:'BR',
  estimated_delivery_date:estimated
 };
}

async function loadGoogle(){
 if(window.gapi?.load)return;
 await new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://apis.google.com/js/platform.js';
  script.async=true;
  script.referrerPolicy='no-referrer';
  script.onload=resolve;
  script.onerror=()=>{script.remove();reject(Error('Falha ao carregar o Google'));};
  document.head.append(script);
 });
}

export async function openOrderSurvey(details){
 await loadGoogle();
 await new Promise((resolve,reject)=>{
  const failure=()=>reject(Error('Pesquisa indisponível'));
  window.gapi.load('surveyoptin',{
   callback:()=>{
    try{window.gapi.surveyoptin.render(details);resolve();}
    catch(error){reject(error);}
   },
   onerror:failure,ontimeout:failure,timeout:10000
  });
 });
}
