// F2-IMP-006 — PROVA da herança de contexto (CA-2.06): cria uma lead_submission sintética
// (o hook copia o contexto para o appointment no create) e um appointment vinculado.
// Depois da prova, a migração 0032 remove ambos. Roda em duas migrações porque o hook
// roda no create do appointment (a submission precisa existir antes).

migrate(
  (app) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000Z'
    // 1. submission sintética com contexto completo
    const subs = app.findCollectionByNameOrId('lead_submissions')
    const sub = new Record(subs)
    sub.set('lead_submission_id', 'sub-contexto-prova-006')
    sub.set('form_id', 'fellice-captura-01')
    sub.set('form_version', 'v1.0.0')
    sub.set('started_at', now)
    sub.set('submitted_at', now)
    sub.set('nome', 'Lead Contexto Prova')
    sub.set('canal_de_retorno', '+55 71 90000-0001')
    sub.set('objetivo', 'Melhorar a performance esportiva')
    sub.set('proximidade', 'Trabalho na região do Itaigara')
    sub.set('ocupacao', 'Executivo/Gestor')
    sub.set('interesse_em_visita', 'Sim, quero agendar uma aula experimental')
    sub.set('precisa_de_ajuda_humana', false)
    sub.set('consentimento', true)
    sub.set('consentimento_at', now)
    sub.set('utm_source', 'tiktok')
    sub.set('utm_medium', 'cpc')
    sub.set('utm_campaign', 'treino-hoje')
    sub.set('attribution_status', 'recebida')
    sub.set('triagem_status', 'TRIAGEM_CONCLUIDA')
    app.save(sub)

    // 2. appointment vinculado — o hook copia o contexto no create
    const appts = app.findCollectionByNameOrId('lead_appointments')
    const appt = new Record(appts)
    appt.set('appointment_id', 'appt-contexto-prova-006')
    appt.set('lead_submission_id', 'sub-contexto-prova-006')
    appt.set('form_id', 'fellice-captura-01')
    appt.set('form_version', 'v1.0.0')
    appt.set('slot_id', '')
    appt.set('slot_datetime', now)
    appt.set('slot_duration_min', 30)
    appt.set('nome', 'Lead Contexto Prova')
    appt.set('telefone_ou_canal_de_retorno', '+55 71 90000-0001')
    appt.set('status', 'ENCAMINHAMENTO_HUMANO')
    appt.set('conflict_detected', false)
    appt.set('handoff_reason', 'prova de herança de contexto (F2-IMP-006)')
    appt.set('created_at', now)
    app.save(appt)
  },
  (app) => {
    // down: remove a prova
    try {
      app.delete(
        app.findFirstRecordByData('lead_appointments', 'appointment_id', 'appt-contexto-prova-006'),
      )
    } catch (_) {}
    try {
      app.delete(
        app.findFirstRecordByData(
          'lead_submissions',
          'lead_submission_id',
          'sub-contexto-prova-006',
        ),
      )
    } catch (_) {}
  },
)
