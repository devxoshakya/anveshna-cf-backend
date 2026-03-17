import { serve } from "@hono/node-server";
import app from "./app";

serve({
  port: Number(process.env.PORT) || 5000,
  fetch: app.fetch,
});
