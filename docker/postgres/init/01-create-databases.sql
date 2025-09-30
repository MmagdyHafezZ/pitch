-- Create separate databases for each microservice
CREATE DATABASE pitch_auth;
CREATE DATABASE pitch_user;
CREATE DATABASE pitch_business;

-- Grant permissions to the user for all databases
GRANT ALL PRIVILEGES ON DATABASE pitch_auth TO pitch_user;
GRANT ALL PRIVILEGES ON DATABASE pitch_user TO pitch_user;
GRANT ALL PRIVILEGES ON DATABASE pitch_business TO pitch_user;