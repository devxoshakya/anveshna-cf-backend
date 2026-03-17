import { client } from "./client";
import { ANILIST_BASEURL, ANIME_QUERY, HIANIME_BASEURL } from "./constant";
import { HiAnime } from "aniwatch";
import match from "string-similarity-js";

const hianime = new HiAnime.Scraper();

// fetchAnilistInfo and call hianmie endpoints and return info with eps from hianime
export const fetchAnilistInfo = async (id: number) => {
  try {
    let infoWithEp;

    const resp = await client.post<any, { data: { data: AnilistAnime } }>(
      ANILIST_BASEURL,
      {
        query: ANIME_QUERY,
        variables: {
          id,
        },
      }
    );
    const data = resp.data.data.Media;

    const eps = await searchNScrapeEPs(data.title);
    infoWithEp = {
      ...data,
      recommendations: data.recommendations.edges.map((el) => {
        const recommendation = el.node.mediaRecommendation;
        return {
          id: recommendation.id,
          malId: recommendation.idMal,
          title: recommendation.title,
          status: recommendation.status,
          episodes: recommendation.episodes,
          image: recommendation.coverImage.extraLarge,
          imageHash: "hash",
          cover: recommendation.bannerImage,
          coverHash: "hash",
          rating: recommendation.averageScore,
          type: recommendation.format,
        };
      }),
      relations: data.relations.edges.map((el) => {
        const relation = el.node;
        return {
          id: relation.id,
          relationType: el.relationType,
          malId: relation.idMal,
          title: relation.title,
          status: relation.status,
          episodes: relation.episodes,
          image: relation.coverImage.extraLarge,
          imageHash: "hash",
          color: relation.coverImage.color,
          type: relation.format,
          cover: relation.bannerImage,
          coverHash: "hash",
          rating: relation.averageScore,
        };
      }),
      characters: data.characters.edges.map((el) => ({
        role: el.role,
        ...el.node,
        voiceActors: el.voiceActors,
      })),
      episodesList: eps,
    };

    return infoWithEp;
  } catch (err: any) {
    console.error(err);
    return null;
  }
};

// search with title in hianime and call ep scraping func
export const searchNScrapeEPs = async (searchTitle: Title) => {
  try {
    const searchQuery = searchTitle.romaji;
    const searchResults = await hianime.search(searchQuery);
    console.log("Search results for:", searchQuery, searchResults);

    if (!searchResults || !searchResults.animes || searchResults.animes.length === 0) {
      console.log("No results found for:", searchQuery);
      return null;
    }

    let similarTitles: { id: string; name: string; similarity: number }[] = [];
    
    searchResults.animes.forEach((anime) => {
      if (!anime.id || !anime.jname) return;
      
      const similarity = Number(
        (
          match(
            anime.jname.replace(/[\,\:]/g, ""),
            searchQuery
          ) * 10
        ).toFixed(2)
      );
      similarTitles.push({ id: anime.id, name: anime.jname, similarity });
    });

    similarTitles.sort((a, b) => b.similarity - a.similarity);

    const selectedAnime = similarTitles[0];
    if (!selectedAnime) {
      console.log("No matching anime found");
      return null;
    }

    return getEpisodes(selectedAnime.id);
  } catch (err) {
    console.error(err);
    return null;
  }
};

// calls ep watch endpoint in hianmie and returns episodes
export const getEpisodes = async (animeId: string) => {
  try {
    const episodesData = await hianime.getEpisodes(animeId);

    if (!episodesData || !episodesData.episodes) {
      console.log("No episodes found for animeId:", animeId);
      return null;
    }

    const episodesList: {
      id: string;
      episodeId: string;
      title: string;
      number: number;
    }[] = episodesData.episodes
      .filter((ep) => ep.episodeId)
      .map((ep) => ({
        id: ep.episodeId || "",
        episodeId: ep.episodeId || "",
        title: ep.title || "",
        number: ep.number,
      }));

    return episodesList;
  } catch (err) {
    console.error(err);
    return null;
  }
};


