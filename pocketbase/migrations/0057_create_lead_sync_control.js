// Fase 4 / TAREFA 2 — configuração e trilha de controle de sincronização de leads (lead_sync).
// Modelo singleton espelhado em lead_queue_settings e lead_funnel_settings.
// O rollback/desativação altera somente a disponibilidade da sincronização;
// nunca remove nem afeta eventos de origem.

migrate(
  (app) => {
    const settings = new Collection({
      name: 'lead_sync_settings',
      type: 'base',
      listRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora" || @request.auth.role = "subgerente")',
      viewRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora" || @request.auth.role = "subgerente")',
      createRule: null,
      updateRule: null,
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
      indexes: [],
    })
    app.save(settings)

    const controlEvents = new Collection({
      name: 'lead_sync_control_events',
      type: 'base',
      listRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora" || @request.auth.role = "subgerente")',
      viewRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora" || @request.auth.role = "subgerente")',
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
      indexes: [],
    })
    app.save(controlEvents)

    const record = new Record(settings)
    record.set('singleton_id', 'default')
    record.set('enabled', true)
    record.set('updated_at', new Date().toISOString())
    record.set('updated_by', 'migration-0057')
    record.set('reason', 'Controle de sincronização de leads habilitado no ambiente de teste')
    app.save(record)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('lead_sync_control_events'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('lead_sync_settings'))
    } catch (_) {}
  },
)
