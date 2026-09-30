// Fase 3 / SPEC-3-002 — aplica as decisões canônicas B3-04/B3-05.
// Migrações 0052/0053 permanecem imutáveis. Campos novos são aditivos.
// Down reverte a policy ativa, mas preserva esquema e versões/eventos históricos.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const roleField = users.fields.getByName('role')
    const roleValues = roleField.values || []
    if (roleValues.indexOf('subgerente') < 0) {
      roleField.values = roleValues.concat(['subgerente'])
    }

    // Impede autoatribuição/alteração de papel pela API pública; superusers continuam
    // podendo provisionar e ajustar contas no painel. Demais updates de perfil seguem permitidos.
    users.createRule = '@request.body.role:isset = false'
    users.updateRule = 'id = @request.auth.id && @request.body.role:changed = false'
    app.save(users)

    const policyCollection = app.findCollectionByNameOrId('lead_dashboard_policy')
    if (!policyCollection.fields.getByName('b3_05_coverage_threshold')) {
      policyCollection.fields.add(
        new NumberField({ name: 'b3_05_coverage_threshold', min: 0, max: 1 }),
      )
    }
    app.save(policyCollection)

    const policy = app.findFirstRecordByData('lead_dashboard_policy', 'singleton_id', 'default')
    policy.set('read_roles', ['champion', 'gestao', 'supervisora', 'subgerente'])
    policy.set('b3_04_confirmed', true)
    policy.set('b3_04_marketing_aggregates_only', false)
    policy.set('b3_04_confirmed_by', 'Champion Karol; ver documento canônico da Fase 3')
    policy.set('b3_04_confirmed_at', '2026-09-29T00:00:00.000Z')
    policy.set('b3_05_confirmed', true)
    policy.set(
      'b3_05_criterion',
      'Baseline: mês civil completo anterior em America/Bahia; B3-02 mantém padrão móvel de 30 dias. Suficiência: nome não vazio, telefone BR reconhecível e proximidade elegível, dividido pelas submissões; limiar 50%. Abaixo pode salvar INSUFICIENTE; denominador zero pode salvar NAO_CALCULAVEL com taxa nula. Leitura parcial bloqueia; só Champion congela; versões append-only.',
    )
    policy.set('b3_05_coverage_threshold', 0.5)
    policy.set('b3_05_confirmed_by', 'Champion Karol; ver documento canônico da Fase 3')
    policy.set('b3_05_confirmed_at', '2026-09-29T00:00:00.000Z')
    policy.set('updated_by', 'migration-0054')
    policy.set('updated_at', new Date().toISOString())
    policy.set(
      'reason',
      'Migration 0054 aplicou as decisões B3-04/B3-05 já registradas no documento canônico em 29/09/2026',
    )
    app.save(policy)

    const baselines = app.findCollectionByNameOrId('lead_dashboard_baseline')
    if (!baselines.fields.getByName('status_calculo')) {
      baselines.fields.add(
        new SelectField({
          name: 'status_calculo',
          values: ['CALCULAVEL', 'NAO_CALCULAVEL'],
          maxSelect: 1,
        }),
      )
    }
    if (!baselines.fields.getByName('status_suficiencia')) {
      baselines.fields.add(
        new SelectField({
          name: 'status_suficiencia',
          values: ['SUFICIENTE', 'INSUFICIENTE', 'NAO_CALCULAVEL'],
          maxSelect: 1,
        }),
      )
    }
    if (!baselines.fields.getByName('cobertura_suficiencia')) {
      baselines.fields.add(new NumberField({ name: 'cobertura_suficiencia', min: 0, max: 1 }))
    }
    if (!baselines.fields.getByName('submissoes_suficientes')) {
      baselines.fields.add(
        new NumberField({ name: 'submissoes_suficientes', min: 0, onlyInt: true }),
      )
    }
    if (!baselines.fields.getByName('limiar_cobertura')) {
      baselines.fields.add(new NumberField({ name: 'limiar_cobertura', min: 0, max: 1 }))
    }
    if (!baselines.fields.getByName('period_timezone')) {
      baselines.fields.add(new TextField({ name: 'period_timezone', max: 80 }))
    }
    app.save(baselines)
  },
  (app) => {
    // Não apagar campos, enumerações nem registros: preserva baseline/eventos append-only.
    const users = app.findCollectionByNameOrId('users')
    users.createRule = ''
    users.updateRule = 'id = @request.auth.id'
    app.save(users)

    const policy = app.findFirstRecordByData('lead_dashboard_policy', 'singleton_id', 'default')
    policy.set('read_roles', ['champion', 'gestao', 'supervisora'])
    policy.set('b3_04_confirmed', false)
    policy.set('b3_04_marketing_aggregates_only', false)
    policy.set('b3_04_confirmed_by', '')
    policy.set('b3_04_confirmed_at', '')
    policy.set('b3_05_confirmed', false)
    policy.set('b3_05_criterion', '')
    policy.set('b3_05_confirmed_by', '')
    policy.set('b3_05_confirmed_at', '')
    policy.set('updated_by', 'migration-0054-down')
    policy.set('updated_at', new Date().toISOString())
    policy.set('reason', 'Policy B3-04/B3-05 revertida; histórico e esquema aditivo preservados')
    app.save(policy)
  },
)
