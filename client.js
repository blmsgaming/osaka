const WebSocket = require('ws')
const socket = new WebSocket('ws://localhost:8080')

socket.addEventListener('open', () => {
  const data = {
    username: 'bob'
  }
  socket.send(JSON.stringify(data))
})

socket.addEventListener('message', event => {
  console.log(`Message from server: ${event.data}`)
})