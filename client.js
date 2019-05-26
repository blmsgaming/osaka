const WebSocket = require('ws')
const socket = new WebSocket('ws://localhost:8080')

let state = {}

function send(eventName, payload) {
  const merged = {
    eventName: eventName, 
    user: {
      id: state.id
    }, 
    ...payload}
  socket.send(JSON.stringify(merged))
}

socket.addEventListener('open', () => {
  const data = {
    username: 'bob'
  }
  send('user-join', data)
})

socket.addEventListener('message', event => {
  console.log(`Message from server: ${event.data}`)
  const data = JSON.parse(event.data)
  switch (data.eventName) {
    case 'uuid-res':
      state.id = data.id
      break
    case 'round-start':
      break
    case 'round-quest':
      state.q = data.q
      send('round-res', { idx: Math.floor(4 * Math.random()) })
      break
    case 'round-end':
      if (data.correct) {
        console.log('Answer was correct!')
      } else {
        console.log('Wrong answer')
      }
      break
    case 'round-tick':
      console.log(`time left: ${data.timeLeft}`)
      break
    case 'game-end':
      console.log('Game ended!')
      break
    default:
      console.log(`Bad eventName: ${data.eventName}`)
  }
})