const { createClient } = require('@libsql/client');

const client = createClient({
  url: 'libsql://ms-dmoyano-dev.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODMyMDIwNzUsImlkIjoiMDE5ZjJmMWYtNjQwMS03YWJlLTg2NjMtZDlhNjNiYTg0MjdmIiwia2lkIjoieEVLQm1VZk1fQk1rZHVpMGlteUZ5RWhwSkl2UFVwb2gtVE5kZ0dJcUM3WSIsInJpZCI6IjFhMjg4MWJjLWI3ZGQtNGZiMC1hNWFiLWYyYWQ3NGI3NzQ5YyJ9.oJElTy-Gb36wEbDQtIuT4bfz7OoXlsTx8Ll-EHU_h1f6J94PtQt6ZDLjtdXjxnfS1uCPsAm5PV3Tm1hBgqtKCw',
});

async function run() {
  console.log("Checking recent readings in Turso...");
  try {
    const res = await client.execute("SELECT id, machine_id, month, initial, final, net_amount, iva_amount, total_amount, reading_status FROM readings LIMIT 10");
    console.log(`Found ${res.rows.length} readings:`);
    for (const row of res.rows) {
      console.log(`ID: ${row.id}`);
      console.log(`Machine ID: ${row.machine_id}`);
      console.log(`Month: ${row.month}`);
      console.log(`Initial: ${row.initial} | Final: ${row.final}`);
      console.log(`Net: ${row.net_amount} | IVA: ${row.iva_amount} | Total: ${row.total_amount}`);
      console.log(`Status: ${row.reading_status}`);
      console.log("-".repeat(50));
    }
  } finally {
    client.close();
  }
}

run();
