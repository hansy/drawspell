-- Better Auth 1.7.7 core + magic-link + @better-auth/api-key schema.
-- Dates are UTC Unix milliseconds (Drizzle timestamp_ms).
CREATE TABLE developer_user (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, email_verified INTEGER NOT NULL, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE developer_session (id TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES developer_user(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, ip_address TEXT, user_agent TEXT);
CREATE INDEX developer_session_user_idx ON developer_session(user_id);
CREATE TABLE developer_account (id TEXT PRIMARY KEY NOT NULL, account_id TEXT NOT NULL, provider_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES developer_user(id) ON DELETE CASCADE, access_token TEXT, refresh_token TEXT, id_token TEXT, access_token_expires_at INTEGER, refresh_token_expires_at INTEGER, scope TEXT, password TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX developer_account_user_idx ON developer_account(user_id);
CREATE TABLE developer_verification (id TEXT PRIMARY KEY NOT NULL, identifier TEXT NOT NULL, value TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX developer_verification_identifier_idx ON developer_verification(identifier);
CREATE TABLE developer_auth_rate_limit (id TEXT PRIMARY KEY NOT NULL, key TEXT NOT NULL UNIQUE, count INTEGER NOT NULL, last_request INTEGER NOT NULL);
CREATE TABLE developer_accounts (developer_id TEXT PRIMARY KEY NOT NULL REFERENCES developer_user(id) ON DELETE CASCADE, suspended INTEGER NOT NULL DEFAULT 0 CHECK(suspended IN (0,1)), requests_per_minute INTEGER NOT NULL DEFAULT 10 CHECK(requests_per_minute > 0), created_at INTEGER NOT NULL);
CREATE TRIGGER developer_account_defaults AFTER INSERT ON developer_user BEGIN
  INSERT INTO developer_accounts(developer_id, created_at) VALUES (NEW.id, NEW.created_at);
END;
CREATE TABLE developer_api_key (id TEXT PRIMARY KEY NOT NULL, config_id TEXT NOT NULL DEFAULT 'default', name TEXT, start TEXT, reference_id TEXT NOT NULL, prefix TEXT, key TEXT NOT NULL, refill_interval INTEGER, refill_amount INTEGER, last_refill_at INTEGER, enabled INTEGER DEFAULT 1, rate_limit_enabled INTEGER DEFAULT 0, rate_limit_time_window INTEGER, rate_limit_max INTEGER, request_count INTEGER DEFAULT 0, remaining INTEGER, last_request INTEGER, expires_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, permissions TEXT, metadata TEXT);
CREATE INDEX developer_api_key_owner_idx ON developer_api_key(reference_id);
CREATE INDEX developer_api_key_hash_idx ON developer_api_key(key);
-- Audit intentionally has no foreign keys: attribution outlives revoked keys.
CREATE TABLE developer_key_audit (key_id TEXT PRIMARY KEY NOT NULL, developer_id TEXT NOT NULL, name TEXT, prefix TEXT, created_at INTEGER NOT NULL, revoked_at INTEGER);
CREATE INDEX developer_key_audit_owner_idx ON developer_key_audit(developer_id);
-- SQLite serializes writes. These triggers enforce the cap for all insert/update paths.
CREATE TRIGGER developer_key_cap_insert BEFORE INSERT ON developer_api_key WHEN NEW.enabled = 1 AND (NEW.expires_at IS NULL OR NEW.expires_at > unixepoch('now') * 1000) BEGIN
  SELECT RAISE(ABORT, 'DEVELOPER_KEY_CAP') WHERE (SELECT COUNT(*) FROM developer_api_key WHERE reference_id = NEW.reference_id AND enabled = 1 AND (expires_at IS NULL OR expires_at > unixepoch('now') * 1000)) >= 5;
END;
CREATE TRIGGER developer_key_cap_update BEFORE UPDATE OF enabled, reference_id, expires_at ON developer_api_key WHEN NEW.enabled = 1 AND (NEW.expires_at IS NULL OR NEW.expires_at > unixepoch('now') * 1000) BEGIN
  SELECT RAISE(ABORT, 'DEVELOPER_KEY_CAP') WHERE (SELECT COUNT(*) FROM developer_api_key WHERE id != NEW.id AND reference_id = NEW.reference_id AND enabled = 1 AND (expires_at IS NULL OR expires_at > unixepoch('now') * 1000)) >= 5;
END;
CREATE TRIGGER developer_key_audit_insert AFTER INSERT ON developer_api_key BEGIN
  INSERT INTO developer_key_audit VALUES (NEW.id, NEW.reference_id, NEW.name, NEW.start, NEW.created_at, NULL);
END;
CREATE TRIGGER developer_key_audit_disable AFTER UPDATE OF enabled ON developer_api_key WHEN NEW.enabled = 0 BEGIN
  UPDATE developer_key_audit SET revoked_at = COALESCE(revoked_at, unixepoch('now') * 1000) WHERE key_id = NEW.id;
END;
CREATE TRIGGER developer_key_audit_delete AFTER DELETE ON developer_api_key BEGIN
  UPDATE developer_key_audit SET revoked_at = COALESCE(revoked_at, unixepoch('now') * 1000) WHERE key_id = OLD.id;
END;
