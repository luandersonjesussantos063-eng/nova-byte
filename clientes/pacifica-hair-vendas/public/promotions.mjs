export function promotionalPrice(baseCents, discountPercent=0){
 if(!Number.isSafeInteger(baseCents)||baseCents<1||baseCents>100000000)throw Error("Informe um preço normal válido.");
 if(!Number.isInteger(discountPercent)||discountPercent<0||discountPercent>99)throw Error("O desconto deve ser um número inteiro de 0 a 99%.");
 const priceCents=Math.max(1,Math.round(baseCents*(100-discountPercent)/100));
 if(discountPercent&&priceCents>=baseCents)throw Error("O valor é muito baixo para aplicar esse desconto.");
 return {priceCents,compareCents:discountPercent?baseCents:0,discountPercent};
}
export function discountLabel(p){
 const old=Number(p.compareCents),price=Number(p.priceCents);
 if(!Number.isSafeInteger(old)||!Number.isSafeInteger(price)||price<1||old<=price)return 0;
 const n=p.discountPercent;
 if(Number.isInteger(n)&&n>=1&&n<=99&&Math.max(1,Math.round(old*(100-n)/100))===price)return n;
 return Math.min(99,Math.max(1,Math.round((old-price)*100/old)));
}
