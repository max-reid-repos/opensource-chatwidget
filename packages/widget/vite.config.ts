import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ChatWidget',
      fileName: (format) => `chat-widget.${format}.js`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      output: {
        assetFileNames: 'style.[ext]'
      }
    },
    minify: 'esbuild',
    sourcemap: true
  }
});
