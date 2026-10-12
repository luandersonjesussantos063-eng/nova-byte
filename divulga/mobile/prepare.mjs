import {cpSync,mkdirSync,rmSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname,resolve} from 'node:path';
const MOBILE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(MOBILE,'..');
const WWW=join(MOBILE,'www');
rmSync(WWW,{force:true,recursive:true});
mkdirSync(WWW,{recursive:true});
const files=['index.html','style.css','app.js','icon.svg','manifest.webmanifest','sw.js'];
for(const name of files){
 const source=join(ROOT,name);
 if(!existsSync(source))throw Error('Arquivo obrigatório não encontrado: '+name);
 cpSync(source,join(WWW,name));
}
let html=readFileSync(join(WWW,'index.html'),'utf8');
if(!html.includes('app.js?v=1.0.0'))throw Error('Versão do app não reconhecida.');
// O bridge do Capacitor identifica a versão nativa; os links externos são abertos fora do WebView.
html=html.replace('<script defer src="./app.js?v=1.0.0"></script>','<script defer src="./app.js?v=1.0.0"></script>');
writeFileSync(join(WWW,'index.html'),html);
console.log('NovaByte Divulga: recursos nativos preparados em',WWW);
