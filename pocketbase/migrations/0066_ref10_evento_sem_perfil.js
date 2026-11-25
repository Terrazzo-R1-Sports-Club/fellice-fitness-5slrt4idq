// REF-10 / SPEC-4-004 — evento da classificação "Sem perfil" na trilha de agendamentos.
// Amplia o select event_type de lead_appointment_events com APPOINTMENT_SEM_PERFIL
// (a classificação manual pelo operador grava este evento com actor_id do operador
// e payload {motivo, reversao}). Nenhum valor existente muda.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('lead_appointment_events')
    const et = col.fields.getByName('event_type')
    if (!et.values.includes('APPOINTMENT_SEM_PERFIL')) {
      et.values = et.values.concat(['APPOINTMENT_SEM_PERFIL'])
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('lead_appointment_events')
    const et = col.fields.getByName('event_type')
    et.values = et.values.filter((v) => v !== 'APPOINTMENT_SEM_PERFIL')
    app.save(col)
  },
)
