// F2-IMP-001 — limpeza pós-teste humano (2026-09-17, aprovado).
// Remove o usuário sintético de teste criado na 0009, encerrando o acesso provisório.
// A senha provisória deixa de existir; futuras tasks (F2-IMP-002+) criam usuários
// sintéticos próprios, com ciclo de vida igual: criar → testar → remover.

migrate(
  (app) => {
    try {
      app.delete(
        app.findFirstRecordByData('users', 'email', 'consultor.teste@fellice-fitness.local'),
      )
    } catch (_) {}
  },
  (app) => {
    // down: recria o usuário de teste apenas se uma reexecução for necessária
    const users = app.findCollectionByNameOrId('users')
    try {
      app.findFirstRecordByData('users', 'email', 'consultor.teste@fellice-fitness.local')
    } catch (_) {
      const user = new Record(users)
      user.set('email', 'consultor.teste@fellice-fitness.local')
      user.setPassword('ConsultorTeste@2026')
      user.set('role', 'consultor')
      user.set('name', 'Consultor de Teste')
      user.set('verified', true)
      app.save(user)
    }
  },
)
