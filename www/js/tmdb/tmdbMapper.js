// js/tmdb/tmdbMapper.js

export const TMDBMapper = {
  mapMovie: (data) => ({
    id: data.id,
    title: data.title,
    poster: `https://image.tmdb.org/t/p/w500${data.poster_path}`,
    overview: data.overview,
    rating: data.vote_average
  }),

  mapSeries: (data) => ({
    id: data.id,
    name: data.name,
    poster: `https://image.tmdb.org/t/p/w500${data.poster_path}`,
    seasons: data.seasons,
    overview: data.overview
  })
};
