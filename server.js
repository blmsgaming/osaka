const WebSocket = require('ws')

const uuid = require('uuid/v1')

const GameState = {
  LOBBY: 1,
  BATTLE: 2
}

function send(socket, eventName, payload) {
  const merged = { eventName: eventName, ...payload}
  socket.send(JSON.stringify(merged))
}

class Game {
  constructor(questions) {
    this.players = new Map()
    this.state = GameState.LOBBY
    this.roundNumber = 0
    this.roundStart = 0
    this.questions = questions
    this.answers = null
  }

  get currentQ() {
    return this.questions[this.roundNumber]
  }

  addPlayer(player) {
    this.players.set(player.id, player)
  }

  broadcast(eventName, data) {
    for (const p of this.players.values()) {
      send(p.socket, eventName, data)
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
    this.broadcast('round-start', {
      q: {
        question: this.currentQ.question,
        choices: this.currentQ.choices
      },
      roundNumber: this.roundNumber
    })
    this.state = GameState.BATTLE
    this.roundStart = Date.now()
  }

  roundShouldEnd() {
    return Date.now() - this.roundStart > this.currentQ.duration
  }

  advanceRound() {
    for (const p of game.players.values()) {
      const ans = this.answers.get(p.id)
      const correct = (ans === this.currentQ.answer)
      send(p.socket, 'round-end', { correct: correct })
    }
    this.roundNumber++
  }

  isFinished() {
    return this.roundNumber >= this.questions.length
  }

  start() {
    this.broadcast('game-start', {})
  }

  end() {
    this.broadcast('game-end', {})
    for (const p of this.players.values()) {
      p.socket.close()
    }
  }

  tick() {
    const left = this.currentQ.duration - (Date.now() - this.roundStart)
    this.broadcast('round-tick', { timeLeft: left })
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

const wss = new WebSocket.Server({ port: 8080 })
const questions = [
  {
    question: `What is Mr. Cook's first name?`,
    choices: [
      'Quentin', 'Darrin', 'Cameron', 'Travis Scott'
    ],
    answer: 0,
    duration: 10000
  },
  {
    question: "What org did Kampy play for?",
    choices: [
      'FaZe', 'Optic', 'BLMS', 'Liquid'
    ],
    answer: 0,
    duration: 10000
  }
]
const game = new Game(questions)

wss.on('connection', socket => {
  socket.on('message', message => {
    console.log(`Message from a client: ${message}`)
    const data = JSON.parse(message)
    switch (data.eventName) {
      case 'user-join':
        const id = uuid()
        game.addPlayer(new Player(socket, data.username, id))
        send(socket, 'uuid-res', { id: id })
        break
      case 'lobby-req':
        const li = Array.from(game.players, ([key, value]) => value.username)
        send(socket, 'lobby-res', { users: li })
        break
      case 'game-start-req':
        game.start()
        game.startRound()
        break
      case 'round-res':
        game.handleAnswerRes(data.user.id, data.idx)
        break
      default:
        console.log(`Bad eventName: ${data.eventName}`)
    }
  })
})

function tick() {
  if (game.isFinished()) {
    clearInterval(intervalId)
    return
  }

  if (game.state === GameState.BATTLE) {
    if (game.roundShouldEnd()) {
      game.advanceRound()
      if (game.isFinished()) {
        clearInterval(intervalId)
        game.end()
      } else {
        game.startRound()
      }
    } else {
      game.tick()
    }
  }
}

const ticksPerSec = 2
const intervalId = setInterval(tick, 1000 / ticksPerSec)