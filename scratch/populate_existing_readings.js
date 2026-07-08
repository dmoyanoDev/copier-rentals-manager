const { createClient } = require('@libsql/client');

const client = createClient({
  url: 'libsql://ms-dmoyano-dev.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODMyMDIwNzUsImlkIjoiMDE5ZjJmMWYtNjQwMS03YWJlLTg2NjMtZDlhNjNiYTg0MjdmIiwia2lkIjoieEVLQm1VZk1fQk1rZHVpMGlteUZ5RWhwSkl2UFVwb2gtVE5kZ0dJcUM3WSIsInJpZCI6IjFhMjg4MWJjLWI3ZGQtNGZiMC1hNWFiLWYyYWQ3NGI3NzQ5YyJ9.oJElTy-Gb36wEbDQtIuT4bfz7OoXlsTx8Ll-EHU_h1f6J94PtQt6ZDLjtdXjxnfS1uCPsAm5PV3Tm1hBgqtKCw',
});

function getClientIvaRate(taxCategory) {
  if (taxCategory === 'Responsable Inscripto') {
    return 21;
  }
  return 0;
}

async function run() {
  console.log("Starting historical calculations update in Turso...");
  try {
    // 1. Fetch machines, clients, plans, readings
    const readingsRes = await client.execute("SELECT * FROM readings");
    const machinesRes = await client.execute("SELECT * FROM machines");
    const clientsRes = await client.execute("SELECT * FROM clients");
    const plansRes = await client.execute("SELECT * FROM plans");
    
    console.log(`Loaded ${readingsRes.rows.length} readings, ${machinesRes.rows.length} machines, ${clientsRes.rows.length} clients, ${plansRes.rows.length} plans.`);
    
    const machinesMap = new Map(machinesRes.rows.map(m => [m.id, m]));
    const clientsMap = new Map(clientsRes.rows.map(c => [c.id, c]));
    const plansMap = new Map(plansRes.rows.map(p => [p.id, p]));
    
    let updatedCount = 0;
    for (const r of readingsRes.rows) {
      const mach = machinesMap.get(r.machine_id);
      const clientObj = clientsMap.get(r.client_id || (mach ? mach.client_id : null));
      const plan = plansMap.get(r.abono_id || (mach ? mach.abono_id : null));
      
      const consumed = Math.max(0, (r.final || 0) - (r.initial || 0));
      const limit = plan ? plan.limit : 0;
      const basePrice = plan ? Number(plan.price) || 0 : 0;
      const excessPrice = plan ? Number(plan.excess_price) || 0 : 0;
      
      const excessCount = consumed > limit ? consumed - limit : 0;
      const excessAmount = excessCount * excessPrice;
      const netAmount = basePrice + excessAmount;
      
      const applyIva = mach ? Boolean(mach.apply_iva) : false;
      const ivaRate = (applyIva && clientObj) ? getClientIvaRate(clientObj.tax_category) : 0;
      const ivaAmount = netAmount * (ivaRate / 100);
      const totalAmount = netAmount + ivaAmount;
      
      console.log(`Reading ID: ${r.id} | Consumed: ${consumed} | Base: ${basePrice} | Excess Price: ${excessPrice} | Excess: ${excessCount} | Net: ${netAmount} | Total: ${totalAmount}`);
      
      // Update reading row
      await client.execute({
        sql: "UPDATE readings SET excess_count = ?, excess_price = ?, net_amount = ?, iva_amount = ?, total_amount = ? WHERE id = ?",
        args: [excessCount, excessPrice, netAmount, ivaAmount, totalAmount, r.id]
      });
      updatedCount++;
    }
    
    console.log(`Successfully recalculated and populated ${updatedCount} historical readings in Turso!`);
  } catch (err) {
    console.error("Recalculation error:", err);
  } finally {
    client.close();
  }
}

run();
