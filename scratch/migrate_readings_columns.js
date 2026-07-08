const { createClient } = require('@libsql/client');

const client = createClient({
  url: 'libsql://ms-dmoyano-dev.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODMyMDIwNzUsImlkIjoiMDE5ZjJmMWYtNjQwMS03YWJlLTg2NjMtZDlhNjNiYTg0MjdmIiwia2lkIjoieEVLQm1VZk1fQk1rZHVpMGlteUZ5RWhwSkl2UFVwb2gtVE5kZ0dJcUM3WSIsInJpZCI6IjFhMjg4MWJjLWI3ZGQtNGZiMC1hNWFiLWYyYWQ3NGI3NzQ5YyJ9.oJElTy-Gb36wEbDQtIuT4bfz7OoXlsTx8Ll-EHU_h1f6J94PtQt6ZDLjtdXjxnfS1uCPsAm5PV3Tm1hBgqtKCw',
});

async function run() {
  console.log("Migrating readings table in Turso - adding financial columns...");
  try {
    const queries = [
      "ALTER TABLE readings ADD COLUMN excess_count INTEGER DEFAULT 0 NOT NULL",
      "ALTER TABLE readings ADD COLUMN excess_price REAL DEFAULT 0 NOT NULL",
      "ALTER TABLE readings ADD COLUMN net_amount REAL DEFAULT 0 NOT NULL",
      "ALTER TABLE readings ADD COLUMN iva_amount REAL DEFAULT 0 NOT NULL",
      "ALTER TABLE readings ADD COLUMN total_amount REAL DEFAULT 0 NOT NULL"
    ];
    
    for (const q of queries) {
      console.log(`Executing: ${q}`);
      try {
        await client.execute(q);
        console.log("Success!");
      } catch (err) {
        if (err.message.includes("duplicate column name") || err.message.includes("already exists")) {
          console.log("Column already exists, skipping.");
        } else {
          throw err;
        }
      }
    }
    
    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    client.close();
  }
}

run();
