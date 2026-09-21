// F2-IMP-008 — limpeza pós-aceite e restauração do ambiente de teste.
// Remove somente fixtures, eventos e usuários sintéticos criados para a task e para
// seus debugs/retestes. Preserva as fixtures-base 0001..0004 e o evento de assunção
// da F2-IMP-007 em appt-teste-0004, restaurando apenas os campos alterados nesta task.

migrate(
  (app) => {
    const appointmentIds = [
      'appt-escalada-008',
      'appt-reatribuicao-008',
      'appt-reatribuicao-008b',
      'appt-debug-008r2',
      'appt-debug-008r3',
      'appt-debug-008r4',
      'appt-debug-008r5',
      'appt-reval-008-20260921',
    ]
    let removedEvents = 0
    let removedAppointments = 0
    let removedUsers = 0
    let removedControlEvents = 0

    const deleteEventsForAppointment = (appointmentId) => {
      let rows = []
      try {
        rows = app.findRecordsByFilter(
          'lead_appointment_events',
          'appointment_id = {:id}',
          '',
          0,
          0,
          { id: appointmentId },
        )
      } catch (err) {
        console.log('0046 filtro de eventos falhou', appointmentId, String(err))
      }
      for (const row of rows) {
        try {
          app.delete(row)
          removedEvents++
        } catch (err) {
          console.log('0046 delete evento falhou', appointmentId, String(err))
        }
      }
    }

    // 1. Eventos e appointments das fixtures sintéticas da F2-IMP-008 e dos debugs.
    for (const appointmentId of appointmentIds) deleteEventsForAppointment(appointmentId)
    for (const appointmentId of appointmentIds) {
      try {
        app.delete(app.findFirstRecordByData('lead_appointments', 'appointment_id', appointmentId))
        removedAppointments++
      } catch (err) {
        console.log('0046 delete tentativa ausente', appointmentId, String(err))
      }
    }

    // 2. Limpa somente os eventos operacionais da F2-IMP-008 na fixture-base 0004.
    // Mantém APPOINTMENT_HANDOFF e APPOINTMENT_ASSUMED, que pertencem às provas anteriores.
    try {
      const baseEvents = app.findRecordsByFilter(
        'lead_appointment_events',
        'appointment_id = {:id}',
        '',
        0,
        0,
        { id: 'appt-teste-0004' },
      )
      for (const event of baseEvents) {
        const type = event.getString('event_type', '')
        if (
          type === 'APPOINTMENT_ESCALATED' ||
          type === 'APPOINTMENT_REASSIGNED' ||
          type === 'APPOINTMENT_CLOSED'
        ) {
          app.delete(event)
          removedEvents++
        }
      }
    } catch (err) {
      console.log('0046 limpeza de eventos da fixture-base falhou', String(err))
    }

    // 3. Restaura a fixture-base 0004 ao estado pós-F2-IMP-007.
    try {
      const base = app.findFirstRecordByData(
        'lead_appointments',
        'appointment_id',
        'appt-teste-0004',
      )
      base.set('dono', 'h2ki0bsobuz7780')
      base.set('assumed_at', '2026-09-17 21:01:22.301Z')
      base.set('responsavel_anterior', '')
      base.set('escalated_at', '')
      base.set('closed_at', '')
      base.set('motivo_encerramento', '')
      base.set('queue_operation', '')
      app.save(base)
    } catch (err) {
      console.log('0046 restauração da fixture-base falhou', String(err))
    }

    // 4. Remove os usuários sintéticos temporários da F2-IMP-008.
    const emails = [
      'gestao.f2imp008@fellice-fitness.local',
      'supervisora.f2imp008@fellice-fitness.local',
      'consultor.f2imp008@fellice-fitness.local',
    ]
    for (const email of emails) {
      try {
        app.delete(app.findFirstRecordByData('users', 'email', email))
        removedUsers++
      } catch (err) {
        console.log('0046 delete usuário ausente', email, String(err))
      }
    }

    // 5. Eventos de controle foram criados apenas pela prova sintética de rollback.
    try {
      const controls = app.findRecordsByFilter('lead_queue_control_events', '', '', 0, 0)
      for (const event of controls) {
        app.delete(event)
        removedControlEvents++
      }
    } catch (err) {
      console.log('0046 limpeza de eventos de controle falhou', String(err))
    }

    // 6. A fila termina habilitada, sem motivo/ator de teste persistido.
    try {
      const settings = app.findFirstRecordByData('lead_queue_settings', 'singleton_id', 'default')
      settings.set('enabled', true)
      settings.set('updated_at', new Date().toISOString())
      settings.set('updated_by', 'migration-0046-cleanup')
      settings.set('reason', 'Fila habilitada após limpeza do teste F2-IMP-008')
      app.save(settings)
    } catch (err) {
      console.log('0046 restauração do controle da fila falhou', String(err))
    }

    console.log(
      '0046 limpeza F2-IMP-008:',
      removedEvents,
      'eventos,',
      removedAppointments,
      'appointments,',
      removedUsers,
      'usuários e',
      removedControlEvents,
      'eventos de controle removidos',
    )
  },
  (app) => {
    // Down intencionalmente não recria dados de teste removidos após o aceite.
  },
)
