import { db } from "../infrastructure/database/pool";
import { logger } from "../infrastructure/logging/logger";
import { env } from "../config/env";

export async function runRollups() {
  logger.info("[rollup] Starting metric rollups");

  const rollups = [
    {
      window: "1m",
      bucketExpr: "date_trunc('minute', timestamp)",
      lookback: "15 minutes"
    },
    {
      window: "5m",
      bucketExpr: "to_timestamp(floor(extract(epoch from timestamp) / 300) * 300)",
      lookback: "30 minutes"
    },
    {
      window: "15m",
      bucketExpr: "to_timestamp(floor(extract(epoch from timestamp) / 900) * 900)",
      lookback: "1 hour"
    },
    {
      window: "1h",
      bucketExpr: "date_trunc('hour', timestamp)",
      lookback: "6 hours"
    },
    {
      window: "1d",
      bucketExpr: "date_trunc('day', timestamp)",
      lookback: "2 days"
    }
  ];

  const results: Array<{ window: string; rowCount: number }> = [];
  const failures: Array<{ window: string; error: unknown }> = [];

  for (const r of rollups) {
    try {
      const sql = `
        WITH source AS (
          SELECT
            organization_id,
            project_id,
            service_id,
            project_key,
            service_name,
            environment,
            metric_name,
            value,
            ${r.bucketExpr} AS timestamp_bucket
          FROM metrics
          WHERE timestamp >= NOW() - INTERVAL '${r.lookback}'
        )
        INSERT INTO metric_aggregates (
          id,
          organization_id,
          project_id,
          service_id,
          project_key,
          service_name,
          environment,
          metric_name,
          "window",
          timestamp_bucket,
          count,
          sum,
          avg,
          min,
          max,
          p50,
          p95,
          p99,
          created_at,
          updated_at
        )
        SELECT
          gen_random_uuid() AS id,
          organization_id,
          project_id,
          service_id,
          project_key,
          service_name,
          environment,
          metric_name,
          $1 AS "window",
          timestamp_bucket,
          COUNT(*) AS count,
          SUM(value) AS sum,
          AVG(value) AS avg,
          MIN(value) AS min,
          MAX(value) AS max,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY value) AS p50,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY value) AS p95,
          percentile_cont(0.99) WITHIN GROUP (ORDER BY value) AS p99,
          NOW() AS created_at,
          NOW() AS updated_at
        FROM source
        GROUP BY
          organization_id,
          project_id,
          service_id,
          project_key,
          service_name,
          environment,
          metric_name,
          timestamp_bucket
        ON CONFLICT (organization_id, project_id, service_id, environment, metric_name, "window", timestamp_bucket)
        DO UPDATE SET
          count = EXCLUDED.count,
          sum = EXCLUDED.sum,
          avg = EXCLUDED.avg,
          min = EXCLUDED.min,
          max = EXCLUDED.max,
          p50 = EXCLUDED.p50,
          p95 = EXCLUDED.p95,
          p99 = EXCLUDED.p99,
          project_key = COALESCE(EXCLUDED.project_key, metric_aggregates.project_key),
          service_name = EXCLUDED.service_name,
          updated_at = NOW();
      `;

      const res = await db.query(sql, [r.window]);
      const rowCount = res.rowCount || 0;
      results.push({ window: r.window, rowCount });
      logger.info(`[rollup] computed ${r.window} aggregates for ${rowCount} service metrics`);
    } catch (error) {
      failures.push({ window: r.window, error });
      logger.error({ error, window: r.window }, `[rollup] Failed to compute ${r.window} aggregates`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Metric rollups failed for windows: ${failures.map((failure) => failure.window).join(", ")}`);
  }

  return results;
}

export async function runRetention() {
  logger.info("[retention] Starting data retention cleanup");

  try {
    const start = Date.now();

    // 1. logs
    const logRes = await db.query(
      "DELETE FROM logs WHERE timestamp < NOW() - CAST($1 || ' days' AS INTERVAL)",
      [env.LOG_RETENTION_DAYS]
    );

    // 2. raw metrics
    const metricRes = await db.query(
      "DELETE FROM metrics WHERE timestamp < NOW() - CAST($1 || ' days' AS INTERVAL)",
      [env.RAW_METRIC_RETENTION_DAYS]
    );

    // 3. metric aggregates
    const aggRes = await db.query(
      "DELETE FROM metric_aggregates WHERE timestamp_bucket < NOW() - CAST($1 || ' days' AS INTERVAL)",
      [env.AGGREGATE_METRIC_RETENTION_DAYS]
    );

    // 4. audit logs
    const auditRes = await db.query(
      "DELETE FROM audit_logs WHERE created_at < NOW() - CAST($1 || ' days' AS INTERVAL)",
      [env.AUDIT_LOG_RETENTION_DAYS]
    );

    // 5. incident events
    const incidentRes = await db.query(
      "DELETE FROM incident_events WHERE created_at < NOW() - CAST($1 || ' days' AS INTERVAL)",
      [env.INCIDENT_EVENT_RETENTION_DAYS]
    );

    const result = {
      durationMs: Date.now() - start,
      deletedLogs: logRes.rowCount || 0,
      deletedMetrics: metricRes.rowCount || 0,
      deletedAggregates: aggRes.rowCount || 0,
      deletedAuditLogs: auditRes.rowCount || 0,
      deletedIncidentEvents: incidentRes.rowCount || 0
    };

    logger.info(result, "[retention] Data retention cleanup completed");
    return result;
  } catch (error) {
    logger.error({ error }, "[retention] Data retention cleanup failed");
    throw error;
  }
}
