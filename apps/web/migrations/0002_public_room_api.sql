-- A write to D1 serializes quota admission across all credentials for one account.
CREATE TABLE developer_room_requests (id TEXT PRIMARY KEY NOT NULL, developer_id TEXT NOT NULL, requested_at INTEGER NOT NULL);
CREATE INDEX developer_room_requests_account_time ON developer_room_requests(developer_id, requested_at);
-- Kept independently from room state for the full retry retention period.
CREATE TABLE developer_room_operations (
 developer_id TEXT NOT NULL, retry_key TEXT NOT NULL, request_json TEXT NOT NULL,
 room_id TEXT NOT NULL UNIQUE, creation_id TEXT NOT NULL UNIQUE,
 activation_expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
 response_json TEXT, PRIMARY KEY(developer_id, retry_key)
);
CREATE INDEX developer_room_operations_created ON developer_room_operations(created_at);
