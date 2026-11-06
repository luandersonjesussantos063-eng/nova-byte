import {reply,testConfig,databaseGuard,tester,verifyTestSeller} from '../../../../kaia-glow/backend/mp-test-core.js';
export async function onRequestGet({request,env,data}){
 const required=['KAIA_TEST_SUPABASE_SERVICE_KEY','KAIA_MP_TEST_ACCESS_TOKEN','KAIA_MP_WEBHOOK_SECRET',
  'KAIA_SF_SANDBOX_TOKEN','KAIA_MP_TEST_SELLER_ID','KAIA_MP_TEST_BUYER_EMAIL','KAIA_MP_TEST_SF_SERVICES',
  'KAIA_SHIPPING_TECH_CONTACT'];
 try{
  tester(data,env);
  const missing=required.filter(name=>!env[name]);
  if(missing.length)return reply({test:true,ready:false,productionCheckout:false,missing});
  testConfig(request,env);tester(data,env);await databaseGuard(env);await verifyTestSeller(env);
  const ready=env.KAIA_SF_MODE==='sandbox'&&env.KAIA_SF_SANDBOX_CONFIRMED==='true'&&!!env.KAIA_SF_SANDBOX_TOKEN&&!!env.KAIA_MP_WEBHOOK_SECRET;
  return reply({test:true,ready,productionCheckout:false});
 }catch{return reply({test:true,ready:false,productionCheckout:false});}
}
