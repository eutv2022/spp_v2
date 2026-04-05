// js/repositories/CarouselRepository.js

import { DB } from '../db/db.js';
import { MoviesRepository } from './MoviesRepository.js';
import { SeriesRepository } from './SeriesRepository.js';
import { Logger } from '../../utils/logger.js';

export const CarouselRepository = {

  getCarouselItems: async () => {
    try {
      const items = await DB.get('home_carousel');
      if (Array.isArray(items) && items.length > 0) {
        return items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      }
      return [];
    } catch (e) { Logger.error("CarouselRepo: read cache fail", e); return []; }
  },

  generateAndSave: async () => {
    Logger.info("CarouselRepo: generating featured content...");    
    try {
        const [moviesRaw, seriesRaw] = await Promise.all([
            DB.get('movies'),
            DB.get('series')
        ]);

        const allMovies = Array.isArray(moviesRaw) ? moviesRaw : [];
        const allSeries = Array.isArray(seriesRaw) ? seriesRaw : [];
        const sortByDate = (a, b) => {
            const dateA = Number(a.last_modified || a.added || 0);
            const dateB = Number(b.last_modified || b.added || 0);
            return dateB - dateA;
        };

        const topMovies = allMovies.sort(sortByDate).slice(0, 6);
        const topSeries = allSeries.sort(sortByDate).slice(0, 6);
        const carouselItems = [];

        for (const m of topMovies) {
            let item = {
                uniqueId: `movie-${m.stream_id || m.i}`,
                type: 'movie',
                i: m.stream_id || m.i,
                tmi: m.tmdb_id || m.tmi,
                n: m.name || m.n || "Sin Título",
                p: m.stream_icon || m.p || "",
                e: m.container_extension || m.e || "",
                timestamp: Number(m.added || 0),
                plot: 'Cargando...',
                genre: '',
                releaseDate: ''
            };

            if (item.tmi) {
                try {
                    const details = await MoviesRepository.getMovieDetails(item.i, item.tmi);
                    if (details) {
                        item.plot = details.s || item.plot;
                        item.genre = details.g || item.genre;
                        item.releaseDate = details.t || '';
                    }
                } catch (e) {Logger.debug(`CarouselRepo: skip movie details ${item.i}`, e);}
            }
            carouselItems.push(item);
        }

        for (const s of topSeries) {
            let item = {
                uniqueId: `series-${s.series_id || s.i}`,
                type: 'series',
                i: s.series_id || s.i,
                tmi: s.tmdb_id || s.tmi,
                n: s.name || s.n || "Sin Título",
                p: s.cover || s.p || "",
                timestamp: Number(s.last_modified || 0),
                plot: 'Cargando...',
                genre: '',
                releaseDate: ''
            };

            try {
                const details = await SeriesRepository.getSeriesDetails(item.i);
                if (details) {
                    item.plot = details.s || item.plot;
                    item.genre = details.g || item.genre;
                    item.releaseDate = details.t || '';
                }
            } catch (e) {Logger.debug(`CarouselRepo: skip series details ${item.i}`, e);}
            carouselItems.push(item);
        }

        if (carouselItems.length > 0) {
            await DB.save('home_carousel', carouselItems);
            Logger.info(`CarouselRepo: saved ${carouselItems.length} featured items.`);
        }

    } catch (err) { Logger.error("CarouselRepo: gen fail", err); }
  }
};