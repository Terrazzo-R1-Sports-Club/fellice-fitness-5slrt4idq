// F2-IMP-006 — Usuário sintético para o teste humano da /visao.
// Padrão estabelecido nas tasks anteriores: criado para o teste, removido após o aceite.
// Credencial provisória comunicada ao consultor no chat; NUNCA registrada em repositório.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const user = new Record(users)
    user.set('email', 'visao.teste@fellice-fitness.local')
    user.set('role', 'consultor')
    user.setPassword('VisaoTeste@2026')
    user.set('verified', true)
    app.save(user)
  },
  (app) => {
    try {
      app.delete(app.findFirstRecordByData('users', 'email', 'visao.teste@fellice-fitness.local'))
    } catch (_) {}
  },
)
