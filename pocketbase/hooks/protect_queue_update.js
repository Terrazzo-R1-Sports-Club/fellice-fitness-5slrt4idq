// F2-IMP-008 — bloqueia PATCH direto de campos controlados.
// Assunção, escalada, reatribuição e encerramento passam pela rota atômica
// /backend/v1/queue/action, que grava appointment + evento na mesma transação.

onRecordUpdateRequest((e) => {
  const body = e.requestInfo().body || {}
  const controlled = [
    'dono',
    'assumed_at',
    'responsavel_anterior',
    'turno_origem',
    'turno_fim_at',
    'escalated_at',
    'closed_at',
    'motivo_encerramento',
    'queue_operation',
  ]
  for (const field of controlled) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      throw new ForbiddenError('Use a ação operacional autorizada para alterar este campo.')
    }
  }
  e.next()
}, 'lead_appointments')
