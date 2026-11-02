export const digits = value => String(value||'').replace(/\D/g,'');
export function validCpf(value){const cpf=digits(value);if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))return false;for(let step=9;step<11;step++){let sum=0;for(let i=0;i<step;i++)sum+=Number(cpf[i])*(step+1-i);let d=(sum*10)%11;if(d===10)d=0;if(d!==Number(cpf[step]))return false;}return true;}
export function validateCustomer(d,today=new Date().toISOString().slice(0,10)){
 if(!/^\S+\s+\S+/.test(d.full_name.trim()))return 'Informe seu nome completo, com sobrenome.';
 if(!validCpf(d.cpf))return 'Confira o CPF: os dígitos informados não são válidos.';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.birth_date)||d.birth_date<'1900-01-01'||d.birth_date>today)return 'Informe uma data de nascimento válida.';
 if(!/^[1-9]\d{9,10}$/.test(d.phone))return 'Informe seu telefone com DDD (10 ou 11 dígitos).';
 if(!/^\d{8}$/.test(d.postal_code))return 'Informe um CEP com 8 dígitos.';
 for(const [key,label] of [['street','a rua'],['neighborhood','o bairro'],['city','a cidade']])if(d[key].trim().length<2)return 'Informe '+label+' do endereço.';
 if(!d.street_number.trim())return 'Informe o número do endereço ou S/N.';
 if(!'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').includes(d.state))return 'Selecione o estado do endereço.';
 return '';
}
