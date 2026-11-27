// T01-PWD — Rate limit do login por conta/IP usando a coleção `login_attempts`
// (criada pela migração 0074). Bloqueio temporário: falhas na janela => 429.
// Contadores expiram pela janela, sem job de limpeza.
//
// Nota sobre a plataforma: um hook de auth que responde sem chamar e.next()
// registra um warning ("served hooks can finish without calling e.next()") no
// log de hooks do painel; é o comportamento esperado do bloqueio 429 e não
// indica falha na requisição do cliente.
//
// Limitação da plataforma (JSVM): callbacks rodam em pool separado, então
// TODA a lógica vive inline dentro do callback — sem funções de topo.

onRecordAuthRequest(function (e) {
  var MAX_FALHAS_CONTA = 5 // falhas por e-mail na janela antes de bloquear
  var MAX_FALHAS_IP = 15 // falhas por IP na janela antes de bloquear
  var JANELA_SEGUNDOS = 15 * 60 // janela de avaliação: 15 minutos

  var info = e.requestInfo()
  var email = ''
  if (info && info.body && info.body.identity) {
    email = String(info.body.identity).toLowerCase().trim()
  }
  var ip = e.realIp || ''

  var params = {
    janela: new Date(Date.now() - JANELA_SEGUNDOS * 1000).toISOString(),
    email: email,
    ip: ip,
  }

  function contarFalhas(filtro) {
    var registros = $app.findRecordsByFilter(
      'login_attempts',
      filtro,
      '-attempted_at',
      200,
      0,
      params,
    )
    return registros.length
  }

  function registrar(falhou) {
    var colecao = $app.findCollectionByNameOrId('login_attempts')
    var registro = new Record(colecao)
    registro.set('email_norm', email)
    registro.set('ip', ip)
    registro.set('failed', falhou)
    registro.set('attempted_at', new Date().toISOString())
    $app.save(registro)
  }

  // 1) Bloqueio preventivo: se a conta ou o IP já estourou a janela, 429.
  if (email) {
    var falhasConta = contarFalhas(
      'attempted_at >= {:janela} && email_norm = {:email} && failed = true',
    )
    if (falhasConta >= MAX_FALHAS_CONTA) {
      throw new ApiError(
        429,
        'Muitas tentativas de login para esta conta. Aguarde alguns minutos antes de tentar novamente.',
      )
    }
  }
  if (ip) {
    var falhasIp = contarFalhas('attempted_at >= {:janela} && ip = {:ip} && failed = true')
    if (falhasIp >= MAX_FALHAS_IP) {
      throw new ApiError(
        429,
        'Muitas tentativas de login a partir desta rede. Aguarde alguns minutos antes de tentar novamente.',
      )
    }
  }

  // 2) Deixar o PocketBase decidir a autenticação e capturar o resultado:
  //    se e.next() lançar (senha errada, usuário inexistente), registramos
  //    a falha e re-lançamos o erro original para o cliente.
  try {
    e.next()
  } catch (err) {
    registrar(true)
    throw err
  }
  registrar(false)
}, 'users')
