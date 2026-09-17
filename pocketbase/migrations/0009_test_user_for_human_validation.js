// F2-IMP-001 — teste humano: cria o usuário sintético de teste com senha provisória
// conhecida, para que o consultor valide a leitura autenticada das coleções da Fase 2.
// Papel: consultor. Senha provisória: ConsultorTeste@2026 (trocar depois do teste).
// Idempotente: se o usuário já existir, apenas garante o papel e a senha provisória.
// Down: remove o usuário sintético.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    let user
    try {
      user = app.findFirstRecordByData('users', 'email', 'consultor.teste@fellice-fitness.local')
      user.setPassword('ConsultorTeste@2026')
      user.set('role', 'consultor')
      app.save(user)
    } catch (_) {
      user = new Record(users)
      user.set('email', 'consultor.teste@fellice-fitness.local')
      user.setPassword('ConsultorTeste@2026')
      user.set('role', 'consultor')
      user.set('name', 'Consultor de Teste')
      user.set('verified', true)
      app.save(user)
    }
  },
  (app) => {
    try {
      app.delete(
        app.findFirstRecordByData('users', 'email', 'consultor.teste@fellice-fitness.local'),
      )
    } catch (_) {}
  },
)
