// This branch builds ONLY the private payment laboratory, never the storefront.
if(process.env.KAIA_MP_PREVIEW_BUILD!=='true'){
 throw Error('KAIA_MP_PREVIEW_BUILD must be true for the isolated payment-test branch.');
}
await import('./build-kaia-mp-homologacao.mjs');
