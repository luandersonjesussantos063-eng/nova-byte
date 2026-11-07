// Temporary read-only network diagnostic for ERP Olist OAuth.
// Fixed hosts and paths, no user-controlled URLs, credentials or tokens.
// Returns only coarse HTTP/network status and never logs response bodies.
const targets=[
 {name:'oauth_discovery',url:'https://accounts.tiny.com.br/realms/tiny/.well-known/openid-configuration'},
 {name:'oauth_token_get',url:'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token'},
 {name:'oauth_token_post_no_credentials',url:'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token',method:'POST'},
 {name:'olist_api',url:'https://erp.tiny.com.br/public-api/v3/produtos?limit=1'}
];
async function probe(item){
 try{
  const result=await fetch(item.url,{
   method:item.method||'GET',redirect:'manual',
   headers:{accept:'application/json',...(item.method==='POST'?{'content-type':'application/x-www-form-urlencoded'}:{})},
   ...(item.method==='POST'?{body:'grant_type=authorization_code'}:{}),
   signal:AbortSignal.timeout(6500)
  });
  const redirected=result.status>=300&&result.status<400;
  let redirectHost=null;
  if(redirected){
   try{redirectHost=new URL(result.headers.get('location'),item.url).hostname;}
   catch{}
  }
  return {name:item.name,kind:'http',status:result.status,redirectHost};
 }catch(e){
  const error=e?.name==='TimeoutError'?'timeout':
   e?.name==='AbortError'?'aborted':e?.name==='TypeError'?'network_or_redirect':'unknown';
  return {name:item.name,kind:'exception',error};
 }
}
export async function onRequestGet(){
 const observations=await Promise.all(targets.map(probe));
 return new Response(JSON.stringify({test:'olist_upstream_no_credentials',observations}),{
  status:200,headers:{
   'content-type':'application/json; charset=utf-8',
   'cache-control':'public,max-age=90',
   'x-content-type-options':'nosniff',
   'referrer-policy':'no-referrer',
   'x-robots-tag':'noindex, nofollow'
  }
 });
}
