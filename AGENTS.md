# Architecture Rules

- New drawer assignments are positioned at `0` by the database trigger, which shifts existing items while preserving their relative order, so every write path stays consistent.
- Moving a fully watched series to `watched` reuses its episode-derived rating; incomplete or unrated series keep the mandatory rating dialog to avoid duplicate input.
- Activity interactions are keyed to drawer-assignment IDs and restricted to accepted friends, so likes, comments, and their notifications follow feed visibility.
- Social notifications are created atomically by source-event triggers and carry exact event IDs; client paths write only the source event to avoid spoofing and duplicates.
- The notification inbox separates paginated history, unread count, pending actions, grouping and destination resolution so reading does not dismiss decisions.
- Catalogue delivery uses service-only leased batches and a successful-delivery snapshot independent of title enrichment, so retries retain changes and scale beyond assignment query limits.
- The admin area (/admin/*) is its own sidebar app shell; every admin read/action goes through has_role-checked SECURITY DEFINER RPCs so nothing relies on client-side checks.
- Marketing campaigns store nullable metrics and overlapping date ranges; historical scenarios group by channel, objective and measured result, using only paired spend/results, never causal MMM claims or allocation of lifetime totals to individual weeks.
- Signup UTM attribution is first-touch (30 days) and stored server-side only for accounts created in the last 48h, so existing users are never credited to later campaigns.
