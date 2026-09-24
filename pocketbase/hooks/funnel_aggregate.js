// Fase 3 / SPEC-3-001 — leitura agregada do funil sem exposição de contatos.
// Uma rota por arquivo; toda a lógica permanece dentro do callback por causa do JSVM.

routerAdd(
  'GET',
  '/backend/v1/funnel',
  (e) => {
    const actor = e.auth
    if (!actor) return e.unauthorizedError('Autenticação necessária.')
    const role = actor.getString('role', '')
    if (role !== 'champion' && role !== 'gestao' && role !== 'supervisora') {
      return e.forbiddenError('Sem permissão para consultar a consolidação.')
    }

    let settings
    try {
      settings = $app.findFirstRecordByData('lead_funnel_settings', 'singleton_id', 'default')
    } catch (err) {
      $app.logger().error('funnel settings unavailable', 'error', String(err))
      return e.json(503, {
        enabled: false,
        available: false,
        message: 'A consolidação está temporariamente indisponível.',
      })
    }

    const lastControl = {
      updated_at: settings.getString('updated_at', ''),
      reason: settings.getString('reason', ''),
    }
    if (settings.get('enabled') !== true) {
      return e.json(200, {
        enabled: false,
        available: false,
        message: 'A consolidação está desativada pelo controle de rollback.',
        control: lastControl,
      })
    }

    const query = e.requestInfo().query || {}
    const fromParam = String(query.from || '').trim()
    const toParam = String(query.to || '').trim()
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    const now = new Date()
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    let fromDate = null
    let toExclusive = null

    if (!fromParam && !toParam) {
      toExclusive = new Date(todayStart)
      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)
      fromDate = new Date(todayStart)
      fromDate.setUTCDate(fromDate.getUTCDate() - 29)
    } else {
      if (!datePattern.test(fromParam) || !datePattern.test(toParam)) {
        return e.badRequestError('from e to devem usar o formato YYYY-MM-DD.')
      }
      fromDate = new Date(`${fromParam}T00:00:00.000Z`)
      toExclusive = new Date(`${toParam}T00:00:00.000Z`)
      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)
      if (
        Number.isNaN(fromDate.getTime()) ||
        Number.isNaN(toExclusive.getTime()) ||
        fromDate.getTime() >= toExclusive.getTime()
      ) {
        return e.badRequestError('O período informado é inválido.')
      }
    }

    const fromIso = fromDate.toISOString()
    const toIso = toExclusive.toISOString()
    const periodFrom = fromIso.slice(0, 10)
    const periodTo = new Date(toExclusive.getTime() - 1).toISOString().slice(0, 10)
    const isWithinPeriod = (value) => {
      const raw = String(value || '').replace(' ', 'T')
      const time = Date.parse(raw)
      return Number.isFinite(time) && time >= fromDate.getTime() && time < toExclusive.getTime()
    }
    const sourceState = {
      lead_submissions: 'ok',
      lead_submission_events: 'ok',
      lead_handoffs: 'ok',
      lead_appointments: 'ok',
      lead_appointment_events: 'ok',
    }
    const readErrors = []
    let submissionRows = null
    let submissionEventRows = null
    let handoffRows = null
    let appointmentRows = null
    let appointmentEventRows = null

    try {
      submissionRows = $app.findRecordsByFilter('lead_submissions', '', 'started_at', 0, 0)
    } catch (err) {
      sourceState.lead_submissions = 'error'
      readErrors.push('lead_submissions')
      $app
        .logger()
        .error('funnel source read failed', 'source', 'lead_submissions', 'error', String(err))
    }
    try {
      submissionEventRows = $app.findRecordsByFilter(
        'lead_submission_events',
        '',
        'occurred_at',
        0,
        0,
      )
    } catch (err) {
      sourceState.lead_submission_events = 'error'
      readErrors.push('lead_submission_events')
      $app
        .logger()
        .error(
          'funnel source read failed',
          'source',
          'lead_submission_events',
          'error',
          String(err),
        )
    }
    try {
      handoffRows = $app.findRecordsByFilter('lead_handoffs', '', 'created_at', 0, 0)
    } catch (err) {
      sourceState.lead_handoffs = 'error'
      readErrors.push('lead_handoffs')
      $app
        .logger()
        .error('funnel source read failed', 'source', 'lead_handoffs', 'error', String(err))
    }
    try {
      appointmentRows = $app.findRecordsByFilter('lead_appointments', '', 'created_at', 0, 0)
    } catch (err) {
      sourceState.lead_appointments = 'error'
      readErrors.push('lead_appointments')
      $app
        .logger()
        .error('funnel source read failed', 'source', 'lead_appointments', 'error', String(err))
    }
    try {
      appointmentEventRows = $app.findRecordsByFilter(
        'lead_appointment_events',
        '',
        'occurred_at',
        0,
        0,
      )
    } catch (err) {
      sourceState.lead_appointment_events = 'error'
      readErrors.push('lead_appointment_events')
      $app
        .logger()
        .error(
          'funnel source read failed',
          'source',
          'lead_appointment_events',
          'error',
          String(err),
        )
    }

    const submissionIds = new Set()
    const periodSubmissionIds = new Set()
    const attribution = {
      recebida: 0,
      incompleta: 0,
      ausente: 0,
      nao_reconhecida: 0,
      sem_attribution_status: 0,
    }
    if (submissionRows) {
      for (const row of submissionRows) {
        const submissionId = row.getString('lead_submission_id', '').trim() || row.id
        submissionIds.add(submissionId)
        if (!isWithinPeriod(row.getString('started_at', ''))) continue
        if (periodSubmissionIds.has(submissionId)) continue
        periodSubmissionIds.add(submissionId)
        const status = row.getString('attribution_status', '').trim()
        if (status === 'recebida') attribution.recebida++
        else if (status === 'incompleta') attribution.incompleta++
        else if (status === 'ausente') attribution.ausente++
        else if (status) attribution.nao_reconhecida++
        else attribution.sem_attribution_status++
      }
    }

    const startedIds = new Set()
    const triageCompletedIds = new Set()
    if (submissionEventRows) {
      for (const row of submissionEventRows) {
        if (!isWithinPeriod(row.getString('occurred_at', ''))) continue
        const submissionId = row.getString('lead_submission_id', '').trim() || `event:${row.id}`
        const eventType = row.getString('event_type', '')
        if (eventType === 'FORM_STARTED') startedIds.add(submissionId)
        if (eventType === 'TRIAGEM_CONCLUIDA') triageCompletedIds.add(submissionId)
      }
    }

    const appointmentById = new Map()
    if (appointmentRows) {
      for (const row of appointmentRows) {
        const appointmentId = row.getString('appointment_id', '').trim() || row.id
        appointmentById.set(appointmentId, row)
      }
    }

    const humanHandoffKeys = new Set()
    if (handoffRows) {
      for (const row of handoffRows) {
        if (!isWithinPeriod(row.getString('created_at', ''))) continue
        const submissionId = row.getString('lead_submission_id', '').trim()
        const handoffId = row.getString('handoff_id', '').trim() || row.id
        humanHandoffKeys.add(submissionId ? `submission:${submissionId}` : `handoff:${handoffId}`)
      }
    }

    const completedAppointmentKeys = new Set()
    const completedWithoutSubmissionKeys = new Set()
    const relevantAppointmentKeys = new Set()
    if (appointmentRows) {
      for (const row of appointmentRows) {
        const appointmentId = row.getString('appointment_id', '').trim() || row.id
        const submissionId = row.getString('lead_submission_id', '').trim()
        const status = row.getString('status', '')
        const createdInPeriod = isWithinPeriod(row.getString('created_at', ''))
        const concludedInPeriod = isWithinPeriod(row.getString('concluded_at', ''))
        if (createdInPeriod && status === 'ENCAMINHAMENTO_HUMANO') {
          relevantAppointmentKeys.add(`appointment:${appointmentId}`)
          humanHandoffKeys.add(
            submissionId ? `submission:${submissionId}` : `appointment:${appointmentId}`,
          )
        }
        if (status === 'CONCLUIDO' && concludedInPeriod) {
          completedAppointmentKeys.add(appointmentId)
          relevantAppointmentKeys.add(`appointment:${appointmentId}`)
          if (!submissionId || !submissionIds.has(submissionId)) {
            completedWithoutSubmissionKeys.add(appointmentId)
          }
        }
      }
    }

    if (appointmentEventRows) {
      for (const row of appointmentEventRows) {
        if (!isWithinPeriod(row.getString('occurred_at', ''))) continue
        const eventType = row.getString('event_type', '')
        const appointmentId = row.getString('appointment_id', '').trim() || row.id
        const submissionId = row.getString('lead_submission_id', '').trim()
        if (eventType === 'APPOINTMENT_HANDOFF') {
          humanHandoffKeys.add(
            submissionId ? `submission:${submissionId}` : `appointment:${appointmentId}`,
          )
          relevantAppointmentKeys.add(`appointment:${appointmentId}`)
        }
        if (eventType === 'APPOINTMENT_CONCLUDED') {
          completedAppointmentKeys.add(appointmentId)
          relevantAppointmentKeys.add(`appointment:${appointmentId}`)
          const appointment = appointmentById.get(appointmentId)
          const linkedSubmissionId = appointment
            ? appointment.getString('lead_submission_id', '').trim()
            : submissionId
          if (!linkedSubmissionId || !submissionIds.has(linkedSubmissionId)) {
            completedWithoutSubmissionKeys.add(appointmentId)
          }
        }
      }
    }

    const partial = readErrors.length > 0
    const stage = {
      entrada: submissionRows ? periodSubmissionIds.size : null,
      inicio: submissionEventRows ? startedIds.size : null,
      triagem_concluida: submissionEventRows ? triageCompletedIds.size : null,
      encaminhamento_humano:
        handoffRows && appointmentRows && appointmentEventRows ? humanHandoffKeys.size : null,
      agendamento_concluido: appointmentRows ? completedAppointmentKeys.size : null,
    }
    const coverage = submissionRows
      ? {
          total_submissoes: periodSubmissionIds.size,
          atribuicao_recebida: attribution.recebida,
          atribuicao_incompleta: attribution.incompleta,
          atribuicao_ausente: attribution.ausente,
          atribuicao_nao_reconhecida: attribution.nao_reconhecida,
          sem_attribution_status: attribution.sem_attribution_status,
          cobertura_completa:
            periodSubmissionIds.size > 0 ? attribution.recebida / periodSubmissionIds.size : null,
        }
      : null
    const linkage =
      submissionRows && appointmentRows
        ? {
            agendamentos_relevantes: relevantAppointmentKeys.size,
            agendamentos_sem_submissao: completedWithoutSubmissionKeys.size,
            cobertura_incompleta: completedWithoutSubmissionKeys.size > 0,
          }
        : null
    const denominator = stage.encaminhamento_humano
    const numerator = stage.agendamento_concluido
    const rate =
      !partial && denominator !== null && denominator > 0 && numerator !== null
        ? numerator / denominator
        : null

    return e.json(200, {
      enabled: true,
      available: true,
      partial,
      period: { from: periodFrom, to: periodTo },
      stages: stage,
      metric: {
        name: 'Agendamentos concluídos por encaminhamentos humanos',
        numerator,
        denominator,
        rate,
        formula: 'agendamentos concluídos no período ÷ encaminhamentos humanos no mesmo período',
      },
      coverage,
      linkage,
      deduplication: {
        appointment_ids: completedAppointmentKeys.size,
        human_handoff_keys: humanHandoffKeys.size,
      },
      sources: sourceState,
      read_errors: readErrors,
      control: lastControl,
    })
  },
  $apis.requireAuth(),
)
