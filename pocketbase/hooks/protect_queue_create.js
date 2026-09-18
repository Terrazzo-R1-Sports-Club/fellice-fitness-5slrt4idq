// F2-IMP-008 — impede que um cliente injete atribuição, escalada ou encerramento
// na criação pública da tentativa. O status inicial continua pertencendo ao fluxo
// público da SPEC-2-001; contexto de turno é calculado por queue_lifecycle.js.

onRecordCreateRequest((e) => {
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
      throw new ForbiddenError('Campos operacionais são definidos pelo servidor.')
    }
  }
  e.next()
}, 'lead_appointments')
