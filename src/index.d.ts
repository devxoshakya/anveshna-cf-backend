interface Title {
  english: string;
  romaji: string;
  native: string;
  userPreferred: string;
};

interface AnilistAnime {
  Media: {
    id: number;
    idMal: number;
    synonyms: string[];
    isLicensed: boolean;
    isAdult: boolean;
    title: {
      romaji: string;
      english: string;
      native: string;
      userPreferred: string;
    };
    coverImage: {
      extraLarge: string;
      large: string;
      medium: string;
      color: string;
    };
    format: string;
    description: string;
    genres: string[];
    season: string;
    episodes: number;
    nextAiringEpisode: {
      id: number;
      timeUntilAiring: number;
      airingAt: number;
      episode: number;
    };
    status: string;
    duration: number;
    seasonYear: number;
    bannerImage: string;
    favourites: number;
    popularity: number;
    averageScore: number;
    trailer: {
      id: string;
      site: string;
      thumbnail: string;
    };
    startDate: {
      year: number;
      month: number;
      day: number;
    };
    endDate: {
      year: number | null;
      month: number | null;
      day: number | null;
    };
    countryOfOrigin: string;
    studios: {
      nodes: {
        name: string;
      }[];
    };
    recommendations: {
      edges: {
        node: {
          mediaRecommendation: {
            id: number;
            idMal: number;
            title: {
              romaji: string;
              english: string;
              native: string;
              userPreferred: string;
            };
            status: string;
            episodes: number | null;
            bannerImage: string;
            averageScore: number;
            format: string;
            coverImage: {
              extraLarge: string;
              large: string;
              medium: string;
              color: string;
            };
          };
        };
      }[];
    };
    relations: {
      edges: {
        id: number;
        relationType: string;
        node: {
          id: number;
          idMal: number;
          title: {
            romaji: string;
            english: string;
            native: string;
            userPreferred: string;
          };
          status: string;
          episodes: number | null;
          bannerImage: string;
          averageScore: number;
          format: string;
          coverImage: {
            extraLarge: string;
            large: string;
            medium: string;
            color: string;
          };
        };
      }[];
    };
    characters: {
      edges: {
        role: string;
        node: {
          id: number;
          name: {
            first: string;
            middle: string;
            last: string;
            full: string;
            native: string;
            userPreferred: string;
          };
          image: {
            large: string;
            medium: string;
          };
        };
        voiceActors: {
          id: number;
          languageV2: string;
          name: {
            first: string;
            middle: string;
            last: string;
            full: string;
            native: string;
            userPreferred: string;
          };
          image: {
            large: string;
            medium: string;
          };
        }[];
      }[];
    };
  };
};

interface Sourcedata {
  intro: {
    start: number;
    end: number;
  };
  outro: {
    start: number;
    end: number;
  };
  sources: {
    url: string;
    type: string;
    isM3U8: boolean;
  }[];
  tracks: {
    file: string;
    kind: string;
    label?: string;
    default?: boolean;
  }[];
  server: number;
};
