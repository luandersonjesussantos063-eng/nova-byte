// Advanced-mode Pages Worker: only QA routes are bundled. No production adapters.
import {onRequest as guard} from '../../functions/_middleware.js';
import {onRequestPost as orders} from '../../functions/api/kaia/mp-test/orders.js';
import {onRequestPost as webhook} from '../../functions/api/kaia/mp-test/webhook.js';
import {onRequestGet as status} from '../../functions/api/kaia/mp-test/status.js';
import {onRequestGet as orderStatus,onRequestPost as cancelOrder} from '../../functions/api/kaia/mp-test/order.js';
export default {
 async fetch(request,env){
  const data={},path=new URL(request.url).pathname;
  return guard({request,env,data,next:()=>{
   if(path==='/api/kaia/mp-test/orders'&&request.method==='POST')return orders({request,env,data});
   if(path==='/api/kaia/mp-test/webhook'&&request.method==='POST')return webhook({request,env,data});
   if(path==='/api/kaia/mp-test/status'&&request.method==='GET')return status({request,env,data});
   if(path==='/api/kaia/mp-test/order'&&request.method==='GET')return orderStatus({request,env,data});
   if(path==='/api/kaia/mp-test/order'&&request.method==='POST')return cancelOrder({request,env,data});
   if(['/','/index.html','/lab.js','/robots.txt'].includes(path)&&['GET','HEAD'].includes(request.method))return env.ASSETS.fetch(request);
   return new Response('Not found',{status:404});
  }});
 }
};
