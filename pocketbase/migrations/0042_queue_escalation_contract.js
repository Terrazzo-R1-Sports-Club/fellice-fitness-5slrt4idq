// F2-IMP-008 / SPEC-2-002 — contrato de escalada, reatribuição, encerramento e rollback.
// Decisões operacionais: turnos 08:00–12:00, 12:00–16:00 e 16:00–20:00;
// papel próprio supervisora; encerramento mantém ENCAMINHAMENTO_HUMANO com
// closed_at/motivo_encerramento; reatribuição exclusiva de gestao/supervisora.

migrate(
  (app) => {
    const appointments = app.findCollectionByNameOrId('lead_appointments')
    const add = (collection, field) => {
      if (!collection.fields.getByName(field.name)) collection.fields.add(field)
    }

    add(
      appointments,
      new SelectField({
        name: 'turno_origem',
        values: ['MANHA', 'TARDE', 'NOITE', 'FORA_TURNO'],
        maxSelect: 1,
      }),
    )
    add(appointments, new DateField({ name: 'turno_fim_at' }))
    add(appointments, new DateField({ name: 'escalated_at' }))
    add(appointments, new DateField({ name: 'closed_at' }))
    add(appointments, new TextField({ name: 'motivo_encerramento', max: 500 }))
    add(
      appointments,
      new TextField({ name: 'queue_operation', max: 32, hidden: true, presentable: false }),
    )

    // Consultor lê a fila humana e seus casos atribuídos; gestão, supervisora e
    // champion consultam todos. Atualizações controladas passam pelas rotas atômicas.
    appointments.listRule =
      '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora" || (@request.auth.role = "consultor" && (dono = @request.auth.id || status = "ENCAMINHAMENTO_HUMANO")))'
    appointments.viewRule = appointments.listRule
    appointments.updateRule =
      '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora" || @request.auth.role = "consultor")'
    app.save(appointments)

    const users = app.findCollectionByNameOrId('users')
    const role = users.fields.getByName('role')
    const roles = role.values || []
    if (roles.indexOf('supervisora') < 0) role.values = roles.concat(['supervisora'])
    app.save(users)

    const events = app.findCollectionByNameOrId('lead_appointment_events')
    const eventType = events.fields.getByName('event_type')
    const eventValues = eventType.values || []
    const newEvents = ['APPOINTMENT_ESCALATED', 'APPOINTMENT_REASSIGNED', 'APPOINTMENT_CLOSED']
    for (const value of newEvents) {
      if (eventValues.indexOf(value) < 0) eventValues.push(value)
    }
    eventType.values = eventValues
    events.listRule =
      '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora" || @request.auth.role = "consultor")'
    events.viewRule = events.listRule
    app.save(events)

    // Backfill do turno de origem para registros existentes. O horário operacional
    // é Salvador (UTC-3); fora da grade não recebe prazo automático de escalada.
    const rows = app.findRecordsByFilter('lead_appointments', '', '', 0, 0)
    for (const row of rows) {
      if (row.getString('turno_origem', '')) continue
      const raw = row.getString('created_at', '')
      const parsed = new Date(raw.replace(' ', 'T'))
      if (Number.isNaN(parsed.getTime())) {
        row.set('turno_origem', 'FORA_TURNO')
        app.save(row)
        continue
      }
      const local = new Date(parsed.getTime() - 3 * 60 * 60 * 1000)
      const hour = local.getUTCHours()
      let shift = 'FORA_TURNO'
      let endHour = 0
      if (hour >= 8 && hour < 12) {
        shift = 'MANHA'
        endHour = 12
      } else if (hour >= 12 && hour < 16) {
        shift = 'TARDE'
        endHour = 16
      } else if (hour >= 16 && hour < 20) {
        shift = 'NOITE'
        endHour = 20
      }
      row.set('turno_origem', shift)
      if (shift !== 'FORA_TURNO') {
        row.set(
          'turno_fim_at',
          new Date(
            Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), endHour + 3),
          ).toISOString(),
        )
      }
      app.save(row)
    }

    const settings = new Collection({
      name: 'lead_queue_settings',
      type: 'base',
      listRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora" || @request.auth.role = "consultor")',
      viewRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora" || @request.auth.role = "consultor")',
      createRule: null,
      updateRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora")',
      deleteRule: null,
      fields: [
        { name: 'singleton_id', type: 'text', required: true, max: 40 },
        { name: 'enabled', type: 'bool' },
        { name: 'updated_at', type: 'date', required: true },
        { name: 'updated_by', type: 'text', max: 120 },
        { name: 'reason', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_queue_settings_singleton` ON `lead_queue_settings` (`singleton_id`)',
      ],
    })
    app.save(settings)
    try {
      app.findFirstRecordByData('lead_queue_settings', 'singleton_id', 'default')
    } catch (_) {
      const setting = new Record(settings)
      setting.set('singleton_id', 'default')
      setting.set('enabled', true)
      setting.set('updated_at', new Date().toISOString())
      setting.set('updated_by', 'migration-0042')
      setting.set('reason', 'Fila F2-IMP-008 habilitada no ambiente de teste')
      app.save(setting)
    }

    const controls = new Collection({
      name: 'lead_queue_control_events',
      type: 'base',
      listRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora")',
      viewRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora")',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'event_id', type: 'text', required: true, max: 120 },
        {
          name: 'action',
          type: 'select',
          required: true,
          values: ['ROLLBACK', 'RESTORE'],
          maxSelect: 1,
        },
        { name: 'occurred_at', type: 'date', required: true },
        { name: 'actor_id', type: 'text', required: true, max: 120 },
        { name: 'reason', type: 'text', required: true, max: 500 },
        { name: 'previous_enabled', type: 'bool' },
        { name: 'enabled', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_queue_control_events_event` ON `lead_queue_control_events` (`event_id`)',
      ],
    })
    app.save(controls)
  },
  (app) => {
    const appointments = app.findCollectionByNameOrId('lead_appointments')
    for (const name of [
      'turno_origem',
      'turno_fim_at',
      'escalated_at',
      'closed_at',
      'motivo_encerramento',
      'queue_operation',
    ]) {
      if (appointments.fields.getByName(name)) appointments.fields.removeByName(name)
    }
    appointments.listRule =
      '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")'
    appointments.viewRule = appointments.listRule
    appointments.updateRule = appointments.listRule
    app.save(appointments)

    const users = app.findCollectionByNameOrId('users')
    const role = users.fields.getByName('role')
    role.values = (role.values || []).filter((value) => value !== 'supervisora')
    app.save(users)

    const events = app.findCollectionByNameOrId('lead_appointment_events')
    const eventType = events.fields.getByName('event_type')
    eventType.values = (eventType.values || []).filter(
      (value) =>
        !['APPOINTMENT_ESCALATED', 'APPOINTMENT_REASSIGNED', 'APPOINTMENT_CLOSED'].includes(value),
    )
    events.listRule =
      '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")'
    events.viewRule = events.listRule
    app.save(events)

    try {
      app.delete(app.findCollectionByNameOrId('lead_queue_control_events'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('lead_queue_settings'))
    } catch (_) {}
  },
)
