// F2-IMP-007 — Usuário sintético SEM permissão (papel marketing) para a prova negativa
// do CA-2.09: usuário sem papel champion/consultor não altera estado (regra da coleção
// recusa). Removido após o ciclo de provas/teste humano.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const user = new Record(users)
    user.set('email', 'marketing.teste@fellice-fitness.local')
    user.set('role', 'marketing')
    user.setPassword('MarketingTeste@2026')
    user.set('verified', true)
    app.save(user)
  },
  (app) => {
    try {
      app.delete(
        app.findFirstRecordByData('users', 'email', 'marketing.teste@fellice-fitness.local'),
      )
    } catch (_) {}
  },
)
