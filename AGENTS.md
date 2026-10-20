# Architecture Rules

- New drawer assignments are positioned at `0` by the database trigger, which shifts existing items while preserving their relative order, so every write path stays consistent.
- Moving a fully watched series to `watched` reuses its episode-derived rating; incomplete or unrated series keep the mandatory rating dialog to avoid duplicate input.
- Activity interactions are keyed to drawer-assignment IDs and restricted to accepted friends, so likes, comments, and their notifications follow feed visibility.
- Social notifications are created atomically by source-event triggers and carry exact event IDs; client paths write only the source event to avoid spoofing and duplicates.
- The notification inbox separates paginated history, unread count, pending actions, grouping and destination resolution so reading does not dismiss decisions.
- Catalogue delivery uses service-only leased batches and a successful-delivery snapshot independent of title enrichment, so retries retain changes and scale beyond assignment query limits.
- The admin area (/admin/*) is its own sidebar app shell; every admin read/action goes through has_role-checked SECURITY DEFINER RPCs so nothing relies on client-side checks.
- Marketing observations are unique per channel and week; budget scenarios use explicit historical ratios, never causal attribution or fitted MMM claims, so missing evidence is not presented as model output.
