// T06 (Fase 5) / veredito T05 (D2) + confirmação do Champion em 26/11/2026
// (04_fase-atual/t06-confirmacoes-recebidas.md):
//
//   "parte 1 - todos os registros são testes, podem ser apagados, não são
//    dados reais, estava apenas testando o sistema"
//
// Por que esta migração existe, se a 0070 já limpou: a 0070 apagou por LISTA
// DE IDs (os registros que o inventário da T06 alcançou). Sobraram duas
// famílias de resíduo que a lista não cobria:
//
//   1. submissões e eventos criados pelos seeds antigos (0028/0030 e outros)
//      com IDs no formato UUID — 22 submissões com triagem concluída;
//   2. um agendamento de ENCAMINHAMENTO_HUMANO criado pela própria visita de
//      verificação a /agendar: acesso direto sem triagem gera handoff por
//      desenho (REF-06), então a prova cria um registro novo a cada visita.
//
// Como o Champion confirmou que NENHUM registro da jornada é real (produção
// nunca foi publicada, não houve campanha), a limpeza correta é por COLEÇÃO da
// jornada, e não por lista de IDs — que sempre deixa resíduo e envelhece.
//
// O que esta migração apaga (todas as linhas):
//   - lead_appointments, lead_appointment_events
//   - lead_handoffs, lead_handoff_events
//   - lead_submissions, lead_submission_events
// e zera a ocupação (agenda_slot_occupancy.active = 0).
//
// O que NÃO é tocado:
//   - agenda_slots (a grade é da 0071);
//   - lead_forms / lead_form_versions (configuração do formulário, não jornada);
//   - lead_queue_settings, lead_funnel_settings e suas policies (configuração);
//   - users: as contas permanentes. O usuário efêmero da 0072 sai aqui.
//
// Ordinal 0074 > 0053 (seeds): numa base nova, os seeds criam as fixtures e
// esta migração limpa tudo depois — o resultado final é banco vazio.
//
// Idempotente: percorre e apaga; numa base já vazia não encontra nada.

const COLECOES_JORNADA = [
  'lead_appointment_events',
  'lead_appointments',
  'lead_handoff_events',
  'lead_handoffs',
  'lead_submission_events',
  'lead_submissions',
]

migrate(
  (app) => {
    for (const colecao of COLECOES_JORNADA) {
      let apagados = 0
      try {
        // paginação defensiva: apaga em lotes até a coleção esvaziar
        for (let volta = 0; volta < 100; volta++) {
          const lote = app.findRecordsByFilter(colecao, '', '', 200, 0)
          if (!lote || lote.length === 0) break
          for (const record of lote) {
            try {
              app.delete(record)
              apagados += 1
            } catch (_) {}
          }
        }
      } catch (_) {}
      console.log('limpeza T06', colecao, 'apagados', String(apagados))
    }

    // ocupação volta a zero (a grade em si permanece)
    try {
      const ocupacoes = app.findRecordsByFilter('agenda_slot_occupancy', 'active > 0', '', 0, 0)
      for (const record of ocupacoes) {
        record.set('active', 0)
        app.save(record)
      }
    } catch (_) {}

    // 0072 mantida: o usuário efêmero de verificação continua existindo para o
    // teste humano da T06. Ele é removido antes da publicação em produção.
  },
  (app) => {
    // rollback vazio: os dados eram de teste e não têm valor a restaurar
    // (mesmo padrão da 0069 e da 0070).
  },
)
