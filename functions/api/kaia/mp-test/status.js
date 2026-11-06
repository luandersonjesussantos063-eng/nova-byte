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
  const enabled=env.KAIA_MP_TEST_ENABLED==='true';
  const shippingReady=enabled&&env.KAIA_SF_MODE==='sandbox'&&env.KAIA_SF_SANDBOX_CONFIRMED==='true'&&missingShipping.length===0;
  const paymentOnlyReady=enabled&&env.KAIA_QA_ALLOW_NO_DELIVERY==='true';
  return reply({test:true,ready:shippingReady||paymentOnlyReady,paymentOnlyReady,shippingReady,
   productionCheckout:false,sellerTestAccount:seller.testAccount,missing:missingShipping});
 }catch{return reply({test:true,ready:false,productionCheckout:false});}
}
