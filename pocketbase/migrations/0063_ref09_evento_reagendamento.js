// REF-09 / SPEC-4-004 — evento de reagendamento na trilha de agendamentos.
// Amplia o select event_type de lead_appointment_events com
// APPOINTMENT_RESCHEDULED (o reagendamento pelo operador grava este evento com
// actor_id do operador e payload from/to). Nenhum valor existente muda.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('lead_appointment_events')
    const et = col.fields.getByName('event_type')
    if (!et.values.includes('APPOINTMENT_RESCHEDULED')) {
      et.values = et.values.concat(['APPOINTMENT_RESCHEDULED'])
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('lead_appointment_events')
    const et = col.fields.getByName('event_type')
    et.values = et.values.filter((v) => v !== 'APPOINTMENT_RESCHEDULED')
    app.save(col)
  },
)
