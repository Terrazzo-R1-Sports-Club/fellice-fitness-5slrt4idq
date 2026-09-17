// F2-IMP-005 — Fechamento (final): remove os 2 registros remanescentes do teste do
// Champion (ddea8248 = fallback do cenário 5, f3bcf5f5 = desistência do cenário 4).
// A base volta a ter exatamente as 4 fixtures sintéticas.

migrate(
  (app) => {
    const ids = ['ddea8248-9ea5-4c', 'f3bcf5f5-5e96-43']
    // remove por prefixo do appointment_id (IDs completos variam)
    const rows = app.findRecordsByFilter('lead_appointments', '', '-created_at', 0, 0)
    rows.forEach((r) => {
      const apptId = r.getString('appointment_id', '')
      if (ids.some((p) => apptId.startsWith(p))) {
        app.delete(r)
      }
    })
  },
  (app) => {
    // down: sem restauração — dados de teste
  },
)
