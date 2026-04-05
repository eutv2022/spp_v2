// js/tmdb/tmdbApi.js
import { fetchFromTMDB } from '../apiModule.js';

export const TMDB = {
  getMovieDetails: async (id) => {
    return await fetchFromTMDB(`/movie/${id}`);
  },

  getSeriesDetails: async (id) => {
    return await fetchFromTMDB(`/tv/${id}`);
  },

  search: async (query) => {
    return await fetchFromTMDB(`/search/multi&query=${encodeURIComponent(query)}`);
  }
};
