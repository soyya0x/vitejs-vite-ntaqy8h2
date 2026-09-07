import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function largeViewDataPlugin(): Plugin {
  const filename = 'LargeView_zoom_A.txt';

  return {
    name: 'largeview-data',

    configureServer(server) {
      server.middlewares.use(`/${filename}`, (_req, res) => {
        const filePath = path.resolve(process.cwd(), filename);

        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end('LargeView_zoom_A.txt not found');
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');

        fs.createReadStream(filePath).pipe(res);
      });
    },

    generateBundle() {
      const filePath = path.resolve(process.cwd(), filename);

      if (!fs.existsSync(filePath)) {
        this.error(`${filename} 파일을 찾을 수 없습니다.`);
      }

      const text = fs.readFileSync(filePath, 'utf-8');

      this.emitFile({
        type: 'asset',
        fileName: filename,
        source: text,
      });
    },
  };
}

export default defineConfig({
  plugins: [largeViewDataPlugin()],
});