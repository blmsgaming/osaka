const WebSocket = require('ws')

class Game {
  constructor() {
    this.players = []
    this.questions = [
      {
        question: `What is Mr. Cook's first name?`,
        answers: [
          'Quentin', 'Darrin', 'Cameron', 'Travis Scott'
        ]
      }
    ]
    this.state = 'wait'
  }

  addPlayer(player) {
    this.players.push(player)
  }

  startRound() {
    this.state = 'round'
    const matches = []
    const chunkSize = 2
    for (let i = 0; i < this.players.length; i += chunkSize) {
      const players = this.players.slice(i, i + chunkSize)
      matches.push(new Match(this.questions[0], players))
    }

    for (const match of matches) {
      match.start()
    }
  }

  print() {
    console.log(`${this.players.length} Connected clients:`)
    for (const player of this.players) {
      console.log(player.toString())
    }
  }
}

class Match {
  constructor(question, players) {
    this.question = question
    this.players = players
  }

  start() {
    for (const player of this.players) {
      player.socket.send(JSON.stringify(this.question))
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
    game.addPlayer(new Player(socket, data.username))
    game.print()
  })
  socket.send('Hello world!')
})

setInterval(() => {
  if (game.players.length > 1 && game.state === 'wait') {
    game.startRound()
  }
}, 1000)