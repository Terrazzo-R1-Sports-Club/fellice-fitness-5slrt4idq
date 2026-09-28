// Fase 3 / SPEC-3-002 — policy do dashboard e baseline versionado append-only.
// A coleção só pode ser alterada pelas rotas controladas do hook; acesso direto fechado.
// Matriz e critério começam pendentes; sem confirmação explícita do Champion não há
// acesso de Marketing nem criação de baseline (B3-04/B3-05; nenhum GREEN presumido).

migrate(
  (app) => {
    // O papel marketing só fica disponível para contas criadas após decisão B3-04.
    const users = app.findCollectionByNameOrId('users')
    const roleField = users.fields.getByName('role')
    const roleValues = roleField.values || []
    if (roleValues.indexOf('marketing') < 0) roleField.values = roleValues.concat(['marketing'])
    app.save(users)

    const policy = new Collection({
      name: 'lead_dashboard_policy',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'singleton_id', type: 'text', required: true, max: 40 },
        { name: 'read_roles', type: 'json', required: true },
        { name: 'b3_04_confirmed', type: 'bool' },
        { name: 'b3_04_marketing_aggregates_only', type: 'bool' },
        { name: 'b3_04_confirmed_by', type: 'text', max: 120 },
        { name: 'b3_04_confirmed_at', type: 'date' },
        { name: 'b3_05_confirmed', type: 'bool' },
        { name: 'b3_05_criterion', type: 'text', max: 500 },
        { name: 'b3_05_confirmed_by', type: 'text', max: 120 },
        { name: 'b3_05_confirmed_at', type: 'date' },
        { name: 'updated_by', type: 'text', max: 120 },
        { name: 'updated_at', type: 'date', required: true },
        { name: 'reason', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_dashboard_policy_singleton` ON `lead_dashboard_policy` (`singleton_id`)',
      ],
    })
    app.save(policy)

    const policyRecord = new Record(policy)
    policyRecord.set('singleton_id', 'default')
    policyRecord.set('read_roles', ['champion', 'gestao', 'supervisora'])
    policyRecord.set('b3_04_confirmed', false)
    policyRecord.set('b3_04_marketing_aggregates_only', false)
    policyRecord.set('b3_05_confirmed', false)
    policyRecord.set('updated_at', new Date().toISOString())
    policyRecord.set('updated_by', 'migration-0052')
    policyRecord.set(
      'reason',
      'B3-04/B3-05 aguardam confirmação do Champion; baseline indisponível',
    )
    app.save(policyRecord)

    const policyEvents = new Collection({
      name: 'lead_dashboard_policy_events',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'event_id', type: 'text', required: true, max: 120 },
        {
          name: 'action',
          type: 'select',
          required: true,
          values: ['B3_04_CONFIRMED', 'B3_05_CONFIRMED'],
          maxSelect: 1,
        },
        { name: 'occurred_at', type: 'date', required: true },
        { name: 'actor_id', type: 'text', required: true, max: 120 },
        { name: 'reason', type: 'text', required: true, max: 500 },
        { name: 'payload', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_dashboard_policy_event` ON `lead_dashboard_policy_events` (`event_id`)',
      ],
    })
    app.save(policyEvents)

    const baseline = new Collection({
      name: 'lead_dashboard_baseline',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'baseline_id', type: 'text', required: true, max: 120 },
        { name: 'version', type: 'number', required: true, min: 1, onlyInt: true },
        { name: 'period_from', type: 'date', required: true },
        { name: 'period_to', type: 'date', required: true },
        { name: 'numerador', type: 'number', required: true, min: 0, onlyInt: true },
        { name: 'denominador', type: 'number', required: true, min: 0, onlyInt: true },
        { name: 'taxa', type: 'number' },
        { name: 'cobertura', type: 'number' },
        { name: 'total_submissoes', type: 'number', required: true, min: 0, onlyInt: true },
        { name: 'formula', type: 'text', required: true, max: 300 },
        { name: 'frozen_at', type: 'date', required: true },
        { name: 'frozen_by', type: 'text', required: true, max: 120 },
        { name: 'reason', type: 'text', required: true, max: 500 },
        { name: 'freeze_criterion', type: 'text', required: true, max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_dashboard_baseline_id` ON `lead_dashboard_baseline` (`baseline_id`)',
        'CREATE UNIQUE INDEX `idx_dashboard_baseline_version` ON `lead_dashboard_baseline` (`version`)',
      ],
    })
    app.save(baseline)

    const baselineEvents = new Collection({
      name: 'lead_dashboard_baseline_events',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'event_id', type: 'text', required: true, max: 120 },
        { name: 'baseline_id', type: 'text', required: true, max: 120 },
        { name: 'action', type: 'select', required: true, values: ['FROZEN'], maxSelect: 1 },
        { name: 'occurred_at', type: 'date', required: true },
        { name: 'actor_id', type: 'text', required: true, max: 120 },
        { name: 'reason', type: 'text', required: true, max: 500 },
        { name: 'payload', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_dashboard_baseline_event` ON `lead_dashboard_baseline_events` (`event_id`)',
      ],
    })
    app.save(baselineEvents)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('lead_dashboard_baseline_events'))
    app.delete(app.findCollectionByNameOrId('lead_dashboard_baseline'))
    app.delete(app.findCollectionByNameOrId('lead_dashboard_policy_events'))
    app.delete(app.findCollectionByNameOrId('lead_dashboard_policy'))
    // O valor 'marketing' permanece no select para não invalidar eventual conta
    // criada por um administrador antes do rollback desta migração.
  },
)
