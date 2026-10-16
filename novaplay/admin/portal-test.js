(()=>{
'use strict';
const form=document.getElementById('portal-test-form');if(!form)return;
const $=id=>document.getElementById(id),out=$('portal-test-result'),submit=form.querySelector('[type="submit"]');let busy=false,db;
$('portal-parse').onclick=()=>{
 const text=$('portal-paste').value;
 const read=label=>text.match(new RegExp('(?:^|[\\r\\n])[^\\r\\nA-Za-z0-9]*'+label+'\\s*[:➤]\\s*([^\\s│]+)','i'))?.[1]||'';
 const portal=text.match(/https?:\/\/[^\s│]+/i)?.[0]||'';
 for(const [id,value] of [['portal-url',portal],['portal-mac',read('Mac')],['portal-sn',read('SN')],['portal-sncut',read('SNCUT')],['portal-dev1',read('DEV1')],['portal-dev2',read('DEV2')]])if(value)$(id).value=value;
 if(read('SNCUT'))$('portal-serial-mode').value='short';
 $('portal-paste').value='';out.textContent='Campos preenchidos. Confira o SN a enviar e o tipo de API antes de testar.';
};
$('portal-clear').onclick=()=>{form.reset();out.textContent='Campos limpos.';};
form.onsubmit=async event=>{
 event.preventDefault();if(busy)return;
 if(!window.supabase?.createClient){out.textContent='A conexão do painel ainda não está pronta. Aguarde e tente novamente.';return;}
 const sn=$($('portal-serial-mode').value==='short'?'portal-sncut':'portal-sn').value.trim();
 if(!sn){out.textContent='Preencha o SN selecionado para o teste.';return;}
 busy=true;submit.disabled=true;$('portal-clear').disabled=true;$('portal-parse').disabled=true;out.textContent='Conectando ao portal e conferindo a autenticação…';
 try{
  db??=window.supabase.createClient('https://vajlhodqxskozuxxlujv.supabase.co','sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3');
  const {data}=await db.auth.getSession();if(!data?.session?.access_token)throw Error('Entre no painel administrativo para testar.');
  const response=await fetch('https://nplay-portal-test.luandersonjesussantos063.workers.dev/test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify({portal:$('portal-url').value.trim(),mac:$('portal-mac').value.trim(),sn,dev1:$('portal-dev1').value.trim(),dev2:$('portal-dev2').value.trim(),endpoint:$('portal-endpoint').value}),signal:AbortSignal.timeout(40000)});
  const result=await response.json();out.textContent=(result.ok?'✓ Perfil recebido do portal. ':'Teste não confirmado. ')+(result.message||'O servidor não retornou um diagnóstico válido.');
 }catch(error){out.textContent=error.message==='Entre no painel administrativo para testar.'?error.message:'Não foi possível concluir o teste. Confira sua conexão e tente novamente.';}
 finally{busy=false;submit.disabled=false;$('portal-clear').disabled=false;$('portal-parse').disabled=false;}
};
})();
