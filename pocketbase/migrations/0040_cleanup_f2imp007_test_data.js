// F2-IMP-007 — Limpeza pós-aceite (padrão estabelecido: criar p/ prova, remover
// após o aceite humano). Remove:
// 1. eventos APPOINTMENT_ASSUMED das tentativas de teste 007/007b (inclui os 3
//    eventos com actor vazio do reteste de 2026-09-18 — evidência registrada no
//    aprendizado AP-2026-09-18-0940 antes da remoção);
// 2. as tentativas sintéticas appt-teste-fila-007 e appt-teste-fila-007b
//    (assumidas durante as provas/teste; o hook não permite desfazer a assunção);
// 3. os usuários sintéticos fila.teste@ e marketing.teste@ (senhas provisórias
//    deixam de existir).
// Permanecem: as 4 fixtures appt-teste-0001..0004 (0008/0017/0030), o evento
// APPOINTMENT_ASSUMED da appt-teste-0004 (histórico da prova) e o valor 'gestao'
// no select role (necessário na F2-IMP-008).

migrate(
  (app) => {
    const testIds = ['appt-teste-fila-007', 'appt-teste-fila-007b']
    // 1. eventos das tentativas de teste
    for (const apptId of testIds) {
      let rows = []
      try {
        rows = $app.findRecordsByFilter(
          'lead_appointment_events',
          'appointment_id = {:id}',
          '',
          0,
          0,
          { id: apptId },
        )
      } catch (_) {}
      for (const r of rows) {
        try {
          $app.delete(r)
        } catch (_) {}
      }
    }
    // 2. tentativas de teste
    for (const apptId of testIds) {
      try {
        $app.delete($app.findFirstRecordByData('lead_appointments', 'appointment_id', apptId))
      } catch (_) {}
    }
    // 3. usuários sintéticos
    const emails = ['fila.teste@fellice-fitness.local', 'marketing.teste@fellice-fitness.local']
    for (const email of emails) {
      try {
        $app.delete($app.findFirstRecordByData('users', 'email', email))
      } catch (_) {}
    }
  },
  (app) => {
    // down: não recria dados de teste
  },
)
