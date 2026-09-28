# Architecture Rules

- New drawer assignments are positioned at `0` by the database trigger, which shifts existing items while preserving their relative order, so every write path stays consistent.
- Moving a fully watched series to `watched` reuses its episode-derived rating; incomplete or unrated series keep the mandatory rating dialog to avoid duplicate input.
