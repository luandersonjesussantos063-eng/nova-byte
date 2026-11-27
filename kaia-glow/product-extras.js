/* Quote-only shipping, product composition and verified ratings. */
(function(){
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
 const officialIngredients=Object.freeze({
  "KG-MED-TXANI15-30ML": {
    "name": "Medicube TXA Niacinamide 15 Serum",
    "source": "https://medicube.us/products/txa-niacinamide-serum",
    "inci": "Water, Niacinamide, Glycerin, Butylene Glycol, Tranexamic Acid, Arbutin, Diethoxyethyl Succinate, Chlorphenesin, C12-14 Alketh-12, Ethylhexylglycerin, Xanthan Gum, Carbomer, Adenosine, Disodium EDTA, Melia Azadirachta Leaf Extract, Melia Azadirachta Flower Extract, 1,2-Hexanediol, Panthenol, Cyanocobalamin, Betaine, Coccinia Indica Fruit Extract, Rosa Centifolia Flower Oil, Ferulic Acid, Corallina Officinalis Extract, Pentylene Glycol, Glutathione, Hydrolyzed Hyaluronic Acid, Hydrolyzed Sodium Hyaluronate, Dimethylsilanol Hyaluronate, Hyaluronic Acid, Potassium Hyaluronate, Sodium Hyaluronate, Hydroxypropyltrimonium Hyaluronate, Sodium Hyaluronate Crosspolymer, Sodium Hyaluronate Dimethylsilanol, Sodium Acetylated Hyaluronate, Acetyl Tetrapeptide-5, Hexapeptide-9, Palmitoyl Tripeptide-5",
    "checked": "2026-11-27"
  },
  "KG-MED-PDRNPINK-MASK-28G": {
    "name": "Medicube PDRN Pink Collagen Gel Mask",
    "source": "https://medicube.us/products/pdrn-pink-collagen-gel-mask?variant=41799857602608",
    "inci": "Water, Glycerin, Methylpropanediol, Acrylates/Ethylhexyl Acrylate Copolymer, Niacinamide, Chondrus Crispus Powder, 1,2-Hexanediol, Butylene Glycol, Betaine, Ceratonia Siliqua (Carob) Gum, Hydroxyacetophenone, Allantoin, Glucomannan, Xanthan Gum, Laureth-21, Panthenol, Polyglyceryl-10 Laurate, Propanediol, Cellulose Gum, Cyamopsis Tetragonoloba (Guar) Gum, Fragrance (Parfum), Potassium Chloride, Dextrin, Adenosine, Ethylhexylglycerin, Hydrolyzed Collagen, Cyanocobalamin, Ascorbic Acid, Sodium DNA, Tocopherol, Acetyl Hexapeptide-8, Ascorbic Acid Polypeptide, Acetyl Octapeptide-3, Acetyl Tetrapeptide-2, Acetyl Tetrapeptide-3, Acetyl Tetrapeptide-5, Acetyl Tetrapeptide-9, Carnosine, Copper Tripeptide-1, Nonapeptide-1, Palmitoyl Pentapeptide-4, Palmitoyl Tripeptide-1, Palmitoyl Tripeptide-5",
    "checked": "2026-11-27"
  },
  "KG-MED-EXO7500-30ML": {
    "name": "Medicube One Day Exosome Shot 7500",
    "source": "https://medicube.us/products/exosome-shot",
    "inci": "Water, Dipropylene Glycol, Glycerin, Butylene Glycol, 1,2-Hexanediol, Niacinamide, Sodium Polyacrylate, Ethylhexyl Palmitate, Hydrolyzed Sponge, C12-14 Alketh-12, Hydrogenated Polydecene, Ethylhexylglycerin, Adenosine, Caprylyl/Capryl Glucoside, Disodium EDTA, Panthenol, Calcium Silicate, Lactobacillus Extracellular Vesicles, Campsis Grandiflora Flower Extract, Pueraria Lobata Root Extract, Pinus Palustris Leaf Extract, Oenothera Biennis (Evening Primrose) Flower Extract, Ulmus Davidiana Root Extract, Sodium Silicate, Betaine Salicylate, Citric Acid, Gluconolactone, Milk Exosomes",
    "checked": "2026-11-27"
  },
  "KG-MED-ZEROPAD2-70P": {
    "name": "Medicube Zero Pore Pad 2.0",
    "source": "https://medicube.us/products/subscr-zero-pore-pads",
    "inci": "Water, Methylpropanediol, Trometamin, Lactic Acid, Alcohol Denat., 1,2-Hexanediol, Panthenol, Glycereth-26, Salicylic Acid, Ammonium Acryloyldimethyltaurate/VP Copolymer, Betaine, Trehalose, Polyglyceryl-10 Laurate, Ethylhexylglycerin, Glycerin, Allantoin, Polyglyceryl-10 Myristate, Disodium EDTA, Butylene Glycol, Sodium Hyaluronate, Betaine Salicylate, Citrus Aurantium Dulcis (Orange) Peel Oil, Citrus Limon (Lemon) Peel Oil, Citrus Grandis (Grapefruit) Peel Oil, Citrus Aurantium Bergamia (Bergamot) Fruit Oil, Rosmarinus Officinalis (Rosemary) Leaf Oil, Eucalyptus Globulus Leaf Oil, Lavandula Angustifolia (Lavender) Oil, Vitis Vinifera (Grape) Fruit Extract, Citrus Aurantifolia (Lime) Fruit Extract, Citrus Limon (Lemon) Fruit Extract, Pyrus Malus (Apple) Fruit Extract, Citrus Aurantium Dulcis (Orange) Fruit Extract, Ethyl Hexanediol, Centella Asiatica Extract, Slix Alba (Willow) Bark Extract, Origanum Vulgare Leaf Extract, Chamaecyparis Obtusa Leaf Extract, Lactobacillus/Soybean Ferment Extract, Cinnamomum Cassia Bark Extract, Scutellaria Baicalensis Root Extract, Portulaca Oleracea Extract, Oenothera Biennis (Evening Primrose) Flower Extract, Pinus Palustris Leaf Extract, Ulmus Davidiana Root Extract, Pueraria Lobata Root Extract, Limonene",
    "checked": "2026-11-27"
  },
  "KG-SK1-TBBTONER-210ML": {
    "name": "SKIN1004 Madagascar Centella Tone Brightening Boosting Toner",
    "source": "https://www.skin1004.com/products/skin1004-madagascar-centella-tone-brightening-boosting-toner",
    "inci": "Water, 1,2-Hexanediol, Niacinamide, Pentylene Glycol, Butylene Glycol, Glycerin, Propanediol, Centella Asiatica Extract, Xanthan Gum, Panthenol, Allantoin, Betaine, Ethylhexylglycerin, Xylitylglucoside, Anhydroxylitol, Disodium EDTA, Xylitol, Madecassoside, Glucose, Carica Papaya (Papaya) Fruit Extract, Pyrus Malus (Apple) Fruit Extract, Prunus Mume Fruit Extract, Vitis Vinifera (Grape) Fruit Extract, 3-O-Ethyl Ascorbic Acid, Caprylic/Capric Triglyceride",
    "checked": "2026-11-27"
  },
  "KG-SK1-TBCA-100ML": {
    "name": "SKIN1004 Madagascar Centella Tone Brightening Capsule Ampoule",
    "source": "https://www.skin1004.com/products/skin1004-madagascar-centella-tone-brightening-capsule-ampoule?variant=40788191314077",
    "inci": "Water, Butylene Glycol, Niacinamide, Glycerin, Tranexamic Acid, 1,2-Hexanediol, Betaine, Centella Asiatica Extract, Zea Mays (Corn) Starch, Xanthan Gum, Microcrystalline Cellulose, Mannitol, Panthenol, Pentylene Glycol, Ethylhexylglycerin, Hydroxyethylcellulose, Madecassoside, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Arginine, Hydrogenated Lecithin, Xylitylglucoside, Anhydroxylitol, Xylitol, Glucose, 3-O-Ethyl Ascorbic Acid, Lactobacillus Ferment",
    "checked": "2026-11-27"
  },
  "KG-SK1-LCOIL-200ML": {
    "name": "SKIN1004 Madagascar Centella Light Cleansing Oil",
    "source": "https://www.skin1004.com/products/skin1004-madagascar-centella-light-cleansing-oil",
    "inci": "Ethylhexyl Stearate, Cetyl Ethylhexanoate, Sorbeth-30 Tetraoleate, Caprylic/Capric Triglyceride, Citrus Aurantium Bergamia (Bergamot) Fruit Oil, Centella Asiatica Extract, Simmondsia Chinensis (Jojoba) Seed Oil, Olea Europaea (Olive) Fruit Oil, Helianthus Annuus (Sunflower) Seed Oil, Ethylhexylglycerin, Pelargonium Graveolens Flower Oil, Rosa Damascena Flower Oil, Limonene, Linalool",
    "checked": "2026-11-27"
  },
  "KG-BOJ-GPRC-100ML": {
    "name": "Beauty of Joseon Green Plum Refreshing Cleanser",
    "source": "https://beautyofjoseon.com/products/green-plum-refreshing-cleanser",
    "inci": "Water, Prunus Mume Fruit Water, Cocamidopropyl Hydroxysultaine, Sodium Cocoyl Isethionate, Glycerin, Sodium Chloride, 1,2-Hexanediol, Hydroxyacetophenone, Coconut Acid, Caprylyl Glycol, Ethylhexylglycerin, Citric Acid, Disodium EDTA, Phaseolus Radiatus Seed Extract, Sodium Isethionate, Guar Hydroxypropyltrimonium Chloride, Dextrin, Melia Azadirachta Leaf Extract, Melia Azadirachta Flower Extract, Gardenia Florida Fruit Extract, Propylene Glycol Laurate, Sodium Citrate, Butylene Glycol, Camellia Sinensis Leaf Extract, Houttuynia Cordata Extract, Nelumbo Nucifera Flower Extract, Oryza Sativa (Rice) Extract, Prunus Mume Fruit Extract, Vaccinium Angustifolium (Blueberry) Fruit Extract",
    "checked": "2026-11-27"
  },
  "KG-BOJ-RSAF-50ML": {
    "name": "Beauty of Joseon Relief Sun Aqua-Fresh: Rice + B5",
    "source": "https://beautyofjoseon.com/products/relief-sun-aqua-fresh?country=MY&currency=MYR&variant=51813142692212",
    "inci": "Aqua, Oryza Sativa (Rice) Seed Water, Dibutyl Adipate, Butyloctyl Salicylate, Ethylhexyl Triazone, Polyglyceryl-3 Distearate, Drometrizole Trisiloxane, Terephthalylidene Dicamphor Sulfonic Acid, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Polymethylsilsesquioxane, Tromethamine, 1,2-Hexanediol, Panthenol, Pentylene Glycol, Glyceryl Stearate, Caprylyl Methicone, Silica, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Propanediol, Potassium Cetyl Phosphate, Poly C10-30 Alkyl Acrylate, Methylpropanediol, Carbomer, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Ethylhexylglycerin, Xanthan Gum, Glycerin, Polyether-1, Avena Sativa (Oat) Kernel Extract, Cynara Scolymus (Artichoke) Leaf Extract, Polyquaternium-51, Camellia Sinensis Leaf Water, Hydrogenated Lecithin, Beta-Glucan, Inositol, Tocopherol, Biosaccharide Gum-1, Ferulic Acid, Oryza Sativa (Rice) Bran Oil, Citric Acid, Ceramide NP, Phytosphingosine, Sodium Hyaluronate, Rice Amino Acids, Rice Sh-Oligopeptide-1",
    "checked": "2026-11-27"
  },
  "KG-CEL-RETBOOST-15ML": {
    "name": "Celimax Retinal Shot Tightening Booster",
    "source": "https://celimax.com/es/products/celimax-the-vita-a-retinal-shot-tightening-booster-15ml",
    "inci": "Water, Butylene Glycol, Glycerin, Caprylic/Capric Triglyceride, Cetearyl Alcohol, Niacinamide, Diisostearyl Malate, 1,2-Hexanediol, Polypropylsilsesquioxane, Panthenol, Cetearyl Olivate, Cetearyl Glucoside, Sorbitan Olivate, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Lecithin, Carbomer, Arginine, Dimethicone/Vinyl Dimethicone Crosspolymer, Tocopherol, Retinal, Xanthan Gum, Ethylhexylglycerin, Adenosine, Sorbitan Isostearate, Sodium Lactate, Hydrolyzed Sponge, Disodium EDTA, Polysorbate 20, Ascorbic Acid, Glucose, Palmitoyl Tripeptide-1, Palmitoyl Tetrapeptide-7",
    "checked": "2026-11-27"
  },
  "KG-PUR-TXA6NI10RET-30ML": {
    "name": "Purito Seoul TXA 6 Niacinamide 10 Retinal Serum",
    "source": "https://purito.com/product/txa-6-niacinamide-10-retinal-serum/",
    "inci": "Water, Niacinamide(10%), Tranexamic Acid(6%), Glycerin, Caprylic/Capric Triglyceride, 1,2-Hexanediol, Methylpropanediol, Pentylene Glycol, PVP, Ammonium Acryloyldimethyltaurate/Vp Copolymer, Butylene Glycol, Agar, Gellan Gum, Ethylhexylglycerin, Sodium Citrate, Hydroxyacetophenone, Citric Acid, Hydroxydecyl Ubiquinone, Adenosine, Lactococcus Ferment Lysate, Hydrogenated Lecithin, Centella Asiatica Extract, Ficus Carica (Fig) Fruit Extract, Fructooligosaccharides, Cyanocobalamin, Xanthan Gum, Retinal(25 ppm), Ceramide NP, Arginine, Tocopherol, Glutathione, Bisabolol, Helianthus Annuus (Sunflower) Seed Oil, Allantoin, Xanthophylls, Sodium Chloride, Phenylpropanol, Levulinic Acid, Sodium Levulinate",
    "checked": "2026-11-27"
  },
  "KG-BIO-BCOLL-DEEP-34G": {
    "name": "Biodance Bio-Collagen Real Deep Mask",
    "source": "https://biodance.com/products/biodance-bio-collagen-real-deep-mask",
    "inci": "Water, Glycerin, Acrylates Copolymer, Niacinamide, Ceratonia Siliqua (Carob) Gum, Chondrus Crispus Extract, Dipropylene Glycol, Betaine, Algin, Agar, Hydroxyacetophenone, 1,2-Hexanediol, Potassium Chloride, Caprylyl Glycol, Sucrose, Allantoin, Polyglyceryl-10 Laurate, Ethylhexylglycerin, Galactomyces Ferment Filtrate, Adenosine, Disodium EDTA, Pyrus Communis (Pear) Fruit Extract, Rosa Damascena Flower Water, Collagen Extract, Iris Florentina Root Extract, Cucumis Melo (Melon) Fruit Extract, Hedera Helix (Ivy) Leaf/Stem Extract, Butylene Glycol, Dipotassium Glycyrrhizate, Hydrolyzed Hyaluronic Acid, Lactobacillus Ferment, Bifida Ferment Filtrate, Lactobacillus Ferment Lysate, Tocopherol",
    "checked": "2026-11-27"
  },
  "KG-ANU-PDRNGLOW-60P": {
    "name": "Anua PDRN 100 Hyaluronic Acid Glow Pad",
    "source": "https://anua.com/products/pdrn-100-hyaluronic-acid-glow-pad",
    "inci": "Water, Butylene Glycol, Glycereth-26, Niacinamide, Glycerin, Hydroxyethyl Urea, 1,2-Hexanediol, Hydrolyzed Collagen, Terminalia Ferdinandiana Fruit Extract, Diethoxyethyl Succinate, Hydroxyacetophenone, Glycosyl Trehalose, Hydrogenated Starch Hydrolysate, Melia Azadirachta Leaf Extract, Melia Azadirachta Flower Extract, Coccinia Indica Fruit Extract, Aloe Barbadensis Flower Extract, Solanum Melongena (Eggplant) Fruit Extract, Ocimum Sanctum Leaf Extract, Corallina Officinalis Extract, Curcuma Longa (Turmeric) Root Extract, Glycereth-25 PCA Isostearate, Propanediol, Hyaluronic Acid, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate, Zea Mays (Corn) Kernel Extract, Fructan, Glucose, Ethylhexylglycerin, Xanthan Gum, Adenosine, Coptis Japonica Root Extract, Collagen Extract, Sodium DNA, Disodium EDTA, Lecithin, Acetyl Glutamine, Bacillus/Soybean Ferment Extract, Caprylyl Glycol, Folic Acid, Hexapeptide-11, Oligopeptide-1, Oligopeptide-2, Oligopeptide-3",
    "checked": "2026-11-27"
  },
  "KG-APR-TXA99-WRAP-80ML": {
    "name": "APRILSKIN TXA Niacinamide 99 Night Wrapping Mask",
    "source": "https://aprilskin.us/products/txa-niacinamide-99-overnight-wrapping-mask",
    "inci": "Water, Glycerin, Glycereth-26, Polyvinyl Alcohol, Niacinamide(50,000 ppm), Tranexamic Acid(10,000 ppm), Benzyl Glycol, Xanthan Gum, Algin, C12-14 Alketh-12, Allantoin, Ethylhexylglycerin, Cyanocobalamin, Disodium EDTA, Rosa Damascena Flower Oil, 1,2-Hexanediol, Butylene Glycol, Magnolia Officinalis Bark Extract, Sodium Hyaluronate, Ascorbic Acid, Caprylic/Capric Triglyceride, Hydroxyethylcellulose, Hydroxypropyltrimonium Hyaluronate, Mannitol, Sodium Thiosulfate, Hydrogenated Lecithin, Sodium Acetylated Hyaluronate, Hydrolyzed Hyaluronic Acid, Collagen, Ceramide NP, Hyaluronic Acid, Polysorbate 80, Sodium Hyaluronate Crosspolymer, Hydrolyzed Sodium Hyaluronate, Arginine/Lysine Polypeptide, Potassium Hyaluronate",
    "checked": "2026-11-27"
  },
  "KG-VT-RS300-50ML": {
    "name": "VT Reedle Shot 300",
    "source": "https://globalvt-cosmetics.com/products/vt-reedle-shot-300",
    "inci": "Water, Dipropylene Glycol, Glycerin, Niacinamide, Butylene Glycol, Macadamia Ternifolia Seed Oil, 1,2-Hexanediol, Ethylhexyl Palmitate, Silica, Sodium Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Polyisobutene, Glycereth-26, Ethylhexylglycerin, Caprylyl Glycol, Adenosine, Sodium Polyacrylate, Centella Asiatica Extract, Sodium Hyaluronate, Caprylyl/Capryl Glucoside, Sorbitan Oleate, Xanthan Gum, Propolis Extract, Asiaticoside, Madecassoside, Madecassic Acid, Asiatic Acid, Glycine, Serine, Glutamic Acid, Aspartic Acid, Leucine, Alanine, Lysine, Arginine, Tyrosine, Phenylalanine, Threonine, Proline, Valine, Isoleucine, Histidine, Methionine, Cysteine",
    "checked": "2026-11-27"
  },
  "KG-ARE-PDRNBOOST-30ML": {
    "name": "Arencia PDRN Booster Shot",
    "source": "https://arencia.us/products/pdrn-booster-shot-rosy-pdrn-peptides-for-glowy-healthy-skin",
    "inci": "Water, Glycerin, Methylpropanediol, Butylene Glycol, Propanediol, Niacinamide, Polyglycerin-3, Caprylic/Capric Triglyceride, Cetyl Ethylhexanoate, Hydrogenated Polydecene, 1,2-Hexanediol, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Arginine, Cetearyl Olivate, Hydroxyacetophenone, Sodium Polyacrylate, Sorbitan Olivate, Coptis Japonica Root Extract, Ethylhexylglycerin, Xanthan Gum, Adenosine, Disodium EDTA, Glyceryl Acrylate/Acrylic Acid Copolymer, Cyanocobalamin, Hydrolyzed Gardenia Florida Extract, Hydrolyzed Malt Extract, Hydrolyzed Viola Tricolor Extract, Sodium DNA, Panthenol, Glyceryl Glucoside, Sodium Hyaluronate, Hydrolyzed Hyaluronic Acid, Hyaluronic Acid, Citrullus Lanatus (Watermelon) Fruit Extract, Ceramide NP, Hydrogenated Lecithin, Collagen, Hydroxypropyltrimonium Hyaluronate, Acetyl Hexapeptide-8, Copper Tripeptide-1, Dipeptide Diaminobutyroyl Benzylamide Diacetate, Hexapeptide-9, Nonapeptide-1, Palmitoyl Hexapeptide-12, Palmitoyl Pentapeptide-4, Palmitoyl Tetrapeptide-7, Palmitoyl Tripeptide-1, Palmitoyl Tripeptide-5, Pentapeptide-3, Tripeptide-1, Sodium Acetylated Hyaluronate, Hydrolyzed Sodium Hyaluronate, Sodium Hyaluronate Crosspolymer, Potassium Hyaluronate",
    "checked": "2026-11-27"
  }
});
 function mount(target,p,opts={}){
  if(!target||!p)return;
  target.querySelector('.kg-product-extras')?.remove();
  const section=el('section','','kg-product-extras');target.append(section);
  const info=el('div','','kg-extra-panel');info.append(el('h3','Composição e cuidados'));
  const verified=officialIngredients[p.sku];
  const official=verified&&String(p.name||'').startsWith(verified.name)?verified:null;
  if(official){
   const list=el('details','','kg-official-inci');list.append(el('summary','Lista de ingredientes (INCI)'));
   list.append(el('p',official.inci));info.append(list);
   const source=el('a','Fonte: fabricante oficial');source.href=official.source;source.target='_blank';source.rel='noopener noreferrer';info.append(source);
   info.append(el('p','Composição informada pelo fabricante, consultada em 27/11/2026. A fórmula pode variar por mercado, lote ou reformulação. Confira o rótulo da unidade recebida antes de usar.'));
  }else{
   const inci=String(p.inci||'').trim()||(/(?:^|\n)\s*(?:INCI|Lista de ingredientes)\s*:\s*([^\n]+)/i.exec(p.description||'')?.[1]||'').trim();
   info.append(el('p',inci||'A lista completa de ingredientes ainda não está disponível nesta página. Consulte a embalagem ou solicite a composição à equipe antes da compra.'));
  }
  const contact=el('a','Consultar composição com a Kaia');contact.href='https://wa.me/5511965677152?text='+encodeURIComponent('Olá! Gostaria de confirmar a lista completa de ingredientes de '+p.name+'.');contact.target='_blank';contact.rel='noopener noreferrer';const contactRow=el('p');contactRow.append(contact);info.append(contactRow);section.append(info);
  if(opts.quote&&p.sku){
   const shipping=el('div','','kg-extra-panel'),form=el('form','','kg-product-quote'),label=el('label','Calcular frete pelo CEP'),input=el('input'),button=el('button','Calcular'),status=el('p','Estimativa para o produto. O valor final é confirmado na sacola.','kg-extra-status'),results=el('ul');
   input.inputMode='numeric';input.autocomplete='postal-code';input.placeholder='00000-000';input.maxLength=9;input.required=true;label.append(input);button.type='submit';form.append(label,button);status.setAttribute('role','status');shipping.append(form,status,results);section.append(shipping);
   form.addEventListener('submit',async e=>{e.preventDefault();const cep=input.value.replace(/\D/g,'');results.replaceChildren();if(cep.length!==8){status.textContent='Informe um CEP válido com 8 números.';return;}button.disabled=true;status.textContent='Consultando transportadoras…';
    try{const r=await fetch('/api/kaia/frete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({destinoCep:cep,items:[{sku:p.sku,quantity:Math.max(1,Math.min(10,Number(opts.quantity?.()||1)))}]}),signal:AbortSignal.timeout(20000)});const data=await r.json();
     if(!r.ok)throw Error(data.message||'Frete indisponível.');
     const choices=(data.opcoes||[]).filter(x=>Number.isSafeInteger(x.freteCentavos)&&x.freteCentavos>0);status.textContent=choices.length?'Valores estimados; confirme o total na sacola.':'Nenhuma modalidade encontrada.';
     for(const x of choices)results.append(el('li',[x.transportadora,x.servico].filter(Boolean).join(' · ')+' — '+money(x.freteCentavos)+' · '+x.previsaoDias+' dias estimados'));
    }catch(e){status.textContent=e.message||'Não foi possível calcular o frete.';}finally{button.disabled=false;}
   });
  }
  if(p.sku){
   const reviews=el('div','','kg-extra-panel'),heading=el('h3','Avaliações de clientes'),summary=el('p','Consultando avaliações…'),form=el('form','','kg-rating-form'),label=el('label','Sua nota'),select=el('select'),submit=el('button','Avaliar'),status=el('p','','kg-extra-status');
   status.setAttribute('role','status');select.required=true;for(let i=5;i>=1;i--){const option=el('option',i+' de 5 estrelas');option.value=String(i);select.append(option);}label.append(select);submit.type='submit';form.append(label,submit);reviews.append(heading,summary,el('p','Somente clientes com pedido pago e entregue podem avaliar.'),form,status);section.append(reviews);
   function show(data){summary.textContent=data.count>0?Number(data.average).toLocaleString('pt-BR')+' de 5 · '+data.count+(data.count===1?' avaliação verificada':' avaliações verificadas'):'Ainda não há avaliações verificadas.';}
   fetch('/api/kaia/product-ratings?sku='+encodeURIComponent(p.sku),{signal:AbortSignal.timeout(8000)}).then(async r=>{if(!r.ok)throw Error();show(await r.json());}).catch(()=>{summary.textContent='Avaliações temporariamente indisponíveis.';});
   form.addEventListener('submit',async e=>{e.preventDefault();let token;try{token=JSON.parse(localStorage.getItem('kaia-glow-auth-v1')||'null')?.access_token;}catch{}
    if(!token){status.replaceChildren(el('span','Entre na sua conta para avaliar. '));const link=el('a','Minha conta');link.href='/conta.html';status.append(link);return;}
    submit.disabled=true;status.textContent='Verificando sua compra…';try{const r=await fetch('/api/kaia/product-ratings',{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({sku:p.sku,rating:Number(select.value)}),signal:AbortSignal.timeout(12000)});const data=await r.json();
     if(!r.ok){status.textContent=data.code==='COMPRA_NAO_VERIFICADA'?'Só é possível avaliar após receber um pedido deste produto.':r.status===401?'Entre novamente na sua conta.':'Não foi possível registrar sua avaliação.';return;}show(data);status.textContent='Avaliação registrada. Obrigado!';
    }catch{status.textContent='Não foi possível registrar sua avaliação.';}finally{submit.disabled=false;}
   });
  }
 }
 window.KaiaProductExtras={mount};
})();