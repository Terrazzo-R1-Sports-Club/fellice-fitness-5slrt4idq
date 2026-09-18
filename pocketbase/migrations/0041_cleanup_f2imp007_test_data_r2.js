// F2-IMP-007 — Limpeza pós-aceite, rodada 2. A 0040 não removeu nada: usou `$app`
// (global de HOOKS) dentro da migração, onde o acesso correto é o parâmetro `app`
// (padrão das migrações 0020/0026/0032/0034) — os try/catch engoliram o erro e a
// migração foi aplicada como no-op silencioso. Esta 0041 refaz a limpeza com o
// padrão correto e registra no log o que removeu.
// Remove: eventos APPOINTMENT_ASSUMED das tentativas de teste 007/007b (os 3 com
// actor vazio do reteste de 2026-09-18 tiveram evidência registrada no aprendizado
// AP-2026-09-18-0940 antes da remoção), as tentativas 007/007b e os usuários
// sintéticos fila.teste@ / marketing.teste@.
// Permanecem: fixtures appt-teste-0001..0004, evento APPOINTMENT_ASSUMED da
// appt-teste-0004 e o valor 'gestao' no select role (F2-IMP-008).

migrate(
  (app) => {
    const testIds = ['appt-teste-fila-007', 'appt-teste-fila-007b']
    let removedEvents = 0
    let removedAppts = 0
    let removedUsers = 0

    // 1. eventos das tentativas de teste
    for (const apptId of testIds) {
      let rows = []
      try {
        rows = app.findRecordsByFilter(
          'lead_appointment_events',
          'appointment_id = {:id}',
          '',
          0,
          0,
          { id: apptId },
        )
      } catch (err) {
        console.log('0041 filtro de eventos falhou', apptId, String(err))
      }
      for (const r of rows) {
        try {
          app.delete(r)
          removedEvents++
        } catch (err) {
          console.log('0041 delete evento falhou', apptId, String(err))
        }
      }
    }

    // 2. tentativas de teste
    for (const apptId of testIds) {
      try {
        app.delete(app.findFirstRecordByData('lead_appointments', 'appointment_id', apptId))
        removedAppts++
      } catch (err) {
        console.log('0041 delete tentativa falhou', apptId, String(err))
      }
    }

    // 3. usuários sintéticos
    const emails = ['fila.teste@fellice-fitness.local', 'marketing.teste@fellice-fitness.local']
    for (const email of emails) {
      try {
        app.delete(app.findFirstRecordByData('users', 'email', email))
        removedUsers++
      } catch (err) {
        console.log('0041 delete usuário falhou', email, String(err))
      }
    }

    console.log(
      '0041 limpeza F2-IMP-007:',
      removedEvents,
      'eventos,',
      removedAppts,
      'tentativas,',
      removedUsers,
      'usuários removidos',
    )
  },
  (app) => {
    // down: não recria dados de teste
  },
)
