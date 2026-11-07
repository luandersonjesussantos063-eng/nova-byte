// Read-only transactional email readiness, admin-only. No recipient data or secrets.
import {buyerAdmin,db,PaymentError,response,fail} from '../checkout-validacao/_core.js';
export async function onRequestGet({request,env}){
 try{
  const u=new URL(request.url);
  if(u.protocol!=='https:'||!['usekaiaglow.com.br','www.usekaiaglow.com.br'].includes(u.hostname))
   throw new PaymentError('AMBIENTE_INVALIDO',403);
  await buyerAdmin(request,env);
  const settings=await db(env,'kaia_order_mail_settings?slot=eq.1&select=enabled,last_dispatch_at,last_error_code');
  const queued=await db(env,'kaia_order_mail_outbox?select=status&limit=1000');
  return response({enabled:settings?.[0]?.enabled===true,
    senderConfigured:!!env.KAIA_ORDER_EMAIL_API_KEY&&
     /^[^\s@<>]+@usekaiaglow\.com\.br$/i.test(env.KAIA_ORDER_EMAIL_FROM||''),
    queued:queued.filter(x=>x.status==='queued').length,
    sending:queued.filter(x=>x.status==='sending').length,
    accepted:queued.filter(x=>x.status==='sent').length,
    failed:queued.filter(x=>x.status==='failed').length,
    lastError:settings?.[0]?.last_error_code||null,
    merchantRecipient:'Usekaiaglow@gmail.com',notificationTypes:['buyer','merchant'],confirmationOnly:true});
 }catch(e){return fail(e);}
}
