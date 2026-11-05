// Shopee authorization callback is intentionally closed until official partner keys and server-side token exchange are configured.
// Never log OAuth codes or return them to the storefront.
export function onRequestGet(){return new Response(JSON.stringify({channel:'shopee',connected:false,status:'not_configured',message:'Conexão Shopee ainda não habilitada.'}),{status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
