/* Shared presentation rules. Never changes transactional stock, prices or SKUs. */
(function(root){
 const cleanDescription=value=>String(value||'').replace(/Disponibilidade e valor conforme contagem de setembro de 2026\.\s*Confirme com a loja antes da compra\.?/gi,'').replace(/Cadastro a partir da planilha de estoque de setembro de 2026\.\s*Foto do produto pendente de conferência\.\s*Confirme disponibilidade e preço atual com a loja\./gi,'Confira a apresentação, a composição e o modo de uso na embalagem. Para mais detalhes, converse com a equipe Kaia Glow.').trim();
 function normalize(product){
  product.name=String(product.name||'').replace(/\s*\(cadastro sem título na origem\)/gi,'').trim();
  product.description=cleanDescription(product.description);
  if(product.sku==='KG-MED-PDRNPINK-MASK-28G'&&/1 máscara/i.test(product.name))
   product.description=product.description.replace(/Conteúdo:\s*2 máscaras faciais em gel/gi,'Apresentação anunciada: 28 g / 1 máscara');
  const brand=String(product.brand||'').trim();
  product.brand=/^d[’']alba$/i.test(brand)?'d’Alba':/^vt(?: cosmetics)?$/i.test(brand)?'VT Cosmetics':brand;
  return product;
 }
 const hasPhoto=p=>Array.isArray(p.images)&&p.images.some(s=>s&&!/photo-pending|placeholder/i.test(s));
 function brief(p){
  const n=p.name||'';
  if(/eye.*patch|patch.*eye/i.test(n))return 'Patches para o cuidado da área dos olhos';
  if(/cleans|limpeza/i.test(n))return 'Limpeza para a sua rotina facial';
  if(/toner/i.test(n))return 'Tônico para a rotina de cuidados com a pele';
  if(/mask|máscara/i.test(n))return p.category==='Cabelos'?'Máscara para o cuidado dos cabelos':'Máscara para o seu momento de autocuidado';
  if(/serum|sérum|ampoule|booster/i.test(n))return p.category==='Cabelos'?'Sérum para o cuidado capilar':'Sérum para complementar a rotina facial';
  if(/cream|creme|moisturizer/i.test(n))return 'Creme para a rotina de cuidados com a pele';
  return p.category==='Cabelos'?'Cuidado para os seus cabelos':p.category==='Corpo e spa'?'Um detalhe para o seu autocuidado':'Conheça a apresentação e o modo de uso';
 }
 root.KaiaCatalogPresentation={normalize,cleanDescription,hasPhoto,brief};
})(globalThis);
