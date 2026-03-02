

## Plan: Search by Actor/Director in Gavetta

### Overview
Expand the search page to allow searching by person (actor/director) using TMDB's person search and combined credits endpoints. The backend already supports `searchPerson` and `getPersonCredits` actions.

### Changes

**1. `src/lib/tmdb.ts` — Enhance `getPersonCredits` return type**
- Update `getPersonCredits` to return full credit objects including `poster_path`, `popularity`, `title`/`name`, `overview`, etc. (the edge function already returns combined_credits data, but the client function types it too narrowly as `TMDBPersonCredit[]`).
- Add a new `searchPersonWithCredits` convenience function that searches a person and fetches their credits in one call.

**2. `src/pages/Search.tsx` — Add search mode toggle and person results**
- Add a search mode state: `'title' | 'person'` with toggle buttons (Título / Pessoa) next to or below the search bar.
- When mode is `'person'`:
  - Call `searchPerson(query)` to find matching people.
  - Auto-select the top result (or show a small list to pick from if multiple matches).
  - Fetch `getPersonCredits(personId)` for the selected person.
  - Convert credits to `Content[]` format, filter out items without `poster_path`, sort by `popularity` desc.
  - Show a header with the person's photo and name (e.g., "Filmes e séries com Brad Pitt").
  - Render results using existing `ContentCard` + `ContentDetailDialog` (same click behavior).
- When mode is `'title'`: keep current behavior unchanged.
- Hide the "Navegação Rápida" section when in person mode.

**3. No backend changes needed**
The edge function already has `searchPerson` and `getPersonCredits` actions with caching. The `getPersonCredits` action already returns combined cast+crew (director only) credits, deduped and sorted.

### UI Layout (Person Mode)
```text
┌─────────────────────────────┐
│  [Título] [Pessoa]          │  ← toggle buttons
│  🔍 Search input...         │
│                             │
│  ┌──────┐                   │
│  │ foto │ Filmes e séries   │  ← person header
│  │      │ com Brad Pitt     │
│  └──────┘                   │
│                             │
│  [ContentCard]              │  ← same cards as title search
│  [ContentCard]              │
│  [ContentCard]              │
│  ...                        │
└─────────────────────────────┘
```

### Key Details
- Person search results from `searchPerson` return up to 5 matches — if only 1 result, auto-select; if multiple, show a small picker.
- Credits are filtered to only show items with `poster_path` (non-null) and sorted by `popularity` descending.
- The `TMDBPersonCredit` type already has `poster_path`, `media_type`, `title`/`name`, `vote_average`, `character`, `job` fields.
- Reuse `tmdbMovieToContent`/`tmdbTVToContent` pattern for credits conversion.

