import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
http.createServer(async(req,res)=>{
  try {
    const url = new URL(req.url,'http://localhost');
    const p = path.resolve(root,'.'+decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if(!p.startsWith(root+path.sep)){res.writeHead(403).end(); return;}
    const body = await readFile(p);
    res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(body);
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Không tìm thấy trang.');}
}).listen(port,process.argv.includes('--preview')?'0.0.0.0':'127.0.0.1',()=>console.log(`Pigeon Flight Lab: http://localhost:${port}`));
