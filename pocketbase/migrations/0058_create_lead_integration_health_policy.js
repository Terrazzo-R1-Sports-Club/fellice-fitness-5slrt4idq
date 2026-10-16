// Fase 4 / TAREFA 3 — Matriz de acesso do painel de saúde da integração (decisão B4-03).
// Singleton lead_integration_health_policy.
// REGRA DURA B4-03:
// b4_03_confirmed só vira true por migração/evento de controle DEPOIS da decisão registrada
// no repositório (fora do Skip / documento canônico de decisões da Fase 4).
// Como o documento ainda não foi registrado no repositório, esta migração NÃO presume
// aprovação: b4_03_confirmed permanece FALSE, gravado como proposta pendente de validação humana.
// lead_dashboard_policy permanece intocada.
// Matriz de proposta: apenas agregados para champion, gestao, supervisora, subgerente.
// Nenhum papel vê contato individual de lead.

migrate(
  (app) => {
    const healthPolicy = new Collection({
      name: 'lead_integration_health_policy',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'singleton_id', type: 'text', required: true, max: 40 },
        { name: 'read_roles', type: 'json', required: true },
        { name: 'b4_03_confirmed', type: 'bool' },
        { name: 'b4_03_confirmed_by', type: 'text', max: 120 },
        { name: 'b4_03_confirmed_at', type: 'date' },
        { name: 'reason', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [],
    })
    app.save(healthPolicy)

    const record = new Record(healthPolicy)
    record.set('singleton_id', 'default')
    // Matriz proposta: agregados visíveis para champion, gestao, supervisora, subgerente;
    // sem acesso para marketing, consultor e demais papéis; nenhum papel vê contato individual.
    record.set('read_roles', ['champion', 'gestao', 'supervisora', 'subgerente'])
    record.set('b4_03_confirmed', false)
    record.set('b4_03_confirmed_by', '')
    record.set('b4_03_confirmed_at', '')
    record.set(
      'reason',
      'Proposta de matriz de acesso ao painel de saúde (B4-03 pendente de confirmação documental humana no repositório; nenhum contato individual visível)',
    )
    app.save(record)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('lead_integration_health_policy'))
    } catch (_) {}
  },
)
