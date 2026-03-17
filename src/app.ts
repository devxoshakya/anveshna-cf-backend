import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { fetchAnilistInfo } from "./utils/methods";
import { HIANIME_BASEURL } from "./utils/constant";
import { HiAnime } from "aniwatch";
import { RequestHandler, corsHeaders } from "./handler/request";

const app = new Hono();
const hianime = new HiAnime.Scraper();

// CORS middleware for all routes
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204, corsHeaders);
  }
  await next();
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  c.header("Access-Control-Max-Age", "3600");
});

app.get("/", async (c) => {
  return c.json({
    about: `This API maps anilist anime to ${HIANIME_BASEURL} and also returns the M3U8 links !`,
    status: 200,
    routes: [
      "/anime/info/:anilistId",
      "/anime/servers/:episodeId",
      "/anime/servers/:episodeId?ep={episode_number_id}",
      "/anime/sources?episodeId={episode_id}&server={server_name}&category={sub|dub}",
      "/fetch?url={target_url}",
    ],
  });
});

app.get("/anime/info/:id", async (c) => {
  const id = c.req.param("id");
  const data = await fetchAnilistInfo(Number(id));
  if (!data) {
    throw new HTTPException(500, { message: "Internal server issue !" });
  }
  return c.json({ data });
});

app.get("/anime/servers/:episodeId", async (c) => {
  const episodeId = c.req.param("episodeId");
  const ep = c.req.query("ep");
  const fullEpisodeId = ep ? `${episodeId}?ep=${ep}` : episodeId;
  try {
    const data = await hianime.getEpisodeServers(fullEpisodeId);
    return c.json({ data });
  } catch {
    throw new HTTPException(500, { message: "Internal server issue !" });
  }
});

app.get("/anime/sources", async (c) => {
  const { episodeId, server, category } = c.req.query();
  if (!episodeId) {
    throw new HTTPException(400, { message: "Provide episodeId !" });
  }
  try {
    const data = await hianime.getEpisodeSources(
      episodeId,
      (server as HiAnime.AnimeServers | undefined) ?? "hd-2",
      (category as "sub" | "dub" | "raw") ?? "sub"
    );
    return c.json({ data });
  } catch {
    throw new HTTPException(500, { message: "Internal server issue !" });
  }
});

app.get("/fetch", async (c) => {
  return RequestHandler({ response: c.req });
});

export default app;
