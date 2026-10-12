// Deterministic real route handlers without external AI credentials. For local E2E only.
import http from 'node:http';
import {handle} from '../worker/ai.js';
const port=Number(process.env.KOS_E2E_API_PORT || 8795);
http.createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=Buffer.concat(chunks);
  try {
    const request=new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:req.headers,...(body.length?{body}: {})});
    const response=req.url.startsWith('/api/ai/')?await handle(request,{}):new Response(JSON.stringify({error:'offline fixture'}),{status:503,headers:{'content-type':'application/json'}});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(e){res.writeHead(500);res.end(String(e));}
}).listen(port,'127.0.0.1',()=>console.log(`Offline E2E API: http://127.0.0.1:${port}`));
