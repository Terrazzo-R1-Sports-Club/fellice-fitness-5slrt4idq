// Fase 3 / SPEC-3-001 — controle de rollback da consolidação.
// Apenas altera a disponibilidade do funil e registra o controle; os eventos de origem ficam intactos.

routerAdd(
  'POST',
  '/backend/v1/funnel/control',
  (e) => {
    const actor = e.auth
    if (!actor) return e.unauthorizedError('Autenticação necessária.')
    const role = actor.getString('role', '')
    if (role !== 'champion' && role !== 'gestao' && role !== 'supervisora') {
      return e.forbiddenError('Sem permissão para controlar a consolidação.')
    }
    const body = e.requestInfo().body || {}
    const action = String(body.action || '').trim()
    const reason = String(body.reason || '').trim()
    if (action !== 'ROLLBACK' && action !== 'RESTORE') {
      return e.badRequestError('Ação de controle inválida.')
    }
    if (!reason) return e.badRequestError('O motivo do controle é obrigatório.')

    let result = null
    $app.runInTransaction((txApp) => {
      const settings = txApp.findFirstRecordByData(
        'lead_funnel_settings',
        'singleton_id',
        'default',
      )
      const previousEnabled = settings.get('enabled') === true
      const enabled = action === 'RESTORE'
      const now = new Date().toISOString()
      settings.set('enabled', enabled)
      settings.set('updated_at', now)
      settings.set('updated_by', actor.id)
      settings.set('reason', reason)
      txApp.save(settings)

      const event = new Record(txApp.findCollectionByNameOrId('lead_funnel_control_events'))
      event.set('event_id', $security.randomString(32))
      event.set('action', action)
      event.set('occurred_at', now)
      event.set('actor_id', actor.id)
      event.set('reason', reason)
      event.set('previous_enabled', previousEnabled)
      event.set('enabled', enabled)
      txApp.save(event)
      result = {
        action,
        enabled,
        occurred_at: now,
        preserved_source_events: true,
      }
    })
    return e.json(200, result)
  },
  $apis.requireAuth(),
)
