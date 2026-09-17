// F2-IMP-007 — Usuário sintético de teste humano (papel consultor) para a /visao.
// Padrão estabelecido: criado para o teste, removido após o aceite.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const user = new Record(users)
    user.set('email', 'fila.teste@fellice-fitness.local')
    user.set('role', 'consultor')
    user.setPassword('FilaTeste@2026')
    user.set('verified', true)
    app.save(user)
  },
  (app) => {
    try {
      app.delete(app.findFirstRecordByData('users', 'email', 'fila.teste@fellice-fitness.local'))
    } catch (_) {}
  },
)
