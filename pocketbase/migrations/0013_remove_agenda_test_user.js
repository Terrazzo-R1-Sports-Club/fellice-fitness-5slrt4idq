// F2-IMP-002 — limpeza pós-teste humano (2026-09-17, aprovado: "funcionou").
// Remove o usuário sintético temporário criado na 0012, encerrando o acesso provisório.
// Down: recria o usuário apenas se uma reexecução for necessária.

migrate(
  (app) => {
    try {
      app.delete(app.findFirstRecordByData('users', 'email', 'agenda.teste@fellice-fitness.local'))
    } catch (_) {}
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    try {
      app.findFirstRecordByData('users', 'email', 'agenda.teste@fellice-fitness.local')
    } catch (_) {
      const user = new Record(users)
      user.set('email', 'agenda.teste@fellice-fitness.local')
      user.setPassword('AgendaTeste@2026')
      user.set('role', 'consultor')
      user.set('name', 'Responsável de Agenda (teste)')
      user.set('verified', true)
      app.save(user)
    }
  },
)
