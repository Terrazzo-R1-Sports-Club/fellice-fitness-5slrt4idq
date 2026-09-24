// Fase 3 / SPEC-3-001 — configuração e trilha de controle da consolidação.
// O rollback altera somente a disponibilidade do funil; nunca remove eventos de origem.

migrate(
  (app) => {
    const settings = new Collection({
      name: 'lead_funnel_settings',
      type: 'base',
      listRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora")',
      viewRule:
        '@request.auth.id != "" && (@request.auth.role = "champion" || @request.auth.role = "gestao" || @request.auth.role = "supervisora")',
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
      indexes: [
        'CREATE UNIQUE INDEX `idx_lead_funnel_settings_singleton` ON `lead_funnel_settings` (`singleton_id`)',
      ],
    })
    app.save(settings)

    const controlEvents = new Collection({
      name: 'lead_funnel_control_events',
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
        'CREATE UNIQUE INDEX `idx_lead_funnel_control_event` ON `lead_funnel_control_events` (`event_id`)',
      ],
    })
    app.save(controlEvents)

    const record = new Record(settings)
    record.set('singleton_id', 'default')
    record.set('enabled', true)
    record.set('updated_at', new Date().toISOString())
    record.set('updated_by', 'migration-0050')
    record.set('reason', 'Consolidação SPEC-3-001 habilitada no ambiente de teste')
    app.save(record)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('lead_funnel_control_events'))
    app.delete(app.findCollectionByNameOrId('lead_funnel_settings'))
  },
)
