// F2-IMP-004 — DEBUG: limpeza das reservas sintéticas excedentes criadas antes do
// controle de capacidade (e das provas de concorrência/desistência da task).
// Remove todas as tentativas de prova (f2imp3/f2imp4/diagnóstico/ricardo/prova-publica)
// e os UUIDs de teste humano, deixando o ambiente limpo para o teste humano da correção.
// As fixtures canônicas da 0008 (appt-teste-0001..0004) permanecem.

migrate(
  (app) => {
    const remove = (collection, field, value) => {
      try {
        app.delete(app.findFirstRecordByData(collection, field, value))
      } catch (_) {}
    }

    const apptIds = [
      'appt-diagnostico-001',
      'appt-f2imp3-green-001',
      'appt-f2imp3-handoff-001',
      'appt-f2imp4-conflito-A',
      'appt-f2imp4-conflito-B',
      'appt-f2imp4-conflito-B2',
      'appt-f2imp4-desiste-C',
      'appt-f2imp4-libera-D',
      'appt-prova-publica-001',
      'appt-teste-ricardo-001',
    ]
    apptIds.forEach((id) => remove('lead_appointments', 'appointment_id', id))

    // eventos órfãos das provas (mantém os das fixtures)
    const events = app.findRecordsByFilter(
      'lead_appointment_events',
      "event_id ~ 'f2imp' || event_id ~ 'ocupacao-teste'",
      '-occurred_at',
      0,
      0,
    )
    events.forEach((e) => app.delete(e))

    // zera a ocupação (todas as reservas de teste removidas)
    const occupancy = app.findRecordsByFilter('agenda_slot_occupancy', 'active > 0', '', 0, 0)
    occupancy.forEach((row) => {
      row.set('active', 0)
      app.save(row)
    })
  },
  (app) => {
    // down: sem restauração — os registros eram de prova
  },
)
