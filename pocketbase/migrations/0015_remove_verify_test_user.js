// F2-IMP-003 — limpeza pós-teste humano (2026-09-17, aprovado: "teste realizado e funcionou").
// Remove o usuário sintético temporário criado na 0014. Down: recria se reexecução for precisa.

migrate(
  (app) => {
    try {
      app.delete(
        app.findFirstRecordByData('users', 'email', 'verifica.teste@fellice-fitness.local'),
      )
    } catch (_) {}
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    try {
      app.findFirstRecordByData('users', 'email', 'verifica.teste@fellice-fitness.local')
    } catch (_) {
      const user = new Record(users)
      user.set('email', 'verifica.teste@fellice-fitness.local')
      user.setPassword('VerificaTeste@2026')
      user.set('role', 'consultor')
      user.set('name', 'Verificação de Teste')
      user.set('verified', true)
      app.save(user)
    }
  },
)
