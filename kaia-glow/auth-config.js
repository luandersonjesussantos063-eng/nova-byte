// Keep the Supabase publishable key public; never place any service-role key here.
export function resolveKaiaAccountUrl(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (host === 'teste.usekaiaglow.com.br') return 'https://teste.usekaiaglow.com.br/conta.html';
  return host === 'kaia-glow.pages.dev' || host.endsWith('.kaia-glow.pages.dev')
    ? 'https://kaia-glow.pages.dev/conta.html'
    : 'https://usekaiaglow.com.br/conta.html';
}
const currentHost = typeof location === 'undefined' ? '' : location.hostname.toLowerCase();
export const KAIA_AUTH = {
  url: "https://vajlhodqxskozuxxlujv.supabase.co",
  publishableKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhamxob2RxeHNrb3p1eHhsdWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDQ0ODIsImV4cCI6MjEwNTQ4MDQ4Mn0.2HfSpUNZZZAJ8xQWK6yuwAkxNa_-dtuFTfkYJzSPybk",
  accountUrl: resolveKaiaAccountUrl(currentHost),
  // A staging redirect must be explicitly allowed in Supabase Auth before email flows are tested.
  stagingEmailRedirectReady: false,
  isStaging: currentHost === 'teste.usekaiaglow.com.br' || currentHost === 'kaia-glow.pages.dev' || currentHost.endsWith('.kaia-glow.pages.dev')
};
