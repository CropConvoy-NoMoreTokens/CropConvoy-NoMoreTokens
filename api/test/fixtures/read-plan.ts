// Separate process used by the restart check; never print credentials.
import { Pool } from 'pg';
import { createPlanRepository } from '../../src/modules/workflow/repository.js';
import { createDependencies } from '../../src/core/dependencies.js';
const pool = new Pool({ connectionString: process.env.P4_TEST_DATABASE_URL,
  options: `-c search_path=${process.env.P4_TEST_SCHEMA}` });
const deps = createDependencies({ stub: true, maxPlanMs: 45000 });
deps.persistence = 'postgres';
deps.db = { query: (sql, values) => pool.query(sql, values), async ping() {}, async close() { await pool.end(); } };
try { console.log(JSON.stringify(await createPlanRepository(deps).get(process.argv[2]))); }
finally { await pool.end(); }
