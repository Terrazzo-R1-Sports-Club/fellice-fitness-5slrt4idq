// F2-IMP-008 — leitura de configuração e de eventos de controle para a visão.
// Mantém o rollback observável para os papéis de liderança.

routerAdd(
  'GET',
  '/backend/v1/queue/control',
  (e) => {
    const actor = e.auth
    if (!actor) return e.unauthorizedError('Autenticação necessária.')
    const role = actor.getString('role', '')
    if (role !== 'champion' && role !== 'gestao' && role !== 'supervisora') {
      return e.forbiddenError('Sem permissão para consultar o controle da fila.')
    }
    const settings = $app.findFirstRecordByData('lead_queue_settings', 'singleton_id', 'default')
    const events = $app.findRecordsByFilter('lead_queue_control_events', '', '-occurred_at', 50, 0)
    return e.json(200, {
      enabled: settings.get('enabled') === true,
      updated_at: settings.getString('updated_at', ''),
      updated_by: settings.getString('updated_by', ''),
      reason: settings.getString('reason', ''),
      events: events,
    })
  },
  $apis.requireAuth(),
)
