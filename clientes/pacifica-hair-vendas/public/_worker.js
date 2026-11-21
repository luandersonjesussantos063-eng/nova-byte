const out=(x,status=200,h={})=>new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...h}});
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,"0")).join("");
const eq=(a,b)=>{if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0};
const now=()=>Math.floor(Date.now()/1000),cookie=(s,t)=>"__Host-pacifica_admin="+s+"; Path=/; Max-Age="+t+"; Secure; HttpOnly; SameSite=Strict";
const products=async(db,all)=>{const r=await db.prepare("SELECT id,payload,visible,version FROM products "+(all?"":"WHERE visible=1 ")+"ORDER BY rowid").all();return r.results.map(p=>({...JSON.parse(p.payload),id:p.id,visible:!!p.visible,version:p.version}))};
const cats=["Perfumes","Cosméticos","Cabelos","Cuidados Pessoais","Presentes","Maquiagem","Roupas íntimas","Pijamas"];
const pathPhoto=s=>typeof s==="string"&&((/^\/assets\/[a-zA-Z0-9_./-]+\.(webp|png|jpg|jpeg)$/i.test(s)&&!s.includes(".."))||/^\/api\/photos\/[a-f0-9]{64}$/.test(s));
async function body(r,max=2500000){if(Number(r.headers.get("Content-Length")||0)>max)throw Error("Solicitação muito grande");const s=await r.text();if(s.length>max)throw Error("Solicitação muito grande");return JSON.parse(s)}
async function route(req,env){
 const u=new URL(req.url),p=u.pathname,db=env.PACIFICA_DB;
 if(!p.startsWith("/api/"))return env.ASSETS.fetch(req);
 if(!db)return out({error:"Banco indisponível."},503);
 if(p==="/api/catalog"&&req.method==="GET")return out({products:await products(db,false)});
 if(p.startsWith("/api/photos/")&&req.method==="GET"){const id=p.split("/").at(-1);if(!/^[a-f0-9]{64}$/.test(id))return out({error:"Foto não encontrada."},404);const row=await db.prepare("SELECT data FROM photos WHERE id=?").bind(id).first();if(!row)return out({error:"Foto não encontrada."},404);return new Response(Uint8Array.from(atob(row.data.split(",")[1]),x=>x.charCodeAt(0)),{headers:{"Content-Type":"image/webp","Cache-Control":"public,max-age=31536000,immutable","X-Content-Type-Options":"nosniff"}})}
 if(!p.startsWith("/api/admin/"))return out({error:"Não encontrado."},404);
 if(req.method!=="GET"&&req.headers.get("Origin")!==u.origin)return out({error:"Origem inválida."},403);
 if(p==="/api/admin/status"&&req.method==="GET")return out({ready:typeof env.ADMIN_PASSWORD==="string"&&env.ADMIN_PASSWORD.length>=12,reason:typeof env.ADMIN_PASSWORD!=="string"||!env.ADMIN_PASSWORD.length?"missing":env.ADMIN_PASSWORD.length<12?"too_short":"ready"});
 if(p==="/api/admin/login"&&req.method==="POST"){
  if(typeof env.ADMIN_PASSWORD!=="string"||!env.ADMIN_PASSWORD.length)return out({error:"O segredo da administração não está disponível nesta implantação. Verifique o ambiente de produção."},503);
  if(env.ADMIN_PASSWORD.length<12)return out({error:"A senha administrativa configurada precisa ter pelo menos 12 caracteres."},503);
  const ip=await hash(req.headers.get("CF-Connecting-IP")||"unknown"),t=now();
  const r=await db.prepare("INSERT INTO attempts(ip,count,expires) VALUES (?,1,?) ON CONFLICT(ip) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count").bind(ip,t+900,t,t).first();
  if(r.count>5)return out({error:"Muitas tentativas. Tente novamente em 15 minutos."},429);
  const b=await body(req,2000);if(typeof b.password!=="string"||b.password.length>300||!eq(await hash(b.password),await hash(env.ADMIN_PASSWORD)))return out({error:"Senha incorreta."},401);
  const key=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
  await db.batch([db.prepare("DELETE FROM sessions WHERE expires<=?").bind(t),db.prepare("INSERT INTO sessions(hash,expires) VALUES (?,?)").bind(await hash(key),t+28800),db.prepare("DELETE FROM attempts WHERE ip=?").bind(ip)]);
  return out({ok:true},200,{"Set-Cookie":cookie(key,28800)});
 }
 const m=(req.headers.get("Cookie")||"").match(/(?:^|;\s*)__Host-pacifica_admin=([a-f0-9]{64})(?:;|$)/),session=m?await hash(m[1]):"";
 if(!session||!(await db.prepare("SELECT hash FROM sessions WHERE hash=? AND expires>?").bind(session,now()).first()))return out({error:"Entre no painel."},401);
 if(p==="/api/admin/logout"&&req.method==="POST"){await db.prepare("DELETE FROM sessions WHERE hash=?").bind(session).run();return out({ok:true},200,{"Set-Cookie":cookie("",0)})}
 if(p==="/api/admin/products"&&req.method==="GET")return out({products:await products(db,true)});
 if(p==="/api/admin/products"&&req.method==="POST"){
  const b=await body(req),x=b.product;
  if(!x||typeof x.id!=="string"||!/^[a-zA-Z0-9_-]{1,120}$/.test(x.id)||typeof x.name!=="string"||!x.name.trim()||x.name.length>200||typeof x.brand!=="string"||!x.brand.trim()||x.brand.length>100||!cats.includes(x.category)||typeof x.code!=="string"||x.code.length>60||!Number.isSafeInteger(x.priceCents)||x.priceCents<1||x.priceCents>100000000||!Number.isSafeInteger(x.compareCents)||x.compareCents<0||x.compareCents>100000000||!Number.isSafeInteger(x.stock)||x.stock<0||x.stock>100000||typeof x.visible!=="boolean"||!Array.isArray(x.images)||x.images.length>5||x.visible&&!x.images.length)return out({error:"Confira os campos e adicione uma foto para publicar."},400);
  if(x.discountPercent!==undefined){const n=x.discountPercent;if(!Number.isInteger(n)||n<0||n>99||n===0&&x.compareCents!==0||n>0&&(x.compareCents<=x.priceCents||Math.max(1,Math.round(x.compareCents*(100-n)/100))!==x.priceCents))return out({error:"Preço promocional inconsistente."},400);}
  if(x.compareCents&&x.compareCents<=x.priceCents)return out({error:"O preço normal deve ser maior que o promocional."},400);
  const old=await db.prepare("SELECT payload,version FROM products WHERE id=?").bind(x.id).first();if(old?old.version!==b.version:b.version!==0)return out({error:"Produto alterado em outra sessão. Atualize."},409);
  if(x.code&&await db.prepare("SELECT id FROM products WHERE id<>? AND lower(json_extract(payload,'$.brand'))=lower(?) AND lower(json_extract(payload,'$.code'))=lower(?) LIMIT 1").bind(x.id,x.brand.trim(),x.code.trim()).first())return out({error:"Código duplicado para esta marca."},409);
  const photos=[],ops=[];
  for(const s of x.images){if(pathPhoto(s)){photos.push(s);continue}if(typeof s!=="string"||s.length>440000||!/^data:image\/webp;base64,UklG[A-Za-z0-9+/]+={0,2}$/.test(s))return out({error:"Foto inválida."},400);const id=await hash(s);ops.push(db.prepare("INSERT OR IGNORE INTO photos(id,data) VALUES (?,?)").bind(id,s));photos.push("/api/photos/"+id)}
  const clean={...(old?JSON.parse(old.payload):{}),id:x.id,name:x.name.trim(),brand:x.brand.trim(),code:x.code.trim(),category:x.category,priceCents:x.priceCents,compareCents:x.compareCents,discountPercent:x.discountPercent??(x.compareCents>x.priceCents?Math.min(99,Math.max(1,Math.round(100*(1-x.priceCents/x.compareCents)))):0),stock:x.stock,description:String(x.description||"").slice(0,12000),image:photos[0]||"",images:photos,visible:x.visible,demo:false,reference:false,catalog:false};
  ops.push(old?db.prepare("UPDATE products SET payload=?,visible=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?").bind(JSON.stringify(clean),x.visible?1:0,x.id,b.version):db.prepare("INSERT INTO products(id,payload,visible) VALUES(?,?,?)").bind(x.id,JSON.stringify(clean),x.visible?1:0));
  const r=await db.batch(ops);if(r.at(-1)?.meta?.changes!==1)return out({error:"Alteração concorrente. Atualize."},409);return out({ok:true});
 }
 return out({error:"Não encontrado."},404);
}
export default {async fetch(req,env){try{return await route(req,env)}catch(e){console.error("Pacifica API",e.message);return out({error:"Não foi possível concluir a solicitação."},500)}}};
