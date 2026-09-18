// F2-IMP-008 — rollback operacional da fila.
// Desativa/reativa apenas a regra de novas ações; não exclui appointments nem eventos.
// A leitura dos registros existentes permanece disponível conforme RLS.

routerAdd(
  'POST',
  '/backend/v1/queue/rollback',
  (e) => {
    const body = e.requestInfo().body || {}
    const action = String(body.action || '')
    const reason = String(body.reason || '').trim()
    const actor = e.auth
    if (!actor) return e.unauthorizedError('Autenticação necessária.')
    const role = actor.getString('role', '')
    if (role !== 'champion' && role !== 'gestao' && role !== 'supervisora') {
      return e.forbiddenError('Somente Gestão, Supervisora ou Champion pode executar rollback.')
    }
    if (action !== 'ROLLBACK' && action !== 'RESTORE')
      return e.badRequestError('Ação de rollback inválida.')
    if (!reason) return e.badRequestError('O motivo do rollback é obrigatório.')

    let result = null
    $app.runInTransaction((txApp) => {
      const settings = txApp.findFirstRecordByData('lead_queue_settings', 'singleton_id', 'default')
      const previous = settings.get('enabled') === true
      const enabled = action === 'RESTORE'
      const now = new Date().toISOString()
      settings.set('enabled', enabled)
      settings.set('updated_at', now)
      settings.set('updated_by', actor.id)
      settings.set('reason', reason)
      txApp.save(settings)

      const event = new Record(txApp.findCollectionByNameOrId('lead_queue_control_events'))
      event.set('event_id', $security.randomString(32))
      event.set('action', action)
      event.set('occurred_at', now)
      event.set('actor_id', actor.id)
      event.set('reason', reason)
      event.set('previous_enabled', previous)
      event.set('enabled', enabled)
      txApp.save(event)
      result = { action: action, enabled: enabled, occurred_at: now, preserved_records: true }
    })
    return e.json(200, result)
  },
  $apis.requireAuth(),
)
