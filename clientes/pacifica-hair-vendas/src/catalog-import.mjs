export const BRANDS=["Avon","Natura"];
export function parseCatalog(text,{brand,cycle,source}){
 if(!BRANDS.includes(brand)||!/^([1-9]|1[0-9]|2[0-2])\/20\d{2}$/.test(cycle)||!String(source||"").trim())throw Error("Informe marca, ciclo e fonte da revista.");
 const lines=String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.shift()?.toLowerCase()!=="codigo;nome;categoria;preco;foto")throw Error("Cabeçalho: codigo;nome;categoria;preco;foto");
 if(!lines.length||lines.length>5000)throw Error("Importe de 1 a 5.000 itens.");
 const seen=new Set();
 return lines.map((line,i)=>{
 const f=line.split(";").map(x=>x.trim());const [code,name,category,price,image]=f;
 if(f.length!==5||!/^[A-Za-z0-9_-]{1,40}$/.test(code)||!name||name.length>180||!["Perfumes","Cosméticos","Cabelos","Cuidados Pessoais","Presentes","Maquiagem","Roupas íntimas"].includes(category)||!/^\d+[,.]\d{2}$/.test(price))throw Error("Confira os dados da linha "+(i+2));
 const priceCents=Number(price.replace(/[,.]/,""));if(!Number.isSafeInteger(priceCents)||priceCents<=0||priceCents>10000000||image&&!/^https:\/\/[^\s]+$/i.test(image))throw Error("Preço ou foto inválidos na linha "+(i+2));
 const id="revista-"+brand.toLowerCase()+"-"+code.toLowerCase();if(seen.has(id))throw Error("Código duplicado: "+code);seen.add(id);
 return {id,brand,code,name,category,priceCents,compareCents:0,image,stock:0,cycle,source:String(source).trim(),catalog:true,demo:false,accent:"rose",description:"Preço da revista informada pela consultora. Disponibilidade a confirmar."};
 });
}
export function mergeCatalog(existing,rows){const result=new Map(existing.map(p=>[p.id,p]));for(const p of rows){const prev=result.get(p.id);result.set(p.id,{...prev,...p,stock:Math.max(0,Number(prev?.stock)||0),image:p.image||prev?.image||""});}return [...result.values()];}
