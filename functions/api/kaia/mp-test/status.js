import {reply,testConfig,databaseGuard,tester,verifyTestSeller} from '../../../../kaia-glow/backend/mp-test-core.js';
export async function onRequestGet({request,env,data}){
 try{
  testConfig(request,env);tester(data,env);await databaseGuard(env);await verifyTestSeller(env);
  const ready=env.KAIA_SF_MODE==='sandbox'&&env.KAIA_SF_SANDBOX_CONFIRMED==='true'&&!!env.KAIA_SF_SANDBOX_TOKEN&&!!env.KAIA_MP_WEBHOOK_SECRET;
  return reply({test:true,ready,productionCheckout:false});
 }catch{return reply({test:true,ready:false,productionCheckout:false});}
}
