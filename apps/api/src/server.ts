import { buildApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./lib/db.js";
import { vinQueue } from "./lib/queue.js";
import { redis } from "./lib/redis.js";

const app = await buildApp();
await app.listen({ host: "0.0.0.0", port: config.PORT });

// Graceful shutdown: finish in-flight requests, then close connections.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    await vinQueue.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}
