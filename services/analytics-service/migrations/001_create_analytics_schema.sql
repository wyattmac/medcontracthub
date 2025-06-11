-- Create Analytics Database
CREATE DATABASE IF NOT EXISTS medcontract_analytics;

USE medcontract_analytics;

-- Opportunity Views Raw Events Table
CREATE TABLE IF NOT EXISTS opportunity_views (
    event_id String,
    timestamp DateTime64(3),
    opportunity_id String,
    user_id String,
    session_id String,
    view_source Enum8('SEARCH' = 1, 'DASHBOARD' = 2, 'SAVED' = 3, 'RECOMMENDATION' = 4, 'DIRECT_LINK' = 5),
    search_query String,
    referrer String,
    opportunity_title String,
    agency String,
    naics_code String,
    set_aside_type String,
    response_deadline Nullable(DateTime),
    user_agent String,
    ip_hash String,
    
    -- Processing metadata
    ingested_at DateTime DEFAULT now(),
    processing_time_ms UInt32,
    
    INDEX idx_opportunity_id opportunity_id TYPE minmax GRANULARITY 4,
    INDEX idx_user_id user_id TYPE minmax GRANULARITY 4,
    INDEX idx_timestamp timestamp TYPE minmax GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, opportunity_id, user_id)
TTL timestamp + INTERVAL 90 DAY;

-- Opportunity Saves Events Table
CREATE TABLE IF NOT EXISTS opportunity_saves (
    event_id String,
    timestamp DateTime64(3),
    opportunity_id String,
    user_id String,
    saved_to_list String,
    tags Array(String),
    notes String,
    opportunity_title String,
    agency String,
    naics_code String,
    set_aside_type String,
    response_deadline Nullable(DateTime),
    award_amount Decimal(18, 2),
    save_source Enum8('SEARCH_RESULTS' = 1, 'DETAIL_PAGE' = 2, 'AI_RECOMMENDATION' = 3, 'BULK_ACTION' = 4),
    ai_score Decimal(5, 4),
    
    -- Processing metadata
    ingested_at DateTime DEFAULT now(),
    
    INDEX idx_opportunity_id opportunity_id TYPE minmax GRANULARITY 4,
    INDEX idx_user_id user_id TYPE minmax GRANULARITY 4
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, opportunity_id, user_id)
TTL timestamp + INTERVAL 180 DAY;

-- Real-time Metrics Materialized View (1-minute aggregations)
CREATE MATERIALIZED VIEW IF NOT EXISTS opportunity_metrics_1m
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMMDD(minute)
ORDER BY (minute, agency, naics_code)
TTL minute + INTERVAL 7 DAY
AS SELECT
    toStartOfMinute(timestamp) as minute,
    agency,
    naics_code,
    view_source,
    count() as view_count,
    uniq(user_id) as unique_users,
    uniq(opportunity_id) as unique_opportunities,
    countIf(search_query != '') as searches,
    avg(processing_time_ms) as avg_processing_time
FROM opportunity_views
GROUP BY minute, agency, naics_code, view_source;

-- Hourly Aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS opportunity_metrics_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (hour, agency, naics_code)
TTL hour + INTERVAL 90 DAY
AS SELECT
    toStartOfHour(timestamp) as hour,
    agency,
    naics_code,
    count() as view_count,
    uniq(user_id) as unique_users,
    uniq(opportunity_id) as unique_opportunities,
    countIf(view_source = 'SEARCH') as search_views,
    countIf(view_source = 'RECOMMENDATION') as recommendation_views
FROM opportunity_views
GROUP BY hour, agency, naics_code;

-- User Engagement Metrics
CREATE TABLE IF NOT EXISTS user_engagement_daily (
    date Date,
    user_id String,
    views_count UInt32,
    saves_count UInt32,
    unique_opportunities_viewed UInt32,
    unique_opportunities_saved UInt32,
    agencies_explored Array(String),
    naics_codes_explored Array(String),
    avg_time_between_actions_seconds UInt32,
    last_active_time DateTime,
    
    INDEX idx_user_id user_id TYPE minmax GRANULARITY 4
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, user_id)
TTL date + INTERVAL 365 DAY;

-- Opportunity Performance Metrics
CREATE TABLE IF NOT EXISTS opportunity_performance (
    date Date,
    opportunity_id String,
    opportunity_title String,
    agency String,
    naics_code String,
    total_views UInt32,
    unique_viewers UInt32,
    total_saves UInt32,
    save_rate Decimal(5, 4), -- saves/views ratio
    avg_time_to_save_minutes UInt32,
    view_sources Map(String, UInt32),
    
    INDEX idx_opportunity_id opportunity_id TYPE minmax GRANULARITY 4,
    INDEX idx_save_rate save_rate TYPE minmax GRANULARITY 4
) ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, opportunity_id);

-- Conversion Funnel Table
CREATE TABLE IF NOT EXISTS conversion_funnel (
    date Date,
    source String,
    stage Enum8('viewed' = 1, 'saved' = 2, 'proposal_started' = 3, 'proposal_submitted' = 4, 'awarded' = 5),
    user_count UInt32,
    opportunity_count UInt32,
    conversion_rate Decimal(5, 4)
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, source, stage);

-- Search Analytics Table
CREATE TABLE IF NOT EXISTS search_analytics (
    date Date,
    search_query String,
    search_count UInt32,
    unique_users UInt32,
    results_clicked UInt32,
    results_saved UInt32,
    click_through_rate Decimal(5, 4),
    save_rate Decimal(5, 4),
    avg_position_clicked Decimal(5, 2)
) ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, search_query)
TTL date + INTERVAL 180 DAY;

-- Agency Performance Metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS agency_metrics
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, agency)
AS SELECT
    toDate(timestamp) as date,
    agency,
    count() as total_views,
    uniq(user_id) as unique_users,
    uniq(opportunity_id) as opportunities_posted,
    countIf(view_source = 'SEARCH') as search_discoveries,
    countIf(view_source = 'RECOMMENDATION') as ai_recommendations
FROM opportunity_views
GROUP BY date, agency;

-- Create distributed tables for multi-node ClickHouse cluster
-- These would be used in production for horizontal scaling
CREATE TABLE IF NOT EXISTS opportunity_views_distributed AS opportunity_views
ENGINE = Distributed('analytics_cluster', 'medcontract_analytics', 'opportunity_views', cityHash64(user_id));

CREATE TABLE IF NOT EXISTS opportunity_saves_distributed AS opportunity_saves
ENGINE = Distributed('analytics_cluster', 'medcontract_analytics', 'opportunity_saves', cityHash64(user_id));