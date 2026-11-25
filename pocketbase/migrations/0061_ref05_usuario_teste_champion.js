// REF-05 — Usuário sintético de teste humano (papel champion) para a /fila.
// Autorização do consultor em 06/11/2026: "Criar usuário de teste champion
// temporário via migração (precedente 0038; eu removo após o teste)";
// observação: "usuário: teste r1 / remover ao finalizar o projeto".
// Padrão estabelecido na 0038: criado para o teste, removido após o aceite
// (aqui, ao finalizar o projeto — pendência humana registrada no estado).

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const user = new Record(users)
    user.set('email', 'teste.r1@fellice-fitness.local')
    user.set('role', 'champion')
    user.setPassword('TesteR1@2026')
    user.set('verified', true)
    app.save(user)
  },
  (app) => {
    try {
      app.delete(app.findFirstRecordByData('users', 'email', 'teste.r1@fellice-fitness.local'))
    } catch (_) {}
  },
)
