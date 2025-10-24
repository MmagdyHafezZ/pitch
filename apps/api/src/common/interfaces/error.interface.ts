/*
 * Prisma Error Codes (with rough meanings / descriptions)
 *
 * Common errors (connection / setup)
 * P1000: Authentication failed against database; invalid credentials for the DB host :contentReference[oaicite:0]{index=0}
 * P1001: Cannot reach database server at host:port (server not running / unreachable) :contentReference[oaicite:1]{index=1}
 * P1002: (Not documented explicitly in the subset)
 * P1003: (Not documented explicitly)
 * P1008: (Not documented explicitly)
 * P1009: (Not documented explicitly)
 * P1010: (Not documented explicitly)
 * P1011: (Not documented explicitly)
 * P1012: (Not documented explicitly)
 * P1013: Invalid database connection string :contentReference[oaicite:2]{index=2}
 * P1014: Underlying database table / model is missing / doesn’t exist :contentReference[oaicite:3]{index=3}
 * P1015: Incompatible / unsupported database version :contentReference[oaicite:4]{index=4}
 * P1016: Incorrect number of parameters in raw queries :contentReference[oaicite:5]{index=5}
 * P1017: Database connection was closed by server unexpectedly :contentReference[oaicite:6]{index=6}
 *
 * Prisma Client / Query Engine errors
 * P2000: Provided value for a column is too long for its column type :contentReference[oaicite:7]{index=7}
 * P2001: Record searched in a `where` clause does not exist :contentReference[oaicite:8]{index=8}
 * P2002: Unique constraint failed (duplicate value on a unique field) :contentReference[oaicite:9]{index=9}
 * P2003: Foreign key constraint failed (referenced record not found) :contentReference[oaicite:10]{index=10}
 * P2004: A database constraint failed (generic) :contentReference[oaicite:11]{index=11}
 * P2005: Value stored in database is invalid for the field’s type :contentReference[oaicite:12]{index=12}
 * P2006: Provided value for the field is not valid :contentReference[oaicite:13]{index=13}
 * P2007: Data validation error :contentReference[oaicite:14]{index=14}
 * P2008: Failed to parse the query :contentReference[oaicite:15]{index=15}
 * P2009: Failed to validate the query :contentReference[oaicite:16]{index=16}
 * P2010: Raw query failed (error executing a raw SQL query) :contentReference[oaicite:17]{index=17}
 * P2011: Null constraint violation (a non-nullable field is null) :contentReference[oaicite:18]{index=18}
 * P2012: Missing a required value (required field not given) :contentReference[oaicite:19]{index=19}
 * P2013: Missing a required argument to a query or operation :contentReference[oaicite:20]{index=20}
 * P2014: Change would violate required relation (relation integrity violation) :contentReference[oaicite:21]{index=21}
 * P2015: A related record could not be found in a relation query :contentReference[oaicite:22]{index=22}
 * P2016: Query interpretation error (Prisma couldn’t interpret your query) :contentReference[oaicite:23]{index=23}
 * P2017: Relation records not connected (parent-child relation mismatch) :contentReference[oaicite:24]{index=24}
 * P2018: Required connected records not found :contentReference[oaicite:25]{index=25}
 * P2019: Input error (bad input provided) :contentReference[oaicite:26]{index=26}
 * P2020: Value out of range for type (overflow / underflow) :contentReference[oaicite:27]{index=27}
 * P2021: Table does not exist in current database :contentReference[oaicite:28]{index=28}
 * P2022: Column does not exist in the current database :contentReference[oaicite:29]{index=29}
 * P2023: Inconsistent column data (mismatch in expected data types) :contentReference[oaicite:30]{index=30}
 * P2024: Timed out fetching a new connection from pool :contentReference[oaicite:31]{index=31}
 * P2025: Operation failed because one or more required records weren’t found (e.g. delete or update on missing) :contentReference[oaicite:32]{index=32}
 * P2026: Database provider doesn’t support a feature used in the query :contentReference[oaicite:33]{index=33}
 * P2027: Multiple errors occurred during query execution :contentReference[oaicite:34]{index=34}
 * P2028+: (some others exist beyond, though not always documented in detail)
 *
 * Prisma Migrate / Schema Engine errors
 * P3000 – P3024: migration / schema-level errors (e.g. migration failed, incompatible schema, migration not possible) :contentReference[oaicite:35]{index=35}
 *
 * Introspection / DB Pull errors
 * P4000, P4001, P4002: errors during introspection or pulling existing schema :contentReference[oaicite:36]{index=36}
 *
 * Prisma Accelerate / other engine / runtime errors
 * P6000+ series: errors related to Prisma Accelerate / engine / response limits
 * P6009: Response size limit exceeded (query result too large) :contentReference[oaicite:37]{index=37}
 *
 * (Some codes may not have public documented meaning or may overlap; always inspect `.message` and `.meta` from the thrown error.)
 */

export interface ServiceError {
  status?: number;
  message?: string;
  stack?: string;
}

/**
 * PrismaError holds the Prisma‐specific error code & message
 */
export interface PrismaError {
  /**
   * Prisma error code, e.g. "P1000", "P2002", etc.
   * See comments below for some meanings.
   */
  code?: string;
  message?: string;
}
