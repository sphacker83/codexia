CREATE TABLE IF NOT EXISTS signal_assets (
  ticker TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL,
  name TEXT NOT NULL,
  sector TEXT,
  universe_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS signal_assets_asset_type_idx
  ON signal_assets (asset_type);

CREATE TABLE IF NOT EXISTS signal_source_runs (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  run_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  error_message TEXT,
  payload_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS signal_source_runs_source_name_started_at_idx
  ON signal_source_runs (source_name, started_at DESC);

CREATE TABLE IF NOT EXISTS raw_macro_observations (
  id BIGSERIAL PRIMARY KEY,
  series_key TEXT NOT NULL,
  observation_date DATE NOT NULL,
  value NUMERIC(18, 6) NOT NULL,
  source_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (series_key, observation_date)
);

CREATE INDEX IF NOT EXISTS raw_macro_observations_series_key_date_idx
  ON raw_macro_observations (series_key, observation_date DESC);

CREATE TABLE IF NOT EXISTS raw_market_bars (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  bar_time TIMESTAMPTZ NOT NULL,
  open NUMERIC(18, 6) NOT NULL,
  high NUMERIC(18, 6) NOT NULL,
  low NUMERIC(18, 6) NOT NULL,
  close NUMERIC(18, 6) NOT NULL,
  volume BIGINT,
  source_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticker, timeframe, bar_time)
);

CREATE INDEX IF NOT EXISTS raw_market_bars_ticker_timeframe_bar_time_idx
  ON raw_market_bars (ticker, timeframe, bar_time DESC);

CREATE TABLE IF NOT EXISTS raw_sentiment_snapshots (
  id BIGSERIAL PRIMARY KEY,
  source_key TEXT NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL,
  value_json JSONB NOT NULL,
  source_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key, snapshot_time)
);

CREATE INDEX IF NOT EXISTS raw_sentiment_snapshots_source_key_snapshot_time_idx
  ON raw_sentiment_snapshots (source_key, snapshot_time DESC);

CREATE TABLE IF NOT EXISTS raw_news_items (
  id BIGSERIAL PRIMARY KEY,
  item_id TEXT NOT NULL,
  ticker TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  sentiment_score NUMERIC(8, 4),
  source_timestamp TIMESTAMPTZ NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id)
);

CREATE INDEX IF NOT EXISTS raw_news_items_ticker_published_at_idx
  ON raw_news_items (ticker, published_at DESC);

CREATE TABLE IF NOT EXISTS raw_consensus_snapshots (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL,
  rating_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticker, snapshot_time)
);

CREATE INDEX IF NOT EXISTS raw_consensus_snapshots_ticker_snapshot_time_idx
  ON raw_consensus_snapshots (ticker, snapshot_time DESC);

CREATE TABLE IF NOT EXISTS feature_snapshots (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL,
  feature_set_version TEXT NOT NULL,
  features_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticker, snapshot_time, feature_set_version)
);

CREATE INDEX IF NOT EXISTS feature_snapshots_ticker_snapshot_time_idx
  ON feature_snapshots (ticker, snapshot_time DESC);

CREATE TABLE IF NOT EXISTS technical_layer_snapshots (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL,
  trend_score NUMERIC(5, 2) NOT NULL,
  structure_score NUMERIC(5, 2) NOT NULL,
  action_score NUMERIC(5, 2) NOT NULL,
  ichimoku_score NUMERIC(5, 2) NOT NULL,
  gaussian_score NUMERIC(5, 2) NOT NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticker, snapshot_time)
);

CREATE INDEX IF NOT EXISTS technical_layer_snapshots_ticker_snapshot_time_idx
  ON technical_layer_snapshots (ticker, snapshot_time DESC);

CREATE TABLE IF NOT EXISTS signal_snapshots (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  snapshot_time TIMESTAMPTZ NOT NULL,
  composite_score NUMERIC(5, 2) NOT NULL,
  previous_score NUMERIC(5, 2),
  market_regime TEXT NOT NULL,
  final_action TEXT NOT NULL,
  override_applied BOOLEAN NOT NULL DEFAULT FALSE,
  summary TEXT NOT NULL DEFAULT '',
  stale BOOLEAN NOT NULL DEFAULT FALSE,
  explanation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticker, snapshot_time)
);

CREATE INDEX IF NOT EXISTS signal_snapshots_ticker_snapshot_time_idx
  ON signal_snapshots (ticker, snapshot_time DESC);

CREATE TABLE IF NOT EXISTS signal_component_scores (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id BIGINT NOT NULL REFERENCES signal_snapshots(id) ON DELETE CASCADE,
  component_key TEXT NOT NULL,
  label TEXT NOT NULL,
  score NUMERIC(5, 2) NOT NULL,
  weight NUMERIC(5, 2) NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS signal_component_scores_snapshot_id_idx
  ON signal_component_scores (snapshot_id, component_key);

CREATE TABLE IF NOT EXISTS recommendation_runs (
  id BIGSERIAL PRIMARY KEY,
  snapshot_time TIMESTAMPTZ NOT NULL,
  style TEXT NOT NULL,
  market_regime TEXT NOT NULL,
  state TEXT NOT NULL,
  universe_count INTEGER NOT NULL DEFAULT 0,
  selected_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (snapshot_time, style)
);

CREATE INDEX IF NOT EXISTS recommendation_runs_snapshot_time_idx
  ON recommendation_runs (snapshot_time DESC, style);

CREATE TABLE IF NOT EXISTS recommendation_items (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES recommendation_runs(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  rank INTEGER NOT NULL,
  style_score NUMERIC(6, 2) NOT NULL,
  thesis_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_flags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  drivers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  sector TEXT,
  summary TEXT NOT NULL DEFAULT '',
  verdict_label TEXT NOT NULL DEFAULT '',
  quality_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  valuation_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  growth_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  technical_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  liquidity_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  risk_penalty NUMERIC(5, 2) NOT NULL DEFAULT 0,
  profitability TEXT NOT NULL DEFAULT '',
  free_cash_flow TEXT NOT NULL DEFAULT '',
  is_profitable BOOLEAN NOT NULL DEFAULT FALSE,
  positive_free_cash_flow BOOLEAN NOT NULL DEFAULT FALSE,
  debt_to_ebitda NUMERIC(10, 4),
  earnings_in_days INTEGER,
  avg_daily_dollar_volume_m NUMERIC(12, 2),
  relative_strength_pct NUMERIC(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, ticker)
);

CREATE INDEX IF NOT EXISTS recommendation_items_run_id_rank_idx
  ON recommendation_items (run_id, rank ASC);

CREATE TABLE IF NOT EXISTS notification_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  snapshot_time TIMESTAMPTZ,
  delivery_channel TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_events_snapshot_time_idx
  ON notification_events (snapshot_time DESC, delivery_channel);

CREATE TABLE IF NOT EXISTS pipeline_job_runs (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_name, scheduled_for)
);

CREATE INDEX IF NOT EXISTS pipeline_job_runs_job_name_scheduled_for_idx
  ON pipeline_job_runs (job_name, scheduled_for DESC);

CREATE TABLE IF NOT EXISTS signal_delivery_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_id TEXT NOT NULL UNIQUE,
  snapshot_time TIMESTAMPTZ NOT NULL,
  snapshot_mode TEXT NOT NULL DEFAULT 'live',
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (snapshot_mode IN ('live', 'demo'))
);

CREATE INDEX IF NOT EXISTS signal_delivery_snapshots_snapshot_time_idx
  ON signal_delivery_snapshots (snapshot_time DESC);
