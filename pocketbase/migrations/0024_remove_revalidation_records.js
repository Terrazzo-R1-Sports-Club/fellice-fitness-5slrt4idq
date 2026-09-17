// F2-IMP-005 — Fechamento: remove as reservas da revalidação independente
// (provas do CA-2.02 refeitas no fechamento). deleteRule null impede via API.

migrate(
  (app) => {
    const ids = ['appt-reval2-b', 'appt-reval2-c']
    ids.forEach((id) => {
      try {
        app.delete(app.findFirstRecordByData('lead_appointments', 'appointment_id', id))
      } catch (_) {}
    })
  },
  (app) => {
    // down: sem restauração — dados de prova
  },
)
