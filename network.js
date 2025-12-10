// network.js
// Pequena camada global para comunicar com o servidor do enunciado.
// Usa fetch para POST JSON e EventSource para /update SSE.
// Inclui: register, join, leave, roll, notify, pass, startUpdateListener, stopUpdateListener
// Uso (ex.): Network.join({group, nick, password, size}).then(resp => ...);
// Este ficheiro assume ser carregado antes do onlineAdapter.js e depois antes do main.js
(function (global) {
  const SERVER_BASE = "http://twserver.alunos.dcc.fc.up.pt:8008";

  function handleResponse(res) {
    return res.text().then(text => {
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (e) { /* ignore parse error */ }
      if (!res.ok) {
        const err = json && json.error ? json.error : (text || `HTTP ${res.status}`);
        const e = new Error(err);
        e.status = res.status;
        e.body = json;
        throw e;
      }
      return json;
    });
  }

  function post(path, body) {
    return fetch(`${SERVER_BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "omit"
    }).then(handleResponse);
  }

  function register({ nick, password }) {
    return post("register", { nick, password });
  }

  function join({ group, nick, password, size }) {
    return post("join", { group, nick, password, size });
  }

  function leave({ nick, password, game }) {
    return post("leave", { nick, password, game });
  }

  function roll({ nick, password, game }) {
    return post("roll", { nick, password, game });
  }

  function notify({ nick, password, game, move }) {
    return post("notify", { nick, password, game, move });
  }

  function passTurn({ nick, password, game }) {
    return post("pass", { nick, password, game });
  }

  let es = null;
  function startUpdateListener({ game, nick }, onMessage, onError) {
    stopUpdateListener();
    const url = `${SERVER_BASE}/update?game=${encodeURIComponent(game)}&nick=${encodeURIComponent(nick)}`;
    es = new EventSource(url);
    es.onmessage = function (e) {
      console.log("[SSE Raw]", e.data); // DEBUG
      try {
        const data = JSON.parse(e.data);
        onMessage && onMessage(data);
      } catch (err) {
        console.error("Invalid update payload", e.data, err);
      }
    };
    es.onerror = function (err) {
      // onerror é chamado para reconnection attempts e erros
      onError && onError(err);
    };
    return es;
  }

  function stopUpdateListener() {
    if (es) {
      try { es.close(); } catch (e) { /* ignore */ }
      es = null;
    }
  }

  global.Network = {
    SERVER_BASE,
    register,
    join,
    leave,
    roll,
    notify,
    passTurn,
    startUpdateListener,
    stopUpdateListener
  };
})(window);