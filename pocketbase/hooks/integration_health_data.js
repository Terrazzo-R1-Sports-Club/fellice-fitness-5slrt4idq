// Fase 4 / TAREFA 4 — Rota de dados do Painel de Saúde da Integração.
// POST /backend/v1/integration-health, action = read.
// Autorização ANTES de qualquer leitura: papel deve estar em read_roles da lead_integration_health_policy.
// Fora da matriz -> 403 sem provocar nem observar consultas a dados.
// Resposta somente agregada; nenhum contato individual de lead, nem exportação.

routerAdd(
  'POST',
  '/backend/v1/integration-health',
  (e) => {
    const actor = e.auth
    if (!actor) return e.unauthorizedError('Autenticação necessária.')
    const role = actor.getString('role', '')

    // 1. Autorização ANTES de qualquer leitura de dados de negócio.
    // Consulta exclusivamente o singleton lead_integration_health_policy para obter read_roles.
    let healthPolicy = null
    try {
      healthPolicy = $app.findFirstRecordByData(
        'lead_integration_health_policy',
        'singleton_id',
        'default',
      )
    } catch (err) {
      $app.logger().error('integration health policy read failed', 'error', String(err))
      return e.internalServerError('A política de saúde da integração não está disponível.')
    }

    let allowedRoles = []
    try {
      const rawRoles = healthPolicy.getString('read_roles', '')
      allowedRoles = JSON.parse(rawRoles) ?? []
      if (!Array.isArray(allowedRoles)) {
        allowedRoles = ['champion', 'gestao', 'supervisora', 'subgerente']
      }
    } catch (_) {
      allowedRoles = ['champion', 'gestao', 'supervisora', 'subgerente']
    }

    if (allowedRoles.indexOf(role) < 0) {
      // Fora da matriz: 403 sem provocar nem observar consultas a dados
      return e.forbiddenError(
        'Seu papel não está autorizado pela matriz de acesso do painel de saúde.',
      )
    }

    const body = e.requestInfo().body || {}
    const action = String(body.action || 'read')
      .trim()
      .toLowerCase()
    if (action !== 'read') {
      return e.badRequestError('Ação inválida. Use action = read.')
    }

    const b4_03Confirmed = healthPolicy.get('b4_03_confirmed') === true

    // 2. Janela de datas: padrão móvel de 30 dias (Fase 3), até hoje UTC
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
    const period = { from: fromParam, to: toParam }

    const isWithinPeriod = (value) => {
      const raw = String(value || '').replace(' ', 'T')
      const timestamp = Date.parse(raw)
      return (
        Number.isFinite(timestamp) &&
        timestamp >= fromDate.getTime() &&
        timestamp < toExclusive.getTime()
      )
    }

    // Leitura resiliente de fontes com identificação explícita de erro e degradação
    const readErrors = []
    const sourcesStatus = Object.create(null)

    const readSource = (name, sort, limit) => {
      try {
        const rows = $app.findRecordsByFilter(name, '', sort || '', limit || 0, 0)
        sourcesStatus[name] = 'ok'
        return rows
      } catch (err) {
        readErrors.push(name)
        sourcesStatus[name] = 'source_unavailable'
        $app
          .logger()
          .error('integration health source read failed', 'source', name, 'error', String(err))
        return null
      }
    }

    // 3. Leitura das configurações e eventos de sincronização
    let syncSettings = null
    try {
      syncSettings = $app.findFirstRecordByData('lead_sync_settings', 'singleton_id', 'default')
      sourcesStatus['lead_sync_settings'] = 'ok'
    } catch (err) {
      readErrors.push('lead_sync_settings')
      sourcesStatus['lead_sync_settings'] = 'source_unavailable'
      $app.logger().error('lead_sync_settings read failed', 'error', String(err))
    }

    const syncControlEvents = readSource('lead_sync_control_events', '-occurred_at', 50)
    const formattedSyncControlEvents = syncControlEvents
      ? syncControlEvents.map((r) => ({
          event_id: r.getString('event_id', '') || r.id,
          action: r.getString('action', ''),
          occurred_at: r.getString('occurred_at', ''),
          actor_id: r.getString('actor_id', ''),
          reason: r.getString('reason', ''),
          previous_enabled: r.get('previous_enabled'),
          enabled: r.get('enabled'),
        }))
      : []

    // 4. Leitura dos dados operacionais da fila e conversão
    const formRows = readSource('lead_forms', 'form_id')
    const versionRows = readSource('lead_form_versions', 'form_id,published_at')
    const submissionRows = readSource('lead_submissions', 'started_at')
    const handoffRows = readSource('lead_handoffs', '-created_at')
    const handoffEventRows = readSource('lead_handoff_events', '-occurred_at', 200)
    const appointmentRows = readSource('lead_appointments', '-created_at')
    const appointmentEventRows = readSource('lead_appointment_events', '-occurred_at', 200)

    // Usuários para mapear nomes de atores/responsáveis sem expor e-mails ou contatos
    let userRows = null
    try {
      userRows = $app.findRecordsByFilter('users', '', '', 0, 0)
      sourcesStatus['users'] = 'ok'
    } catch (err) {
      readErrors.push('users')
      sourcesStatus['users'] = 'source_unavailable'
    }

    const userNameMap = Object.create(null)
    const userRoleMap = Object.create(null)
    if (userRows) {
      for (const u of userRows) {
        const uId = u.id
        const uName = u.getString('name', '').trim()
        const uRole = u.getString('role', '').trim()
        userNameMap[uId] = uName || (uRole ? `Usuário (${uRole})` : uId)
        userRoleMap[uId] = uRole
      }
    }

    const resolveActorName = (actorId) => {
      if (!actorId) return 'Sistema'
      if (actorId === 'migration-0057' || actorId === 'synthetic') return 'Sistema / Migração'
      return userNameMap[actorId] || (actorId.length > 15 ? actorId.slice(0, 15) : actorId)
    }

    // Nomes de formulários
    const formNames = Object.create(null)
    if (formRows) {
      for (const row of formRows) {
        const id = row.getString('form_id', '').trim()
        const name = row.getString('name', '').trim()
        if (id) formNames[id] = name || id
      }
    }

    // Informações de vigência de versões
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

    // 5. Estado da fila (lead_sync_queue e operações de atendimento / agendamento)
    // Métricas: pendentes, reprocessados, falhas com dono, conflitos detectados
    let queueMetrics = {
      pendentes: 0,
      assumidos: 0,
      encerrados_sem_agendamento: 0,
      falhas_com_dono: 0,
      falhas_sem_dono: 0,
      conflitos: 0,
      reprocessados: 0,
      divergencias: 0,
    }

    const pendingFailuresWithOwner = []
    const conflictItems = []
    const divergences = []

    // Mapeamento de submissões existentes no banco
    const submissionsMap = Object.create(null)
    const periodSubmissionIds = Object.create(null)
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
        submissionsMap[submissionId] = meta
        if (!isWithinPeriod(meta.started_at) || periodSubmissionIds[submissionId]) continue
        periodSubmissionIds[submissionId] = meta
        if (status === 'recebida') attributionCounts.recebida++
        else if (status === 'incompleta') attributionCounts.incompleta++
        else if (status === 'ausente') attributionCounts.ausente++
        else attributionCounts.desconhecida++
      }
    }

    // Análise de lead_handoffs
    if (handoffRows) {
      for (const h of handoffRows) {
        const status = h.getString('status', '')
        const donoId = h.getString('dono', '').trim()
        const donoNome = resolveActorName(donoId)
        const subId = h.getString('lead_submission_id', '').trim()
        const handoffId = h.getString('handoff_id', '').trim() || h.id
        const createdAt = h.getString('created_at', '')

        if (status === 'PENDENTE') {
          queueMetrics.pendentes++
        } else if (status === 'ASSUMIDO') {
          queueMetrics.assumidos++
        } else if (status === 'ENCERRADO_SEM_AGENDAMENTO') {
          queueMetrics.encerrados_sem_agendamento++
        }

        // Divergência integração x plataforma: encaminhamento órfão (sem submission correspondente)
        if (subId && submissionRows && !submissionsMap[subId]) {
          queueMetrics.divergencias++
          divergences.push({
            tipo: 'ENCAMINHAMENTO_SEM_SUBMISSAO',
            referencia_id: handoffId,
            responsavel: donoId ? donoNome : 'Pendente de atribuição (Gestão / Supervisora)',
            responsavel_id: donoId || '',
            detalhe: 'Encaminhamento existe na plataforma sem submissão de lead correspondente.',
            detectado_em: createdAt,
          })
        }
      }
    }

    // Análise de falhas em handoff_events (ex: HANDOFF_FAILED ou payload com erro)
    if (handoffEventRows) {
      for (const ev of handoffEventRows) {
        const type = ev.getString('event_type', '')
        const actorId = ev.getString('actor_id', '').trim()
        const evId = ev.getString('event_id', '') || ev.id
        const occurredAt = ev.getString('occurred_at', '')
        if (type === 'HANDOFF_FAILED') {
          if (actorId) {
            queueMetrics.falhas_com_dono++
            pendingFailuresWithOwner.push({
              evento_id: evId,
              tipo: 'FALHA_ENCAMINHAMENTO',
              responsavel: resolveActorName(actorId),
              responsavel_id: actorId,
              data: occurredAt,
              detalhe: 'Falha no processamento do encaminhamento registrada com responsável.',
            })
          } else {
            queueMetrics.falhas_sem_dono++
          }
        }
      }
    }

    // Análise de lead_appointments (conflitos, falhas com dono, divergências)
    if (appointmentRows) {
      for (const appt of appointmentRows) {
        const apptId = appt.getString('appointment_id', '').trim() || appt.id
        const subId = appt.getString('lead_submission_id', '').trim()
        const conflict = appt.get('conflict_detected') === true
        const donoId = appt.getString('dono', '').trim()
        const donoNome = resolveActorName(donoId)
        const status = appt.getString('status', '')
        const createdAt = appt.getString('created_at', '')

        if (conflict) {
          queueMetrics.conflitos++
          conflictItems.push({
            appointment_id: apptId,
            responsavel: donoId ? donoNome : 'Pendente de atribuição (Gestão / Supervisora)',
            responsavel_id: donoId || '',
            status: status,
            data: createdAt,
            detalhe: 'Conflito de agendamento detectado (sobreposição de horário ou reenvio).',
          })
        }

        // Divergência: agendamento concluído ou em encaminhamento sem submissão de origem
        if (subId && submissionRows && !submissionsMap[subId]) {
          queueMetrics.divergencias++
          divergences.push({
            tipo: 'AGENDAMENTO_SEM_SUBMISSAO',
            referencia_id: apptId,
            responsavel: donoId ? donoNome : 'Pendente de atribuição (Gestão / Supervisora)',
            responsavel_id: donoId || '',
            detalhe: 'Agendamento registrado sem submissão de lead correspondente no banco.',
            detectado_em: createdAt,
          })
        }
      }
    }

    // Análise de eventos de appointment para reprocessamento e conflito
    if (appointmentEventRows) {
      for (const ev of appointmentEventRows) {
        const type = ev.getString('event_type', '')
        const actorId = ev.getString('actor_id', '').trim()
        const evId = ev.getString('event_id', '') || ev.id
        const occurredAt = ev.getString('occurred_at', '')

        if (type === 'APPOINTMENT_REASSIGNED') {
          queueMetrics.reprocessados++
        }
        if (type === 'APPOINTMENT_CONFLICT') {
          // Já contabilizado ou complementado
          if (actorId && !pendingFailuresWithOwner.some((p) => p.evento_id === evId)) {
            pendingFailuresWithOwner.push({
              evento_id: evId,
              tipo: 'CONFLITO_COM_RESPONSAVEL',
              responsavel: resolveActorName(actorId),
              responsavel_id: actorId,
              data: occurredAt,
              detalhe: 'Conflito de agendamento registrado na trilha.',
            })
          }
        }
      }
    }

    // 6. Conversão por formulário e campanha (reutilizando fórmula da Fase 3)
    // Numerador = agendamentos concluídos no período
    // Denominador = encaminhamentos humanos no mesmo período
    // Janela móvel de 30 dias; baseline por mês civil America/Bahia
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
      const safeFormId = looksSensitive(meta.form_id) ? 'Identificador ocultado' : meta.form_id
      const safeVersion = looksSensitive(meta.form_version) ? 'versão ocultada' : meta.form_version
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
      else if (!handoffKeys[key].submission_id && submissionId) {
        handoffKeys[key].submission_id = submissionId
      }
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
      if (!completedAppointments[appointmentId]) {
        completedAppointments[appointmentId] = { submission_id: submissionId || '' }
      } else if (!completedAppointments[appointmentId].submission_id && submissionId) {
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
      const meta = submissionId ? submissionsMap[submissionId] || null : null
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
    // Regra dura: nunca fabricar zero nem inventar número quando fontes falham
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

    // 7. Histórico append-only das alterações de encaminhamento e agendamento
    // event_id, ação, autor, data vindo de lead_handoff_events e lead_appointment_events
    // Nenhum contato individual exposto; rollback não apaga histórico.
    const appendOnlyHistory = []

    if (handoffEventRows) {
      for (const ev of handoffEventRows) {
        const evId = ev.getString('event_id', '') || ev.id
        const type = ev.getString('event_type', '')
        const occurredAt = ev.getString('occurred_at', '')
        const actorId = ev.getString('actor_id', '').trim()
        appendOnlyHistory.push({
          event_id: evId,
          origem: 'lead_handoff_events',
          acao: type,
          autor: resolveActorName(actorId),
          autor_id: actorId,
          data: occurredAt,
        })
      }
    }

    if (appointmentEventRows) {
      for (const ev of appointmentEventRows) {
        const evId = ev.getString('event_id', '') || ev.id
        const type = ev.getString('event_type', '')
        const occurredAt = ev.getString('occurred_at', '')
        const actorId = ev.getString('actor_id', '').trim()
        appendOnlyHistory.push({
          event_id: evId,
          origem: 'lead_appointment_events',
          acao: type,
          autor: resolveActorName(actorId),
          autor_id: actorId,
          data: occurredAt,
        })
      }
    }

    // Ordenar histórico pelo mais recente
    appendOnlyHistory.sort((a, b) => {
      const ta = Date.parse(a.data || '') || 0
      const tb = Date.parse(b.data || '') || 0
      return tb - ta
    })

    // Retorna a resposta completa da saúde da integração
    return e.json(200, {
      available: true,
      partial,
      read_errors: readErrors,
      sources: sourcesStatus,
      sync_control: {
        enabled: syncSettings ? syncSettings.get('enabled') === true : false,
        updated_at: syncSettings ? syncSettings.getString('updated_at', '') : '',
        updated_by: syncSettings ? resolveActorName(syncSettings.getString('updated_by', '')) : '',
        reason: syncSettings ? syncSettings.getString('reason', '') : '',
        events: formattedSyncControlEvents,
      },
      queue_state: {
        metrics: queueMetrics,
        failures_with_owner: pendingFailuresWithOwner,
        conflicts: conflictItems,
        divergences: divergences,
      },
      conversion: {
        period,
        formula: 'agendamentos concluídos no período ÷ encaminhamentos humanos no mesmo período',
        baseline_period: 'janela móvel de 30 dias (baseline por mês civil America/Bahia)',
        metric: {
          name: 'Agendamentos concluídos por encaminhamentos humanos',
          numerator: partial ? null : numerator,
          denominator: partial ? null : denominator,
          rate,
        },
        coverage: {
          total_submissions: totalSubmissions,
          attribution_received: attributionCounts.recebida,
          attribution_incomplete: attributionCounts.incompleta,
          attribution_absent: attributionCounts.ausente,
          attribution_unknown: attributionCounts.desconhecida,
          complete_rate: coverage,
          is_incomplete: totalSubmissions === 0 || coverage === null || coverage < 1.0,
        },
        comparisons: {
          by_form_version: exportGroups(groups.by_form_version),
          by_campaign: exportGroups(groups.by_campaign),
        },
      },
      audit_trail: appendOnlyHistory.slice(0, 100),
      policy: {
        b4_03_confirmed: b4_03Confirmed,
        read_roles: allowedRoles,
        note: 'B4-03 pendente de confirmação documental no repositório; nenhum dado de contato individual exposto.',
      },
    })
  },
  $apis.requireAuth(),
)
