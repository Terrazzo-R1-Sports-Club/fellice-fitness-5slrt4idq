// F2-IMP-007 / SPEC-2-002 — campos de assunção de tentativa (CA-2.07).
// Fila única (F2-T004): a tentativa em ENCAMINHAMENTO_HUMANO entra sem dono e é
// assumida pelo primeiro consultor disponível; a assunção registra dono e assumed_at
// (RN-2.08). Mesmo contrato da fila F1 (lead_handoffs). Novo evento APPOINTMENT_ASSUMED.

migrate(
  (app) => {
    // 1. campos em lead_appointments
    const appointments = app.findCollectionByNameOrId('lead_appointments')
    const addField = (collection, name, type, max) => {
      let exists = false
      const all = collection.fields.getAll ? collection.fields.getAll() : []
      for (const f of all) {
        if (f.name === name) {
          exists = true
          break
        }
      }
      if (!exists) {
        collection.fields.add(new Field({ name: name, type: type, max: max }))
      }
    }
    addField(appointments, 'dono', 'text', 120)
    addField(appointments, 'assumed_at', 'date')
    addField(appointments, 'responsavel_anterior', 'text', 120)
    app.save(appointments)

    // 2. novo tipo de evento APPOINTMENT_ASSUMED no select da coleção de eventos
    const events = app.findCollectionByNameOrId('lead_appointment_events')
    const statusField = events.fields.getByName('event_type')
    const values = statusField.values || []
    if (values.indexOf('APPOINTMENT_ASSUMED') < 0) {
      statusField.values = values.concat(['APPOINTMENT_ASSUMED'])
    }
    app.save(events)
  },
  (app) => {
    const appointments = app.findCollectionByNameOrId('lead_appointments')
    const names = ['dono', 'assumed_at', 'responsavel_anterior']
    const all = appointments.fields.getAll ? appointments.fields.getAll() : []
    for (const f of all) {
      if (names.indexOf(f.name) >= 0) {
        appointments.fields.remove(f)
      }
    }
    app.save(appointments)
    // o evento APPOINTMENT_ASSUMED permanece no select (inofensivo sem uso)
  },
)
