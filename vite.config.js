import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths so the build works on a GitHub Pages project URL or a custom domain.
export default defineConfig({
  base: './',
  plugins: [react()],
});
