import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// KOS_API lets a second checkout point its dev proxy at its own `wrangler dev` port.
const api=process.env.KOS_API||'127.0.0.1:8787';
export default defineConfig({
  plugins:[react()],
  build:{chunkSizeWarningLimit:2000},
  worker:{format:'es'},
  server:{proxy:{'/api':`http://${api}`,'/ws':{target:`ws://${api}`,ws:true}}},
});
