// F2-IMP-008 — usuários sintéticos temporários para o teste humano.
// Remover após o aceite em migração de limpeza; senhas não são credenciais reais.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const fixtures = [
      {
        email: 'gestao.f2imp008@fellice-fitness.local',
        role: 'gestao',
        password: 'GestaoF2Imp008@2026',
      },
      {
        email: 'supervisora.f2imp008@fellice-fitness.local',
        role: 'supervisora',
        password: 'SupervisoraF2Imp008@2026',
      },
      {
        email: 'consultor.f2imp008@fellice-fitness.local',
        role: 'consultor',
        password: 'ConsultorF2Imp008@2026',
      },
    ]
    for (const data of fixtures) {
      try {
        app.findFirstRecordByData('users', 'email', data.email)
      } catch (_) {
        const user = new Record(users)
        user.set('email', data.email)
        user.set('role', data.role)
        user.setPassword(data.password)
        user.set('verified', true)
        app.save(user)
      }
    }
  },
  (app) => {
    const emails = [
      'gestao.f2imp008@fellice-fitness.local',
      'supervisora.f2imp008@fellice-fitness.local',
      'consultor.f2imp008@fellice-fitness.local',
    ]
    for (const email of emails) {
      try {
        app.delete(app.findFirstRecordByData('users', 'email', email))
      } catch (_) {}
    }
  },
)
