-- Migration 002: Performance Indexes for High-Throughput Telemetry and Settlement
-- Accelerates customer dashboard aggregations, real-time telemetry lookups, and PayHere settlement queries

CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_consumption_meter_date ON consumption_logs(meter_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_complaints_user_status ON complaints(user_id, status);
CREATE INDEX IF NOT EXISTS idx_meters_user_id ON meters(user_id);
