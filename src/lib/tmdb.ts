const TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlMGZjMWEzNTUxNGIxYWM2YTlkZGNjY2VlYzg0YTk2MyIsIm5iZiI6MTc2NDg3MzM1My4zMDksInN1YiI6IjY5MzFkNDg5ZjIyYzJiYmU0ZTY5YjliZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KWCojutvNgsTGcdtnIFEJVPsEdINVBi0jUN838-EswE";

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
}

export interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export async function searchMovies(query: string): Promise<TMDBMovie[]> {
  if (!query.trim()) return [];

  const response = await fetch(
    `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}`,
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${TMDB_TOKEN}`,
        "Accept": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data: TMDBSearchResponse = await response.json();
  return data.results;
}

export function getTMDBImageUrl(path: string | null, size: 'w200' | 'w500' | 'original' = 'w500'): string {
  if (!path) return '/placeholder.svg';
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
