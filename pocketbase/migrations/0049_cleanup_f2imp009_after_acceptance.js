// F2-IMP-009 — limpeza pós-aceite e restauração do ambiente de teste (padrão 0046).
// Remove somente as fixtures de consolidação (0047) e de reteste (0048), seus eventos,
// os usuários sintéticos temporários e os eventos de controle das provas de rollback.
// Preserva as fixtures-base 0001..0004 e a fila ativa.

migrate(
  (app) => {
    const appointmentIds = [
      'appt-consol-009-tentativa',
      'appt-consol-009-concluido',
      'appt-consol-009-desistencia',
      'appt-consol-009-handoff',
      'appt-consol-009-handoff-assumido',
      'appt-consol-009-fila',
      'appt-reteste-009-fila',
      'appt-reteste-009-rollback',
      'appt-reteste-009-assumido',
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
        console.log('0049 filtro de eventos falhou', appointmentId, String(err))
      }
      for (const row of rows) {
        try {
          app.delete(row)
          removedEvents++
        } catch (err) {
          console.log('0049 delete evento falhou', appointmentId, String(err))
        }
      }
    }

    // 1. Eventos e appointments das fixtures da F2-IMP-009 (0047 e 0048).
    for (const appointmentId of appointmentIds) deleteEventsForAppointment(appointmentId)
    for (const appointmentId of appointmentIds) {
      try {
        app.delete(app.findFirstRecordByData('lead_appointments', 'appointment_id', appointmentId))
        removedAppointments++
      } catch (err) {
        console.log('0049 delete tentativa ausente', appointmentId, String(err))
      }
    }

    // 2. Usuários sintéticos temporários da F2-IMP-009.
    const emails = [
      'champion.f2imp009@fellice-fitness.local',
      'consultor.a.f2imp009@fellice-fitness.local',
      'consultor.b.f2imp009@fellice-fitness.local',
      'gestao.f2imp009@fellice-fitness.local',
    ]
    for (const email of emails) {
      try {
        app.delete(app.findFirstRecordByData('users', 'email', email))
        removedUsers++
      } catch (err) {
        console.log('0049 delete usuário ausente', email, String(err))
      }
    }

    // 3. Eventos de controle foram criados apenas pelas provas de rollback desta task.
    try {
      const controls = app.findRecordsByFilter('lead_queue_control_events', '', '', 0, 0)
      for (const event of controls) {
        app.delete(event)
        removedControlEvents++
      }
    } catch (err) {
      console.log('0049 limpeza de eventos de controle falhou', String(err))
    }

    // 4. A fila termina habilitada, sem motivo/ator de teste persistido.
    try {
      const settings = app.findFirstRecordByData('lead_queue_settings', 'singleton_id', 'default')
      settings.set('enabled', true)
      settings.set('updated_at', new Date().toISOString())
      settings.set('updated_by', 'migration-0049-cleanup')
      settings.set('reason', 'Fila habilitada após limpeza do teste F2-IMP-009')
      app.save(settings)
    } catch (err) {
      console.log('0049 restauração do controle da fila falhou', String(err))
    }

    console.log(
      '0049 limpeza F2-IMP-009:',
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
