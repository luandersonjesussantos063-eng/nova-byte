// Shared browser policy for static Pages responses and dynamic Functions.
export function contentSecurityPolicy(hashes=[],{orderSurvey=false}={}){
 const scripts=orderSurvey?' https://apis.google.com https://www.gstatic.com':'';
 const connections=orderSurvey?' https://apis.google.com https://www.google.com':'';
 const frames=orderSurvey?' https://apis.google.com https://www.google.com':'';
 return ["default-src 'self'",`script-src 'self' https://cdn.jsdelivr.net${scripts} ${hashes.join(' ')}`.trim(),
 "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
 "font-src 'self' data: https://fonts.gstatic.com",
 "img-src 'self' data: blob: https:","media-src 'self' blob: https:",
 "connect-src 'self' https://vajlhodqxskozuxxlujv.supabase.co wss://vajlhodqxskozuxxlujv.supabase.co https://viacep.com.br https://brasilapi.com.br https://cdn.jsdelivr.net"+connections,
 "frame-src https://www.instagram.com"+frames, "frame-ancestors 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "upgrade-insecure-requests"].join('; ');
}
export const securityHeaders={
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'X-Frame-Options':'SAMEORIGIN',
 'Strict-Transport-Security':'max-age=15552000',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()'
};
