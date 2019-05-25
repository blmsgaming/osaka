const WebSocket = require('ws')


class Game {
  constructor() {
    this.clients = []
  }

  addClient(player) {
    this.clients.push(player)
  }

  print() {
    console.log(`${this.clients.length} Connected clients:`)
    for (const client of this.clients) {
      console.log(client.toString())
    }
  }
}

class Player {
  constructor(socket, username) {
    this.socket = socket
    this.username = username
  }

  toString() {
    return `username: ${this.username}`
  }
}

const game = new Game()
const wss = new WebSocket.Server({ port: 8080 })
wss.on('connection', socket => {
  socket.on('message', message => {
    console.log(`received from a client: ${message}`)
    const data = JSON.parse(message)
    game.addClient(new Player(socket, data.username))
    game.print()
  })
  socket.send('Hello world!')
})