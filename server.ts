import path from 'path';
import express from 'express';
import { app } from './src/server/app';

const PORT = 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    // Bound to 0.0.0.0 so containers/LAN clients can reach it, but 0.0.0.0 is not
    // a routable address in a browser (it triggers ERR_ADDRESS_INVALID).
    // Always log the loopback URL the user should actually open.
    console.log(`Tamil-English Vocabulary Scroll server running on http://localhost:${PORT}`);
    console.log(`(bound to all interfaces on port ${PORT} — open http://localhost:${PORT} in your browser)`);
  });
}

startServer();

export default app;
export { app };
