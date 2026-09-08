migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.fields.add(
      new SelectField({ name: 'role', values: ['champion', 'consultor'], maxSelect: 1 }),
    )
    app.save(users)

    const handoffs = new Collection({
      name: 'lead_handoffs',
      type: 'base',
      listRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")',
      viewRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")',
      createRule: '',
      updateRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "consultor")',
      deleteRule: null,
      fields: [
        { name: 'handoff_id', type: 'text', required: true, max: 120 },
        { name: 'lead_submission_id', type: 'text', required: true, max: 120 },
        { name: 'form_id', type: 'text', required: true, max: 120 },
        { name: 'form_version', type: 'text', required: true, max: 40 },
        { name: 'created_at', type: 'date', required: true },
        { name: 'motivo', type: 'text', required: true, max: 200 },
        { name: 'nome', type: 'text', required: true, max: 160 },
        { name: 'canal_de_retorno', type: 'text', required: true, max: 160 },
        { name: 'objetivo', type: 'text', required: true, max: 160 },
        { name: 'proximidade', type: 'text', required: true, max: 200 },
        { name: 'ocupacao', type: 'text', max: 160 },
        { name: 'interesse_em_visita', type: 'text', required: true, max: 160 },
        { name: 'utm_source', type: 'text', max: 160 },
        { name: 'utm_medium', type: 'text', max: 160 },
        { name: 'utm_campaign', type: 'text', max: 160 },
        { name: 'attribution_status', type: 'text', required: true, max: 40 },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['PENDENTE', 'ASSUMIDO', 'ENCERRADO_SEM_AGENDAMENTO'],
          maxSelect: 1,
        },
        { name: 'dono', type: 'text', max: 120 },
        { name: 'assumed_at', type: 'date' },
        { name: 'closed_at', type: 'date' },
        { name: 'motivo_encerramento', type: 'text', max: 500 },
        { name: 'responsavel_anterior', type: 'text', max: 120 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_lead_handoffs_submission` ON `lead_handoffs` (`lead_submission_id`)',
      ],
    })
    app.save(handoffs)

    const events = new Collection({
      name: 'lead_handoff_events',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'event_id', type: 'text', required: true, max: 120 },
        { name: 'handoff_id', type: 'text', required: true, max: 120 },
        { name: 'lead_submission_id', type: 'text', required: true, max: 120 },
        {
          name: 'event_type',
          type: 'select',
          required: true,
          values: [
            'HANDOFF_CREATED',
            'HANDOFF_ASSUMED',
            'HANDOFF_REASSIGNED',
            'HANDOFF_CLOSED',
            'HANDOFF_FAILED',
          ],
          maxSelect: 1,
        },
        { name: 'occurred_at', type: 'date', required: true },
        { name: 'actor_id', type: 'text', max: 120 },
        { name: 'payload', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_handoff_events_event` ON `lead_handoff_events` (`event_id`)',
      ],
    })
    app.save(events)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('lead_handoff_events'))
    app.delete(app.findCollectionByNameOrId('lead_handoffs'))
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.fields.removeByName('role')
    app.save(users)
  },
)
