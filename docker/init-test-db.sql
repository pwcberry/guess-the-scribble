-- Create the test database. The dev database (guess_the_scribble) is already
-- created by POSTGRES_DB in docker-compose.yaml; this script adds gts_test.
CREATE DATABASE gts_test;
GRANT ALL PRIVILEGES ON DATABASE gts_test TO scribbler;

