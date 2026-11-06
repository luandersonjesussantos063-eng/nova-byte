import {reply,testConfig,databaseGuard,tester,verifyTestSeller} from '../../../../kaia-glow/backend/mp-test-core.js';
export async function onRequestGet({request,env,data}){
 const required=['KAIA_TEST_SUPABASE_SERVICE_KEY','KAIA_MP_TEST_ACCESS_TOKEN','KAIA_MP_WEBHOOK_SECRET'];
 const shipping=['KAIA_SF_SANDBOX_TOKEN','KAIA_MP_TEST_SF_SERVICES','KAIA_SHIPPING_TECH_CONTACT'];
 try{
  tester(data,env);
  const missing=required.filter(name=>!env[name]);
  if(missing.length)return reply({test:true,ready:false,productionCheckout:false,missing});
  // Read-only readiness can verify saved keys while test charges stay disabled.
  testConfig(request,env,{requireEnabled:false});await databaseGuard(env);const seller=await verifyTestSeller(env);
  const missingShipping=shipping.filter(name=>!env[name]);
  const ready=env.KAIA_MP_TEST_ENABLED==='true'&&env.KAIA_SF_MODE==='sandbox'&&env.KAIA_SF_SANDBOX_CONFIRMED==='true'&&missingShipping.length===0;
  return reply({test:true,ready,productionCheckout:false,sellerTestAccount:seller.testAccount,missing:missingShipping});
 }catch{return reply({test:true,ready:false,productionCheckout:false});}
}
