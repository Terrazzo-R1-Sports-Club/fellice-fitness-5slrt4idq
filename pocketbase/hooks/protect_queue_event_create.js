// F2-IMP-008 — impede criação direta de eventos operacionais pela API pública.
// O fluxo público continua podendo criar CREATED/CONCLUDED/HANDOFF; eventos de
// assunção, escalada, reatribuição e encerramento só nascem nas rotas atômicas.

onRecordCreateRequest((e) => {
  const body = e.requestInfo().body || {}
  const eventType = String(body.event_type || '')
  const controlled = [
    'APPOINTMENT_ASSUMED',
    'APPOINTMENT_ESCALATED',
    'APPOINTMENT_REASSIGNED',
    'APPOINTMENT_CLOSED',
  ]
  if (controlled.indexOf(eventType) >= 0) {
    const actor = e.auth
    const role = actor ? actor.getString('role', '') : ''
    if (role !== 'champion' && role !== 'gestao' && role !== 'supervisora') {
      throw new ForbiddenError('Evento operacional deve ser criado pela ação autorizada.')
    }
    throw new ForbiddenError('Use a rota atômica da fila para registrar este evento.')
  }
  e.next()
}, 'lead_appointment_events')
