url = 'ws://daad93b2.ngrok.io'

ws = new WebSocket(url)

ws.onopen = function () {
  console.log("Opened WebSocket")
}

ws.onclose = function (e) {
  console.log("closed")
}

ws.onerror = function (e) {
  console.log("error")
}

function send(eventName, payload) {
  const merged = {
    eventName: eventName,
    ...payload
  }
  ws.send(JSON.stringify(merged))
}

function sendStartGame() {
  send('admin-start-game', {})
}