// T02 — Usuário efêmero de prova (papel consultor) — padrão 0061/0038.
// Criado para a prova de segurança da T02 (matriz de acesso: papel FORA da matriz
// deve ser NEGADO na Fila/Visão/controles). Removido pela migração de limpeza 0069
// ao final das provas. Autorização: Ricardo "pode executar" 25/11/2026 11:42.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const user = new Record(users)
    user.set('email', 't02.prova@fellice-fitness.local')
    user.set('role', 'consultor')
    user.setPassword('T02Prova@2026')
    user.set('verified', true)
    app.save(user)
  },
  (app) => {
    try {
      app.delete(app.findFirstRecordByData('users', 'email', 't02.prova@fellice-fitness.local'))
    } catch (_) {}
  },
)
