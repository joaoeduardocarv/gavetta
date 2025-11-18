export interface Content {
  id: string;
  type: 'movie' | 'series';
  title: string;
  originalTitle?: string;
  releaseDate: string;
  synopsis: string;
  posterUrl: string;
  backdropUrl?: string;
  genres: string[];
  director?: string;
  cast?: string[];
  availableOn?: string[];
  rating?: number;
  status?: 'watched' | 'watching' | 'to_watch';
  isFavorite?: boolean;
  watchedDate?: string;
  isInDrawer?: boolean;
  drawerComment?: string;
}

export const mockContent: Content[] = [
  {
    id: '1',
    type: 'movie',
    title: 'Duna: Parte Dois',
    originalTitle: 'Dune: Part Two',
    releaseDate: '2024-03-01',
    synopsis: 'Paul Atreides une forças com Chani e os Fremen enquanto busca vingança contra os conspiradores que destruíram sua família.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/czembW0Rk1Ke7lCJGahbOhdCuhV.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg',
    genres: ['Ficção Científica', 'Aventura'],
    director: 'Denis Villeneuve',
    cast: ['Timothée Chalamet', 'Zendaya', 'Rebecca Ferguson', 'Javier Bardem'],
    availableOn: ['Max', 'Prime Video'],
    rating: 9.5,
    status: 'watched',
    isFavorite: true,
    watchedDate: '2024-03-15',
    isInDrawer: true,
    drawerComment: 'Obra-prima visual absoluta! Denis Villeneuve é um gênio.',
  },
  {
    id: '2',
    type: 'series',
    title: 'The Last of Us',
    releaseDate: '2023-01-15',
    synopsis: 'Após uma pandemia devastadora, Joel é contratado para tirar Ellie, de 14 anos, de uma zona de quarentena opressiva.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg',
    genres: ['Drama', 'Ficção Científica'],
    cast: ['Pedro Pascal', 'Bella Ramsey', 'Anna Torv'],
    availableOn: ['Max'],
    rating: 9.0,
    status: 'watching',
    isFavorite: true,
    isInDrawer: true,
    drawerComment: 'Melhor adaptação de jogo que já vi!',
  },
  {
    id: '3',
    type: 'movie',
    title: 'Oppenheimer',
    releaseDate: '2023-07-21',
    synopsis: 'A história de J. Robert Oppenheimer, o físico que liderou o desenvolvimento da bomba atômica durante a Segunda Guerra Mundial.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg',
    genres: ['Drama', 'História'],
    director: 'Christopher Nolan',
    cast: ['Cillian Murphy', 'Emily Blunt', 'Matt Damon', 'Robert Downey Jr.'],
    availableOn: ['Prime Video', 'Apple TV'],
    rating: 8.5,
    status: 'watched',
    watchedDate: '2023-08-10',
  },
  {
    id: '5',
    type: 'series',
    title: 'Breaking Bad',
    releaseDate: '2008-01-20',
    synopsis: 'Um professor de química do ensino médio com câncer terminal se une a um ex-aluno para fabricar e vender metanfetamina.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    genres: ['Drama', 'Crime'],
    rating: 10.0,
    status: 'watched',
    isFavorite: true,
    watchedDate: '2023-05-20',
    isInDrawer: true,
  },
  {
    id: '6',
    type: 'movie',
    title: 'Parasita',
    originalTitle: 'Gisaengchung',
    releaseDate: '2019-05-30',
    synopsis: 'Toda a família de Ki-taek está desempregada, vivendo em um porão sujo e apertado, mas uma obra do acaso faz com que o filho consiga um emprego.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg',
    genres: ['Drama', 'Thriller'],
    director: 'Bong Joon-ho',
    rating: 9.5,
    status: 'watched',
    isFavorite: true,
    watchedDate: '2023-11-05',
    isInDrawer: true,
    drawerComment: 'Cinema coreano no seu melhor. Obra-prima!',
  },
  {
    id: '7',
    type: 'movie',
    title: 'Interestelar',
    originalTitle: 'Interstellar',
    releaseDate: '2014-11-07',
    synopsis: 'Uma equipe de exploradores viaja através de um buraco de minhoca no espaço em uma tentativa de garantir a sobrevivência da humanidade.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/xu9zaAevzQ5nnrsXN6JcahLnG4i.jpg',
    genres: ['Ficção Científica', 'Drama'],
    director: 'Christopher Nolan',
    rating: 9.0,
    status: 'watched',
    isFavorite: true,
    watchedDate: '2023-12-10',
    isInDrawer: true,
  },
  {
    id: '8',
    type: 'series',
    title: 'Succession',
    releaseDate: '2018-06-03',
    synopsis: 'A família Roy controla um dos maiores conglomerados de mídia e entretenimento do mundo. Quando o patriarca decide se aposentar, uma guerra começa.',
    posterUrl: 'https://image.tmdb.org/t/p/w500/7HW47XbkNQ5fiwQFYGWdw9gs144.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/fTZ8RXYzxUJzFZ19ACVR2r8D6Kx.jpg',
    genres: ['Drama'],
    rating: 8.5,
    status: 'to_watch',
  },
];
