import {readFileSync} from 'node:fs';
export function automaticNewsEnabled(){
  try{return JSON.parse(readFileSync(new URL('./editorial-policy.json',import.meta.url),'utf8')).automaticNewsPublication===true;}
  catch{return false;}
}
