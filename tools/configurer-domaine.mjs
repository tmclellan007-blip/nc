import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const argument=process.argv[2];
if(!argument)throw new Error('Usage : node tools/configurer-domaine.mjs https://votre-domaine.ca');
const url=new URL(argument);
if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Indiquez une origine HTTPS sans chemin, paramètres ou identifiants.');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const current=html.match(/<link rel="canonical" href="(https:\/\/[^/]+)\/">/);
if(!current)throw new Error('Origine actuelle introuvable.');
const origin=url.origin;
for(const name of ['index.html','robots.txt','sitemap.xml']){const file=path.join(root,name);fs.writeFileSync(file,fs.readFileSync(file,'utf8').split(current[1]).join(origin));}
console.log('Métadonnées, données structurées, robots et sitemap configurés pour '+origin);
