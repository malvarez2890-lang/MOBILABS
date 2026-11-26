import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './': las rutas son relativas, así el mismo build funciona en la raíz de un dominio y en una subcarpeta (GitHub Pages).
export default defineConfig({ base: './', plugins: [react()] });
