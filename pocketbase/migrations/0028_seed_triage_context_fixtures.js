// F2-IMP-006 — Fixtures de contexto da triagem nos 4 registros sintéticos.
// A visão operacional precisa mostrar objetivo, proximidade, ocupação, interesse e UTMs.

migrate(
  (app) => {
    const contexts = {
      'appt-teste-0001': {
        objetivo: 'Ganho de massa muscular',
        proximidade:
          'Moro no Itaigara ou bairros vizinhos (Pituba, Caminho das Árvores, Costa Azul)',
        ocupacao: 'CLT',
        interesse_em_visita: 'Sim, quero agendar uma visita presencial',
        utm_source: 'instagram',
        utm_medium: 'cpc',
        utm_campaign: 'promocao-setembro',
        attribution_status: 'recebida',
      },
      'appt-teste-0002': {
        objetivo: 'Emagrecimento',
        proximidade: 'Trabalho na região do Itaigara',
        ocupacao: 'Autônomo/Empresário',
        interesse_em_visita: 'Sim, quero agendar uma aula experimental',
        utm_source: 'facebook',
        utm_medium: 'cpc',
        utm_campaign: 'verao-2026',
        attribution_status: 'recebida',
      },
      'appt-teste-0003': {
        objetivo: 'Condicionamento físico e resistência',
        proximidade: 'Passo com frequência pela região',
        ocupacao: 'Estudante',
        interesse_em_visita: 'Quero receber mais informações antes de decidir',
        utm_source: 'google',
        utm_medium: 'organic',
        utm_campaign: '',
        attribution_status: 'incompleta',
      },
      'appt-teste-0004': {
        objetivo: 'Saúde, mobilidade e qualidade de vida',
        proximidade: 'Moro/trabalho em outra região, mas me desloco para treinar',
        ocupacao: 'Profissional da saúde, educação ou outra área com horário irregular',
        interesse_em_visita: 'Ainda não defini meu objetivo',
        utm_source: '',
        utm_medium: '',
        utm_campaign: '',
        attribution_status: 'ausente',
      },
    }
    for (const [apptId, ctx] of Object.entries(contexts)) {
      try {
        const rec = app.findFirstRecordByData('lead_appointments', 'appointment_id', apptId)
        for (const [k, v] of Object.entries(ctx)) {
          rec.set(k, v)
        }
        app.save(rec)
      } catch (_) {}
    }
  },
  (app) => {
    // down: limpa o contexto das fixtures
    const names = [
      'objetivo',
      'proximidade',
      'ocupacao',
      'interesse_em_visita',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'attribution_status',
    ]
    const rows = app.findRecordsByFilter(
      'lead_appointments',
      "appointment_id ~ 'appt-teste'",
      '',
      0,
      0,
    )
    rows.forEach((r) => {
      names.forEach((n) => r.set(n, ''))
      app.save(r)
    })
  },
)
