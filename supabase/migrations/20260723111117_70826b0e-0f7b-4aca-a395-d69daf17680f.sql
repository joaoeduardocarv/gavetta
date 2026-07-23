SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'refresh-productions-weekly'),
  schedule := '0 */6 * * *'
);