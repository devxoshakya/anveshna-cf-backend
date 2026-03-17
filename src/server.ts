import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { fetchAnilistInfo } from "./utils/methods";
import { HIANIME_BASEURL } from "./utils/constant";
import { HiAnime } from "aniwatch";
import { RequestHandler, corsHeaders } from "./handler/request";

const app = new Hono();
const hianime = new HiAnime.Scraper();

app.get("/", async (c) => {
  return c.json({
    about: `This API maps anilist anime to ${HIANIME_BASEURL} and also returns the M3U8 links !`,
    status: 200,
    routes: [
      "/anime/info/:anilistId",
      "/anime/servers/:episodeId",
      "/anime/sources?episodeId={episode_id}&server={server_name}&category={sub|dub}",
      "/fetch?url={target_url}",
    ],
  });
});

app.options("/fetch", (c) => {
  return c.body(null, 204, corsHeaders);
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
  } catch (err) {
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
  } catch (err) {
    throw new HTTPException(500, { message: "Internal server issue !" });
  }
});

app.get("/fetch", async (c) => {
  return RequestHandler({ response: c.req });
});

serve({
  port: Number(process.env.PORT) || 5000,
  fetch: app.fetch,
});
