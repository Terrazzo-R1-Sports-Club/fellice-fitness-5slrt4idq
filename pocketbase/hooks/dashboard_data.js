// Fase 3 / SPEC-3-002 — dashboard agregado e baseline append-only.
// Uma rota por arquivo: POST /backend/v1/dashboard, action=read|freeze.
// Retorna somente agregados; nunca contatos, IDs de leads ou registros individuais.

routerAdd(
  'POST',
  '/backend/v1/dashboard',
  (e) => {
    const actor = e.auth
    if (!actor) return e.unauthorizedError('Autenticação necessária.')
    const role = actor.getString('role', '')
    const readableRoles = ['champion', 'gestao', 'supervisora', 'marketing']
    if (readableRoles.indexOf(role) < 0) {
      return e.forbiddenError('Sem permissão para consultar os agregados do dashboard.')
    }

    const body = e.requestInfo().body || {}
    const action = String(body.action || 'read')
      .trim()
      .toLowerCase()
    if (action !== 'read' && action !== 'freeze') {
      return e.badRequestError('Ação inválida. Use read ou freeze.')
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    const now = new Date()
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const toDateInput = (date) =>
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
    let fromParam = String(body.from || '').trim()
    let toParam = String(body.to || '').trim()
    if (!fromParam && !toParam) {
      const fromDefault = new Date(todayStart)
      fromDefault.setUTCDate(fromDefault.getUTCDate() - 29)
      fromParam = toDateInput(fromDefault)
      toParam = toDateInput(todayStart)
    }
    if (!datePattern.test(fromParam) || !datePattern.test(toParam)) {
      return e.badRequestError('from e to devem usar o formato YYYY-MM-DD.')
    }
    const fromDate = new Date(`${fromParam}T00:00:00.000Z`)
    const toDay = new Date(`${toParam}T00:00:00.000Z`)
    if (
      Number.isNaN(fromDate.getTime()) ||
      Number.isNaN(toDay.getTime()) ||
      fromDate.toISOString().slice(0, 10) !== fromParam ||
      toDay.toISOString().slice(0, 10) !== toParam ||
      fromDate.getTime() > toDay.getTime() ||
      toDay.getTime() > todayStart.getTime()
    ) {
      return e.badRequestError('O período informado é inválido ou está no futuro.')
    }
    const toExclusive = new Date(toDay)
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)
    const periodDays = Math.round((toExclusive.getTime() - fromDate.getTime()) / 86400000)
    if (periodDays > 366) {
      return e.badRequestError('O período máximo para consulta é de 366 dias.')
    }

    const fromIso = fromDate.toISOString()
    const period = {
      from: fromIso.slice(0, 10),
      to: new Date(toExclusive.getTime() - 1).toISOString().slice(0, 10),
    }
    const isWithinPeriod = (value) => {
      const raw = String(value || '').replace(' ', 'T')
      const timestamp = Date.parse(raw)
      return (
        Number.isFinite(timestamp) &&
        timestamp >= fromDate.getTime() &&
        timestamp < toExclusive.getTime()
      )
    }
    const readErrors = []
    const readSource = (name, sort) => {
      try {
        return $app.findRecordsByFilter(name, '', sort || '', 0, 0)
      } catch (err) {
        readErrors.push(name)
        $app.logger().error('dashboard source read failed', 'source', name, 'error', String(err))
        return null
      }
    }

    let policy = null
    try {
      policy = $app.findFirstRecordByData('lead_dashboard_policy', 'singleton_id', 'default')
    } catch (err) {
      return e.internalServerError('A política do dashboard não está disponível.')
    }
    const policyRoles = policy.get('read_roles') || []
    const b3_04Confirmed = policy.get('b3_04_confirmed') === true
    const b3_05Confirmed = policy.get('b3_05_confirmed') === true
    const marketingAllowed =
      b3_04Confirmed &&
      policy.get('b3_04_marketing_aggregates_only') === true &&
      policyRoles.indexOf('marketing') >= 0
    const previewMode = !b3_04Confirmed
    const safePreviewRoles = ['champion', 'gestao', 'supervisora']
    const proposedCriterion =
      'Congelamento manual pelo Champion; janela móvel dos últimos 30 dias corridos; numerador de agendamentos concluídos e denominador de encaminhamentos humanos no mesmo período; registrar fórmula, período, cobertura e versão; cada nova apuração cria nova versão append-only; nenhuma meta inferida.'

    if (role === 'marketing' && !marketingAllowed) {
      return e.forbiddenError('Acesso de Marketing depende da confirmação da matriz B3-04.')
    }
    if (previewMode && safePreviewRoles.indexOf(role) < 0) {
      return e.forbiddenError('Prévia sintética indisponível para este papel.')
    }
    if (!previewMode && policyRoles.indexOf(role) < 0) {
      return e.forbiddenError('Este papel não está incluído na matriz confirmada do dashboard.')
    }

    if (action === 'freeze' && role !== 'champion') {
      return e.forbiddenError('Somente o Champion pode congelar uma versão do baseline.')
    }
    if (action === 'freeze' && (!b3_04Confirmed || !b3_05Confirmed)) {
      return e.json(409, {
        error:
          'Congelamento indisponível até a confirmação dos critérios B3-04 e B3-05 pelo Champion.',
        decisions: { b3_04_confirmed: b3_04Confirmed, b3_05_confirmed: b3_05Confirmed },
      })
    }

    const expectedFrom = new Date(todayStart)
    expectedFrom.setUTCDate(expectedFrom.getUTCDate() - 29)
    if (
      action === 'freeze' &&
      (periodDays !== 30 ||
        fromParam !== toDateInput(expectedFrom) ||
        toParam !== toDateInput(todayStart))
    ) {
      return e.badRequestError('O baseline segue a janela móvel dos últimos 30 dias corridos.')
    }

    let funnelSettings = null
    try {
      funnelSettings = $app.findFirstRecordByData('lead_funnel_settings', 'singleton_id', 'default')
    } catch (err) {
      return e.internalServerError(
        'O controle de disponibilidade da consolidação não está disponível.',
      )
    }
    if (funnelSettings.get('enabled') !== true) {
      return e.json(200, {
        available: false,
        message:
          'A consolidação está desativada pelo controle de rollback. Os eventos de origem e versões de baseline permanecem preservados.',
        baseline_preserved: true,
        period,
        decisions: { b3_04_confirmed: b3_04Confirmed, b3_05_confirmed: b3_05Confirmed },
      })
    }

    let formRows = readSource('lead_forms', 'form_id')
    let versionRows = readSource('lead_form_versions', 'form_id,published_at')
    let submissionRows = readSource('lead_submissions', 'started_at')
    let handoffRows = readSource('lead_handoffs', 'created_at')
    let appointmentRows = readSource('lead_appointments', 'created_at')
    let appointmentEventRows = readSource('lead_appointment_events', 'occurred_at')

    // Antes da confirmação B3-04, a prévia é estritamente sintética. Nunca agrega
    // submissões, encaminhamentos ou agendamentos reais enquanto a matriz está pendente.
    if (previewMode) {
      const keep = (rows, predicate) => (rows ? rows.filter(predicate) : null)
      const formId = 'spec3002-dashboard-form'
      formRows = keep(formRows, (row) => row.getString('form_id', '') === formId)
      versionRows = keep(versionRows, (row) => row.getString('form_id', '') === formId)
      submissionRows = keep(submissionRows, (row) =>
        row.getString('lead_submission_id', '').startsWith('spec3002-sub-'),
      )
      handoffRows = keep(handoffRows, (row) =>
        row.getString('handoff_id', '').startsWith('spec3002-handoff-'),
      )
      appointmentRows = keep(appointmentRows, (row) =>
        row.getString('appointment_id', '').startsWith('spec3002-appointment-'),
      )
      appointmentEventRows = keep(appointmentEventRows, (row) =>
        row.getString('appointment_id', '').startsWith('spec3002-appointment-'),
      )
    }

    const formNames = Object.create(null)
    if (formRows) {
      for (const row of formRows) {
        const id = row.getString('form_id', '').trim()
        if (id) formNames[id] = id
      }
    }
    const versionsByForm = Object.create(null)
    const versionInfo = Object.create(null)
    if (versionRows) {
      for (const row of versionRows) {
        const formId = row.getString('form_id', '').trim()
        const version = row.getString('form_version', '').trim()
        const publishedAt = row.getString('published_at', '').trim()
        const publishedTime = publishedAt ? Date.parse(publishedAt.replace(' ', 'T')) : NaN
        const info = {
          form_id: formId,
          form_version: version,
          published_at: publishedAt,
          starts_at: Number.isFinite(publishedTime) ? publishedTime : null,
          ends_at: null,
        }
        if (!formId || !version) continue
        versionInfo[`${formId}::${version}`] = info
        if (!versionsByForm[formId]) versionsByForm[formId] = []
        versionsByForm[formId].push(info)
      }
    }
    for (const formId of Object.keys(versionsByForm)) {
      const definitions = versionsByForm[formId]
      definitions.sort((a, b) => (a.starts_at || 0) - (b.starts_at || 0))
      for (let index = 0; index < definitions.length; index++) {
        const current = definitions[index]
        if (current.starts_at === null) continue
        for (let next = index + 1; next < definitions.length; next++) {
          if (
            definitions[next].starts_at !== null &&
            definitions[next].starts_at > current.starts_at
          ) {
            current.ends_at = definitions[next].starts_at
            break
          }
        }
      }
    }
    const validityForSubmission = (row) => {
      const formId = row.getString('form_id', '').trim()
      const version = row.getString('form_version', '').trim()
      const startedAt = row.getString('started_at', '').trim()
      const timestamp = startedAt ? Date.parse(startedAt.replace(' ', 'T')) : NaN
      const info = versionInfo[`${formId}::${version}`]
      if (!formId || !version || !Number.isFinite(timestamp) || !info || info.starts_at === null) {
        return { status: 'nao_verificavel', info: info || null }
      }
      if (timestamp < info.starts_at || (info.ends_at !== null && timestamp >= info.ends_at)) {
        return { status: 'fora_da_vigencia', info }
      }
      return { status: 'vigencia_confirmada', info }
    }

    const submissionsById = Object.create(null)
    const periodSubmissionIds = Object.create(null)
    const validityCounts = { vigencia_confirmada: 0, nao_verificavel: 0, fora_da_vigencia: 0 }
    const attributionCounts = { recebida: 0, incompleta: 0, ausente: 0, desconhecida: 0 }
    if (submissionRows) {
      for (const row of submissionRows) {
        const submissionId = row.getString('lead_submission_id', '').trim() || row.id
        const status = row.getString('attribution_status', '').trim()
        const meta = {
          form_id: row.getString('form_id', '').trim(),
          form_version: row.getString('form_version', '').trim(),
          started_at: row.getString('started_at', '').trim(),
          attribution_status: status,
          utm_source: row.getString('utm_source', '').trim(),
          utm_medium: row.getString('utm_medium', '').trim(),
          utm_campaign: row.getString('utm_campaign', '').trim(),
          validity: validityForSubmission(row),
        }
        submissionsById[submissionId] = meta
        if (!isWithinPeriod(meta.started_at) || periodSubmissionIds[submissionId]) continue
        periodSubmissionIds[submissionId] = meta
        validityCounts[meta.validity.status]++
        if (status === 'recebida') attributionCounts.recebida++
        else if (status === 'incompleta') attributionCounts.incompleta++
        else if (status === 'ausente') attributionCounts.ausente++
        else attributionCounts.desconhecida++
      }
    }

    const looksSensitive = (value) => {
      if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)) return true
      return /^\+?[\d\s().-]{8,}$/.test(value) && value.replace(/\D/g, '').length >= 8
    }
    const dimensionSpec = (meta, field) => {
      if (!meta || meta.attribution_status === 'ausente') {
        return { key: 'no_attribution', label: 'Sem atribuição', kind: 'sem_atribuicao' }
      }
      if (['recebida', 'incompleta'].indexOf(meta.attribution_status) < 0) {
        return { key: 'unrecognized', label: 'Não classificada', kind: 'nao_classificada' }
      }
      const value = String(meta[field] || '').trim()
      if (!value) return { key: 'missing', label: 'Não classificada', kind: 'nao_classificada' }
      if (looksSensitive(value)) {
        return { key: 'redacted', label: 'Valor ocultado por segurança', kind: 'ocultado' }
      }
      return { key: `value:${value}`, label: value.slice(0, 160), kind: 'valor' }
    }
    const formSpec = (meta) => {
      if (!meta || !meta.form_id || !meta.form_version) {
        return {
          key: 'unlinked',
          label: 'Sem atribuição de formulário/versão',
          kind: 'sem_atribuicao',
          form_id: '',
          form_name: 'Não informado',
          form_version: 'Não informado',
          validity: 'nao_verificavel',
          valid_from: '',
          valid_to: '',
        }
      }
      const status = meta.validity.status
      const info = meta.validity.info
      const sensitiveFormId = looksSensitive(meta.form_id)
      const sensitiveVersion = looksSensitive(meta.form_version)
      const safeFormId = sensitiveFormId ? 'Identificador de formulário ocultado' : meta.form_id
      const safeVersion = sensitiveVersion ? 'versão ocultada' : meta.form_version
      const name = formNames[meta.form_id] || safeFormId
      let label = `${name} · ${safeVersion}`
      if (status === 'fora_da_vigencia') label += ' · fora da vigência'
      if (status === 'nao_verificavel') label += ' · vigência não verificada'
      return {
        key: `${safeFormId}::${safeVersion}::${status}`,
        label,
        kind: status,
        form_id: safeFormId,
        form_name: name,
        form_version: safeVersion,
        validity: status,
        valid_from: info && info.published_at ? info.published_at.slice(0, 10) : '',
        valid_to:
          info && info.ends_at !== null
            ? new Date(info.ends_at - 86400000).toISOString().slice(0, 10)
            : '',
      }
    }

    const groups = {
      by_form_version: Object.create(null),
      by_source: Object.create(null),
      by_medium: Object.create(null),
      by_campaign: Object.create(null),
    }
    const ensureGroup = (map, spec) => {
      if (!map[spec.key]) {
        map[spec.key] = {
          key: spec.key,
          label: spec.label,
          kind: spec.kind,
          form_id: spec.form_id || '',
          form_name: spec.form_name || '',
          form_version: spec.form_version || '',
          validity: spec.validity || '',
          valid_from: spec.valid_from || '',
          valid_to: spec.valid_to || '',
          submissions: 0,
          attributed_submissions: 0,
          human_handoffs: 0,
          completed_appointments: 0,
          _submissionIds: Object.create(null),
          _handoffIds: Object.create(null),
          _appointmentIds: Object.create(null),
        }
      }
      return map[spec.key]
    }
    const specsForMeta = (meta) => ({
      by_form_version: formSpec(meta),
      by_source: dimensionSpec(meta, 'utm_source'),
      by_medium: dimensionSpec(meta, 'utm_medium'),
      by_campaign: dimensionSpec(meta, 'utm_campaign'),
    })
    const addSubmission = (submissionId, meta) => {
      const specs = specsForMeta(meta)
      for (const name of Object.keys(specs)) {
        const group = ensureGroup(groups[name], specs[name])
        if (!group._submissionIds[submissionId]) {
          group._submissionIds[submissionId] = true
          group.submissions++
          if (meta && meta.attribution_status === 'recebida') group.attributed_submissions++
        }
      }
    }
    if (submissionRows) {
      for (const submissionId of Object.keys(periodSubmissionIds)) {
        addSubmission(submissionId, periodSubmissionIds[submissionId])
      }
    }

    const handoffKeys = Object.create(null)
    const addHandoff = (key, submissionId) => {
      if (!key) return
      if (!handoffKeys[key]) handoffKeys[key] = { submission_id: submissionId || '' }
      else if (!handoffKeys[key].submission_id && submissionId)
        handoffKeys[key].submission_id = submissionId
    }
    if (handoffRows) {
      for (const row of handoffRows) {
        if (!isWithinPeriod(row.getString('created_at', ''))) continue
        const submissionId = row.getString('lead_submission_id', '').trim()
        const id = row.getString('handoff_id', '').trim() || row.id
        addHandoff(submissionId ? `submission:${submissionId}` : `handoff:${id}`, submissionId)
      }
    }
    const completedAppointments = Object.create(null)
    const addCompletedAppointment = (appointmentId, submissionId) => {
      if (!appointmentId) return
      if (!completedAppointments[appointmentId])
        completedAppointments[appointmentId] = { submission_id: submissionId || '' }
      else if (!completedAppointments[appointmentId].submission_id && submissionId) {
        completedAppointments[appointmentId].submission_id = submissionId
      }
    }
    if (appointmentRows) {
      for (const row of appointmentRows) {
        const appointmentId = row.getString('appointment_id', '').trim() || row.id
        const submissionId = row.getString('lead_submission_id', '').trim()
        if (
          row.getString('status', '') === 'ENCAMINHAMENTO_HUMANO' &&
          isWithinPeriod(row.getString('created_at', ''))
        ) {
          addHandoff(
            submissionId ? `submission:${submissionId}` : `appointment:${appointmentId}`,
            submissionId,
          )
        }
        if (
          row.getString('status', '') === 'CONCLUIDO' &&
          isWithinPeriod(row.getString('concluded_at', ''))
        ) {
          addCompletedAppointment(appointmentId, submissionId)
        }
      }
    }
    if (appointmentEventRows) {
      for (const row of appointmentEventRows) {
        if (!isWithinPeriod(row.getString('occurred_at', ''))) continue
        const type = row.getString('event_type', '')
        const appointmentId = row.getString('appointment_id', '').trim() || row.id
        const submissionId = row.getString('lead_submission_id', '').trim()
        if (type === 'APPOINTMENT_HANDOFF') {
          addHandoff(
            submissionId ? `submission:${submissionId}` : `appointment:${appointmentId}`,
            submissionId,
          )
        }
        if (type === 'APPOINTMENT_CONCLUDED') addCompletedAppointment(appointmentId, submissionId)
      }
    }
    const updateEventCount = (field, entityId, submissionId, counter) => {
      const meta = submissionId ? submissionsById[submissionId] || null : null
      const specs = specsForMeta(meta)
      for (const name of Object.keys(specs)) {
        const group = ensureGroup(groups[name], specs[name])
        if (!group[counter][entityId]) {
          group[counter][entityId] = true
          group[field]++
        }
      }
    }
    for (const key of Object.keys(handoffKeys)) {
      updateEventCount('human_handoffs', key, handoffKeys[key].submission_id, '_handoffIds')
    }
    for (const id of Object.keys(completedAppointments)) {
      updateEventCount(
        'completed_appointments',
        id,
        completedAppointments[id].submission_id,
        '_appointmentIds',
      )
    }

    const totalSubmissions = Object.keys(periodSubmissionIds).length
    const attributedSubmissions = attributionCounts.recebida
    const numerator = Object.keys(completedAppointments).length
    const denominator = Object.keys(handoffKeys).length
    const partial = readErrors.length > 0
    const rate = !partial && denominator > 0 ? numerator / denominator : null
    const coverage = totalSubmissions > 0 ? attributedSubmissions / totalSubmissions : null
    const exportGroups = (map) =>
      Object.keys(map)
        .map((key) => {
          const group = map[key]
          return {
            key: group.key,
            label: group.label,
            kind: group.kind,
            form_id: group.form_id || undefined,
            form_name: group.form_name || undefined,
            form_version: group.form_version || undefined,
            validity: group.validity || undefined,
            valid_from: group.valid_from || undefined,
            valid_to: group.valid_to || undefined,
            submissions: group.submissions,
            human_handoffs: group.human_handoffs,
            completed_appointments: group.completed_appointments,
            numerator: group.completed_appointments,
            denominator: group.human_handoffs,
            rate:
              !partial && group.human_handoffs > 0
                ? group.completed_appointments / group.human_handoffs
                : null,
            coverage:
              group.submissions > 0 ? group.attributed_submissions / group.submissions : null,
          }
        })
        .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

    let baselineRows = null
    let baselineAvailable = true
    try {
      baselineRows = $app.findRecordsByFilter('lead_dashboard_baseline', '', '-version', 0, 0)
    } catch (err) {
      baselineAvailable = false
      $app.logger().error('dashboard baseline read failed', 'error', String(err))
    }
    const formatBaseline = (row) => ({
      version: Number(row.get('version') || 0),
      period: {
        from: row.getString('period_from', '').slice(0, 10),
        to: row.getString('period_to', '').slice(0, 10),
      },
      numerator: Number(row.get('numerador') || 0),
      denominator: Number(row.get('denominador') || 0),
      rate:
        Number(row.get('denominador') || 0) > 0
          ? Number(row.get('numerador') || 0) / Number(row.get('denominador') || 0)
          : null,
      coverage:
        Number(row.get('total_submissoes') || 0) > 0 ? Number(row.get('cobertura') || 0) : null,
      total_submissions: Number(row.get('total_submissoes') || 0),
      formula: row.getString('formula', ''),
      frozen_at: row.getString('frozen_at', ''),
      frozen_by: 'Champion',
      reason: role === 'marketing' ? undefined : row.getString('reason', ''),
      criterion: row.getString('freeze_criterion', ''),
    })
    let baselines = baselineRows ? baselineRows.map(formatBaseline) : []
    let baselineCreated = null

    if (action === 'freeze') {
      const reason = String(body.reason || '').trim()
      if (!reason) return e.badRequestError('O motivo do congelamento é obrigatório.')
      if (reason.length > 500) return e.badRequestError('O motivo deve ter até 500 caracteres.')
      if (
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(reason) ||
        (/^\+?[\d\s().-]{8,}$/.test(reason) && reason.replace(/\D/g, '').length >= 8)
      ) {
        return e.badRequestError('Não inclua e-mail nem telefone no motivo do congelamento.')
      }
      if (!baselineRows || !baselineAvailable)
        return e.internalServerError('A leitura do histórico de baseline falhou.')
      if (!policy.getString('b3_05_criterion', '').trim()) {
        return e.json(409, { error: 'O critério B3-05 confirmado não está registrado na policy.' })
      }
      if (partial) {
        return e.json(409, {
          error: 'Não é possível congelar um baseline com fontes indisponíveis.',
          read_errors: readErrors,
        })
      }
      if (totalSubmissions === 0 || denominator === 0 || rate === null) {
        return e.json(409, {
          error: 'Não há dados completos suficientes para congelar o baseline desta janela.',
          period,
          total_submissions: totalSubmissions,
          denominator,
        })
      }
      let createdRecord = null
      $app.runInTransaction((txApp) => {
        const currentRows = txApp.findRecordsByFilter(
          'lead_dashboard_baseline',
          '',
          '-version',
          1,
          0,
        )
        const previousVersion = currentRows.length ? Number(currentRows[0].get('version') || 0) : 0
        const nextVersion = previousVersion + 1
        const nowIso = new Date().toISOString()
        const baselineId = $security.randomString(32)
        const record = new Record(txApp.findCollectionByNameOrId('lead_dashboard_baseline'))
        record.set('baseline_id', baselineId)
        record.set('version', nextVersion)
        record.set('period_from', fromIso)
        record.set('period_to', new Date(toExclusive.getTime() - 1).toISOString())
        record.set('numerador', numerator)
        record.set('denominador', denominator)
        record.set('taxa', rate)
        record.set('cobertura', coverage)
        record.set('total_submissoes', totalSubmissions)
        record.set(
          'formula',
          'agendamentos concluídos no período ÷ encaminhamentos humanos no mesmo período',
        )
        record.set('frozen_at', nowIso)
        record.set('frozen_by', actor.id)
        record.set('reason', reason)
        record.set('freeze_criterion', policy.getString('b3_05_criterion', ''))
        txApp.save(record)
        const event = new Record(txApp.findCollectionByNameOrId('lead_dashboard_baseline_events'))
        event.set('event_id', $security.randomString(32))
        event.set('baseline_id', baselineId)
        event.set('action', 'FROZEN')
        event.set('occurred_at', nowIso)
        event.set('actor_id', actor.id)
        event.set('reason', reason)
        event.set('payload', {
          version: nextVersion,
          period,
          numerator,
          denominator,
          rate,
          coverage,
          total_submissions: totalSubmissions,
        })
        txApp.save(event)
        createdRecord = record
      })
      if (createdRecord) {
        baselineCreated = formatBaseline(createdRecord)
        baselines.unshift(baselineCreated)
      }
    }

    return e.json(200, {
      available: true,
      preview: previewMode,
      message: previewMode
        ? 'Prévia com fixtures sintéticas apenas; B3-04/B3-05 permanecem pendentes e não há GREEN nem baseline congelável.'
        : '',
      partial,
      period,
      metric: {
        name: 'Agendamentos concluídos por encaminhamentos humanos',
        numerator,
        denominator,
        rate,
        formula: 'agendamentos concluídos no período ÷ encaminhamentos humanos no mesmo período',
      },
      coverage: {
        total_submissions: totalSubmissions,
        attribution_received: attributionCounts.recebida,
        attribution_incomplete: attributionCounts.incompleta,
        attribution_absent: attributionCounts.ausente,
        attribution_unknown: attributionCounts.desconhecida,
        complete_rate: coverage,
        version_validity: validityCounts,
      },
      comparisons: {
        by_form_version: exportGroups(groups.by_form_version),
        by_source: exportGroups(groups.by_source),
        by_medium: exportGroups(groups.by_medium),
        by_campaign: exportGroups(groups.by_campaign),
      },
      baselines,
      baseline_available: baselineAvailable,
      baseline_created: baselineCreated,
      sources: {
        lead_forms: formRows ? 'ok' : 'error',
        lead_form_versions: versionRows ? 'ok' : 'error',
        lead_submissions: submissionRows ? 'ok' : 'error',
        lead_handoffs: handoffRows ? 'ok' : 'error',
        lead_appointments: appointmentRows ? 'ok' : 'error',
        lead_appointment_events: appointmentEventRows ? 'ok' : 'error',
      },
      read_errors: readErrors,
      decisions: {
        b3_04_confirmed: b3_04Confirmed,
        b3_05_confirmed: b3_05Confirmed,
        b3_04: b3_04Confirmed ? 'confirmed' : 'proposal_pending',
        b3_05: b3_05Confirmed ? 'confirmed' : 'proposal_pending',
        proposed_read_roles: ['champion', 'gestao', 'supervisora', 'marketing'],
        marketing_aggregates_only: true,
        proposed_b3_05_criterion: proposedCriterion,
        canonical_decision_record_required: !b3_04Confirmed || !b3_05Confirmed,
        note: 'O endpoint não altera decisões humanas; a policy permanece pendente até registro verificável externo.',
      },
    })
  },
  $apis.requireAuth(),
)
