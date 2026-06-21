-- Optional Postgres + Apache AGE bootstrap for the chosen database provider.
-- Do not run this in F0 tests; first verify the provider supports AGE.
CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;
