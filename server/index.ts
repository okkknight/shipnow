import { loadEnv } from './env.js';
import { ShipNowStore } from './db.js';
import { ShipNowManager } from './shipnowManager.js';
import { createShipNowApp } from './app.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const store = new ShipNowStore(env.dbPath, env.publicStaticRoot);
  const manager = new ShipNowManager(store, env);
  await manager.initialize();
  const app = await createShipNowApp(manager, env, {
    serveUiShell: false,
    publicBaseUrl: env.publicBaseUrl,
    apiBaseUrl: env.shipnowApiBaseUrl,
    previewBaseUrl: env.previewBaseUrl,
  });

  const shutdown = async (): Promise<void> => {
    await manager.shutdown();
    await app.close();
    store.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  await app.listen({ port: env.port, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
