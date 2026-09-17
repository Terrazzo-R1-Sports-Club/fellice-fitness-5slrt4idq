// F2-IMP-006 — Fechamento: remove os registros da prova de herança de contexto
// (appt-contexto-prova-006 + sub-contexto-prova-006). O ambiente volta às 4 fixtures.

migrate(
  (app) => {
    try {
      app.delete(
        app.findFirstRecordByData('lead_appointments', 'appointment_id', 'appt-contexto-prova-006'),
      )
    } catch (_) {}
    try {
      app.delete(
        app.findFirstRecordByData(
          'lead_submissions',
          'lead_submission_id',
          'sub-contexto-prova-006',
        ),
      )
    } catch (_) {}
  },
  (app) => {
    // down: sem restauração — dado de prova
  },
)
