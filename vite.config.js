import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],
  build:{chunkSizeWarningLimit:2000},
  worker:{format:'es'},
  server:{proxy:{'/api':'http://127.0.0.1:8787'}},
});
