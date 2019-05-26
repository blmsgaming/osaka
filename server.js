const WebSocket = require('ws')

const uuid = require('uuid/v1')

const GameState = {
  LOBBY: 1,
  ROUNDS: 2
}

function send(socket, payload) {
  socket.send(JSON.stringify(payload))
}

class Game {
  constructor() {
    this.players = new Map()
    this.answers = new Map()
    this.questions = [
      {
        question: `What is Mr. Cook's first name?`,
        answers: [
          'Quentin', 'Darrin', 'Cameron', 'Travis Scott'
        ]
      }
    ]
    this.state = GameState.LOBBY
  }

  addPlayer(player) {
    this.players.set(player.id, player)
  }

  broadcast(data) {
    for (const p of this.players.values()) {
      send(p.socket, data)
    }
  }

  handleAnswerRes(id, idx) {
    this.answers.set(id, idx)
  }

  startRound() {
    this.answers = new Map()
    for (const k of this.players.keys()) {
      this.answers.set(k, -1)
    }

    this.broadcast({ eventName: 'round-start' })
    this.state = GameState.ROUNDS
    this.broadcast({
      eventName: 'round-quest',
      q: this.questions[0],
      number: 0})
  }

  print() {
    console.log(`${this.players.size} Connected clients:`)
    for (const player of this.players.values()) {
      console.log(player.toString())
    }
  }
}

class Player {
  constructor(socket, username, id) {
    this.socket = socket
    this.username = username
    this.id = id
  }

  toString() {
    return `username: ${this.username}`
  }
}

const game = new Game()
const wss = new WebSocket.Server({ port: 8080 })
wss.on('connection', socket => {
  socket.on('message', message => {
    console.log(`Message from a client: ${message}`)
    const data = JSON.parse(message)
    switch (data.eventName) {
      case 'user-join':
        const id = uuid()
        game.addPlayer(new Player(socket, data.username, id))
        send(socket, { eventName: 'uuid-res', id: id })
        break
      case 'round-res':
        game.handleAnswerRes(data.id, data.idx)
        break
      default:
        console.log(`Bad eventName: ${data.eventName}`)
    }
  })
})

function tick() {
  game.print()
  if (game.players.size > 1 && game.state === GameState.LOBBY) {
    game.broadcast
    game.startRound()
  }
}

const ticksPerSec = 2
setInterval(tick, 1000 / ticksPerSec)