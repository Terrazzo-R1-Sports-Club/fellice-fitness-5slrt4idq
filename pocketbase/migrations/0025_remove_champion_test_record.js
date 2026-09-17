// F2-IMP-005 — Fechamento (complemento): remove a reserva "tteste" do teste do Champion
// (212fe6a4, slot 1230) e zera a ocupação remanescente. O hook ressincroniza ao apagar.

migrate(
  (app) => {
    try {
      app.delete(
        app.findFirstRecordByData(
          'lead_appointments',
          'appointment_id',
          '212fe6a4-4e17-4a29-8b0e-9d1c0f6a5b31',
        ),
      )
    } catch (_) {}
    // fallback por id interno caso o appointment_id completo difira
    try {
      app.delete(app.findRecordById('lead_appointments', 'pd1n5jyi5nw0m4e'))
    } catch (_) {}
  },
  (app) => {
    // down: sem restauração — dado de teste
  },
)
