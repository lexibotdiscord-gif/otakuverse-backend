import express from 'express';
import axios from 'axios';
import logger from '../utils/logger.js';

const router = express.Router();

// Cache per ricerche (30 minuti)
const searchCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000;

// Per tracciare l'ultima richiesta a Jikan e evitare rate limit
let lastJikanRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // 500ms tra richieste a Jikan

/**
 * Funzione di retry con exponential backoff per Jikan API
 */
const fetchWithRetry = async (url, config = {}, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Aspetta un minimo di intervallo tra richieste a Jikan
      const now = Date.now();
      const timeSinceLastRequest = now - lastJikanRequestTime;
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => 
          setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
        );
      }
      lastJikanRequestTime = Date.now();

      const response = await axios.get(url, {
        ...config,
        timeout: 10000
      });
      return response;
    } catch (error) {
      // Se è 429 (rate limit), retry con backoff
      if (error.response?.status === 429) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`⏰ Rate limit hit (429), retrying in ${delayMs}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // Per altri errori, retry solo se timeout or transient error
      if (attempt < maxRetries - 1 && 
          (error.code === 'ECONNABORTED' || error.code === 'ECONNRESET')) {
        const delayMs = Math.pow(2, attempt) * 500;
        console.log(`🔄 Transient error, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      // Se è l'ultimo tentativo, lancia l'errore
      throw error;
    }
  }
};

/**
 * Formatta i dati anime per il frontend
 */
const formatAnimeData = (anime) => {
  return {
    id: anime.mal_id,
    title: anime.title || anime.title_english || 'Unknown',
    titleEnglish: anime.title_english,
    titleJapanese: anime.title_japanese,
    type: 'ANIME',
    imageUrl: anime.images?.webp?.large_image_url || anime.images?.jpg?.large_image_url,
    score: anime.score || 0,
    scoredBy: anime.scored_by || 0,
    rank: anime.rank,
    popularity: anime.popularity,
    status: anime.status || 'Unknown', // FINISHED, CURRENTLY_AIRING, NOT_YET_AIRED
    aired: {
      from: anime.aired?.from,
      to: anime.aired?.to,
      year: anime.aired?.from ? new Date(anime.aired.from).getFullYear() : null
    },
    episodes: anime.episodes,
    nextEpisodeDate: anime.next_episode_date,
    source: anime.source, // Manga, Light Novel, Original, etc.
    genres: anime.genres?.map(g => g.name) || [],
    studios: anime.studios?.map(s => s.name) || [],
    synopsis: anime.synopsis?.substring(0, 300) || '',
    duration: anime.duration,
    rating: anime.rating, // PG, R, etc.
    season: anime.season, // fall, winter, spring, summer
    malUrl: anime.url,
    trailerUrl: anime.trailer?.url
  };
};

/**
 * Formatta i dati manga per il frontend
 */
const formatMangaData = (manga) => {
  return {
    id: manga.mal_id,
    title: manga.title || manga.title_english || 'Unknown',
    titleEnglish: manga.title_english,
    titleJapanese: manga.title_japanese,
    type: 'MANGA',
    imageUrl: manga.images?.webp?.large_image_url || manga.images?.jpg?.large_image_url,
    score: manga.score || 0,
    scoredBy: manga.scored_by || 0,
    rank: manga.rank,
    popularity: manga.popularity,
    status: manga.status || 'Unknown', // FINISHED, PUBLISHING, NOT_YET_PUBLISHED
    published: {
      from: manga.published?.from,
      to: manga.published?.to,
      year: manga.published?.from ? new Date(manga.published.from).getFullYear() : null
    },
    chapters: manga.chapters,
    volumes: manga.volumes,
    authors: manga.authors?.map(a => ({
      name: a.person?.name || a.name,
      role: a.role
    })) || [],
    genres: manga.genres?.map(g => g.name) || [],
    magazines: manga.serializations?.map(s => s.name) || [],
    synopsis: manga.synopsis?.substring(0, 300) || '',
    mangaType: manga.type, // Manga, Manhwa, Manhua, etc.
    malUrl: manga.url
  };
};

/**
 * GET /search?q=query&type=all&page=1&limit=10
 * Cerca sia anime che manga
 * type: 'all', 'anime', 'manga'
 */
router.get('/', async (req, res) => {
  try {
    const { q, type = 'all', page = 1, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        error: 'Query must be at least 2 characters',
        data: [],
        pagination: { page: 1, limit, total: 0, pages: 0 }
      });
    }

    const cacheKey = `${type}-${q.toLowerCase()}-${page}-${limit}`;
    const cachedResult = searchCache.get(cacheKey);
    
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_DURATION) {
      console.log(`✅ Using cached search for: "${q}" (type: ${type})`);
      return res.status(200).json(cachedResult.data);
    }

    console.log(`🔍 Searching ${type} for: "${q}" (page: ${page})`);

    let allResults = [];
    let dataType = type;

    // Cerca anime
    if (type === 'all' || type === 'anime') {
      try {
        const animeResponse = await fetchWithRetry('https://api.jikan.moe/v4/anime', {
          params: {
            q: q.trim(),
            limit: Math.min(limit, 25),
            page: parseInt(page)
          }
        });

        const animeData = (animeResponse.data?.data || []).map(formatAnimeData);
        allResults.push(...animeData);
      } catch (error) {
        console.error('❌ Anime search error:', error.message);
      }
    }

    // Cerca manga
    if (type === 'all' || type === 'manga') {
      try {
        const mangaResponse = await fetchWithRetry('https://api.jikan.moe/v4/manga', {
          params: {
            q: q.trim(),
            limit: Math.min(limit, 25),
            page: parseInt(page)
          }
        });

        const mangaData = (mangaResponse.data?.data || []).map(formatMangaData);
        allResults.push(...mangaData);
      } catch (error) {
        console.error('❌ Manga search error:', error.message);
      }
    }

    // Ordina per relevanza (score discendente)
    allResults.sort((a, b) => (b.score || 0) - (a.score || 0));

    const total = allResults.length;
    const totalPages = Math.ceil(total / limit);

    const paginatedResults = allResults.slice(
      (parseInt(page) - 1) * limit,
      parseInt(page) * limit
    );

    const response = {
      query: q,
      type: dataType,
      data: paginatedResults,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: totalPages
      }
    };

    // Cache il risultato
    searchCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    console.log(`✅ Found ${paginatedResults.length}/${total} results for "${q}"`);
    res.status(200).json(response);

  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({
      error: error.message,
      data: [],
      pagination: { page: 1, limit: 10, total: 0, pages: 0 }
    });
  }
});

/**
 * GET /search/anime?q=query&page=1&limit=10
 * Ricerca solo anime con filtri avanzati
 */
router.get('/anime', async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 10,
      status,
      type,
      genre,
      year,
      minScore,
      orderBy = 'score'
    } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        error: 'Query must be at least 2 characters',
        data: [],
        pagination: { page: 1, limit, total: 0, pages: 0 }
      });
    }

    console.log(`🔍 Advanced anime search: "${q}" (filters: status=${status}, type=${type}, genre=${genre}, year=${year})`);

    const params = {
      q: q.trim(),
      limit: Math.min(limit, 25),
      page: parseInt(page)
    };

    if (status) params.status = status; // FINISHED, CURRENTLY_AIRING, NOT_YET_AIRED
    if (type) params.type = type; // TV, MOVIE, OVA, SPECIAL, ONA, MUSIC
    if (genre) params.genres = genre;
    if (year) params.start_date = `${year}-01-01`;
    if (minScore) params.min_score = parseFloat(minScore);
    if (orderBy) params.order_by = orderBy; // score, title, airing, type, episodes, start_date

    const response = await fetchWithRetry('https://api.jikan.moe/v4/anime', {
      params
    });

    const animeData = (response.data?.data || []).map(formatAnimeData);

    const paginatedResults = animeData.slice(0, limit);
    const result = {
      query: q,
      type: 'ANIME',
      filters: { status, type, genre, year, minScore },
      data: paginatedResults,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: animeData.length,
        pages: Math.ceil(animeData.length / limit)
      }
    };

    console.log(`✅ Found ${paginatedResults.length} anime`);
    res.status(200).json(result);

  } catch (error) {
    logger.error('Anime search error:', error);
    res.status(500).json({
      error: error.message,
      data: [],
      pagination: { page: 1, limit: 10, total: 0, pages: 0 }
    });
  }
});

/**
 * GET /search/manga?q=query&page=1&limit=10
 * Ricerca solo manga con filtri avanzati
 */
router.get('/manga', async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 10,
      status,
      type,
      genre,
      year,
      minScore,
      orderBy = 'score'
    } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        error: 'Query must be at least 2 characters',
        data: [],
        pagination: { page: 1, limit, total: 0, pages: 0 }
      });
    }

    console.log(`🔍 Advanced manga search: "${q}" (filters: status=${status}, type=${type}, genre=${genre}, year=${year})`);

    const params = {
      q: q.trim(),
      limit: Math.min(limit, 25),
      page: parseInt(page)
    };

    if (status) params.status = status; // FINISHED, PUBLISHING, NOT_YET_PUBLISHED
    if (type) params.type = type; // Manga, Manhwa, Manhua, Light Novel, etc.
    if (genre) params.genres = genre;
    if (year) params.start_date = `${year}-01-01`;
    if (minScore) params.min_score = parseFloat(minScore);
    if (orderBy) params.order_by = orderBy;

    const response = await fetchWithRetry('https://api.jikan.moe/v4/manga', {
      params
    });

    const mangaData = (response.data?.data || []).map(formatMangaData);

    const paginatedResults = mangaData.slice(0, limit);
    const result = {
      query: q,
      type: 'MANGA',
      filters: { status, type, genre, year, minScore },
      data: paginatedResults,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: mangaData.length,
        pages: Math.ceil(mangaData.length / limit)
      }
    };

    console.log(`✅ Found ${paginatedResults.length} manga`);
    res.status(200).json(result);

  } catch (error) {
    logger.error('Manga search error:', error);
    res.status(500).json({
      error: error.message,
      data: [],
      pagination: { page: 1, limit: 10, total: 0, pages: 0 }
    });
  }
});

/**
 * GET /search/:id/details
 * Ottiene dettagli completi di anime/manga con ID
 */
router.get('/:type/:id/details', async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!['anime', 'manga'].includes(type.toLowerCase())) {
      return res.status(400).json({ error: 'Type must be "anime" or "manga"' });
    }

    const endpoint = type.toLowerCase();
    const response = await fetchWithRetry(`https://api.jikan.moe/v4/${endpoint}/${id}`);

    const data = response.data?.data;
    if (!data) {
      return res.status(404).json({ error: `${type} not found` });
    }

    const formatted = type.toLowerCase() === 'anime' ? formatAnimeData(data) : formatMangaData(data);

    console.log(`✅ Fetched details for ${type} ID: ${id}`);
    res.status(200).json({ data: formatted });

  } catch (error) {
    logger.error(`Details fetch error (${type}):`, error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
