// Optional developer preview. Recipients open the HTML file directly.
import http from 'node:http';import fs from 'node:fs';
http.createServer((req,res)=>{if(req.url!=='/'&&req.url!=='/index.html'){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(fs.readFileSync('dist/index.html'))}).listen(4174,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4174'));

