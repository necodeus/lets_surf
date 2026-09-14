import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({build:{rollupOptions:{input:{game:fileURLToPath(new URL('./index.html',import.meta.url)),bsp:fileURLToPath(new URL('./bsp.html',import.meta.url))}}}});
