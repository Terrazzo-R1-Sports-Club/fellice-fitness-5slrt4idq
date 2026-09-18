// F2-IMP-008 — ação operacional atômica da fila.
// POST /backend/v1/queue/action
// Ações: ESCALATE, REASSIGN, CLOSE. ROLLBACK é uma ação de controle separada.
// Todas validam o papel e gravam appointment + evento na mesma transação.

routerAdd(
  'POST',
  '/backend/v1/queue/action',
  (e) => {
    const body = e.requestInfo().body || {}
    const action = String(body.action || '')
    const appointmentId = String(body.appointment_id || '')
    const targetOwner = String(body.target_owner || '').trim()
    const actor = e.auth
    if (!actor) return e.unauthorizedError('Autenticação necessária.')
    const role = actor.getString('role', '')
    const reason = String(body.reason || (action === 'ASSUME' ? 'Assunção da fila' : '')).trim()
    const canOperate =
      role === 'champion' ||
      role === 'gestao' ||
      role === 'supervisora' ||
      (role === 'consultor' && action === 'ASSUME')
    const settings = $app.findFirstRecordByData('lead_queue_settings', 'singleton_id', 'default')
    if (settings.get('enabled') !== true) {
      return e.badRequestError('As ações da fila estão temporariamente desativadas.')
    }
    if (!canOperate) return e.forbiddenError('Sem permissão para operar esta ação.')
    if (!appointmentId) return e.badRequestError('appointment_id é obrigatório.')
    if (
      action !== 'ASSUME' &&
      action !== 'ESCALATE' &&
      action !== 'REASSIGN' &&
      action !== 'CLOSE'
    ) {
      return e.badRequestError('Ação operacional inválida.')
    }
    if (!reason) return e.badRequestError('O motivo é obrigatório.')
    if (action === 'REASSIGN' && !targetOwner) {
      return e.badRequestError('target_owner é obrigatório na reatribuição.')
    }
    if (action === 'REASSIGN' && targetOwner === actor.id) {
      return e.badRequestError('A reatribuição precisa apontar para outro responsável.')
    }
    if (action === 'REASSIGN') {
      const target = $app.findRecordById('users', targetOwner)
      const targetRole = target.getString('role', '')
      if (targetRole !== 'consultor')
        return e.badRequestError('O novo responsável deve ser um Consultor Comercial.')
    }

    let result = null
    $app.runInTransaction((txApp) => {
      const appointment = txApp.findFirstRecordByData(
        'lead_appointments',
        'appointment_id',
        appointmentId,
      )
      const beforeStatus = appointment.getString('status', '')
      const beforeOwner = appointment.getString('dono', '')
      const now = new Date().toISOString()
      let eventType = ''
      const operation = action === 'REASSIGN' ? 'REASSIGN' : action

      if (beforeStatus !== 'ENCAMINHAMENTO_HUMANO') {
        throw new BadRequestError('A ação só se aplica a ENCAMINHAMENTO_HUMANO.')
      }
      if (appointment.getString('closed_at', '')) {
        throw new BadRequestError('A tentativa já está encerrada.')
      }
      if (action === 'ASSUME') {
        if (beforeOwner) throw new BadRequestError('Caso já assumido.')
        appointment.set('dono', actor.id)
        appointment.set('assumed_at', now)
        eventType = 'APPOINTMENT_ASSUMED'
      } else if (action === 'ESCALATE') {
        if (appointment.getString('escalated_at', '')) {
          throw new BadRequestError('A tentativa já está sinalizada para escalada.')
        }
        appointment.set('escalated_at', now)
        eventType = 'APPOINTMENT_ESCALATED'
      } else if (action === 'REASSIGN') {
        appointment.set('responsavel_anterior', beforeOwner)
        appointment.set('dono', targetOwner)
        appointment.set('assumed_at', now)
        eventType = 'APPOINTMENT_REASSIGNED'
      } else {
        appointment.set('closed_at', now)
        appointment.set('motivo_encerramento', reason)
        eventType = 'APPOINTMENT_CLOSED'
      }
      appointment.set('queue_operation', operation)
      txApp.save(appointment)

      const event = new Record(txApp.findCollectionByNameOrId('lead_appointment_events'))
      event.set('event_id', $security.randomString(32))
      event.set('appointment_id', appointment.getString('appointment_id', ''))
      event.set('lead_submission_id', appointment.getString('lead_submission_id', ''))
      event.set('event_type', eventType)
      event.set('occurred_at', now)
      event.set('actor_id', actor.id)
      event.set('payload', {
        action: action,
        reason: reason,
        from_owner: beforeOwner,
        to_owner: appointment.getString('dono', ''),
        role: role,
      })
      txApp.save(event)
      appointment.set('queue_operation', '')
      txApp.save(appointment)
      result = {
        appointment_id: appointment.getString('appointment_id', ''),
        action: action,
        event_type: eventType,
        occurred_at: now,
        dono: appointment.getString('dono', ''),
        escalated_at: appointment.getString('escalated_at', ''),
        closed_at: appointment.getString('closed_at', ''),
        status: appointment.getString('status', ''),
      }
    })
    return e.json(200, result)
  },
  $apis.requireAuth(),
)
