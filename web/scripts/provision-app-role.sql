\set ON_ERROR_STOP on

SELECT 'CREATE ROLE company_brain_app LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'company_brain_app')
\gexec

ALTER ROLE company_brain_app PASSWORD :'app_password';
ALTER ROLE company_brain_app SET statement_timeout = '30s';
ALTER ROLE company_brain_app SET idle_in_transaction_session_timeout = '30s';
GRANT CONNECT ON DATABASE company_brain_os TO company_brain_app;
GRANT USAGE ON SCHEMA public TO company_brain_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO company_brain_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO company_brain_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO company_brain_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO company_brain_app;
