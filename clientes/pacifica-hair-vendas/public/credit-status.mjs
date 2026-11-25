// Dates are calendar dates of the store (Belo Horizonte, America/Sao_Paulo).
// A payment due today is not overdue until the next local calendar day.
export function storeToday(at=new Date()){
 return new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(at);
}
export function daysAfter(isoDate,days){
 const date=new Date(isoDate+"T12:00:00Z");date.setUTCDate(date.getUTCDate()+days);
 return date.toISOString().slice(0,10);
}
export function classifyCreditDue(dueDate,today=storeToday()){
 if(dueDate<today)return "Atrasado";
 if(dueDate===today)return "Vence hoje";
 if(dueDate<=daysAfter(today,7))return "A vencer";
 return "Em dia";
}
export function creditDueTotals(credits,today=storeToday()){
 let overdue=0,todayCents=0,soon=0;
 for(const c of credits){
  const cents=Number(c.balance_cents)||0;if(cents<=0)continue;
  const status=classifyCreditDue(c.due_date,today);
  if(status==="Atrasado")overdue+=cents;
  else if(status==="Vence hoje")todayCents+=cents;
  else if(status==="A vencer")soon+=cents;
 }
 return {overdue,todayCents,soon,soonIncludingToday:soon+todayCents};
}
