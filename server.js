const WebSocket = require('ws')
const express = require('express')

const uuid = require('uuid/v1')

const GameState = {
  LOBBY: 1,
  BATTLE: 2
}

function send(socket, eventName, payload) {
  const merged = { eventName: eventName, ...payload}
  socket.send(JSON.stringify(merged))
}

function shuffle(array) {
  let counter = array.length;

  while (counter > 0) {
      let index = Math.floor(Math.random() * counter);

      counter--;

      let temp = array[counter];
      array[counter] = array[index];
      array[index] = temp;
  }

  return array;
}

class Game {
  constructor(questions) {
    this.players = new Map()
    this.state = GameState.LOBBY
    this.roundNumber = 0
    this.roundStart = 0
    this.questions = questions
    this.answers = null
    this.matches = null
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
    const p = this.players.get(id)
    if (p === null) return
    const m = p.match
    if (idx !== m.q.answer) {
      send(p.socket, 'elim', { reason: 'Wrong answer!' })
      this.players.delete(id)
    } else if (!m.solo) {
      const other = (id === m.p1.id) ? m.p2 : m.p1
      const msg = { reason: 'Too slow! You were eliminated by: ' + p.username }
      send(other.socket, 'elim', msg)
      this.players.delete(other.id)
      send(p.socket, 'round-end', {})
    }
  }

  startRound() {
    this.answers = new Map()
    for (const k of this.players.keys()) {
      this.answers.set(k, -1)
    }

    this.matches = []
    const players = Array.from(this.players, ([k, v]) => v)
    shuffle(players)
    for (let i = 0; i < players.length; i += 2) {
      const arr = players.slice(i, i + 2)
      this.matches.push(new Match(this.currentQ, arr[0], (arr.length > 1) ? arr[1] : null))
    }

    for (const m of this.matches) {
      m.startRound(this)
    }

    this.state = GameState.BATTLE
    this.roundStart = Date.now()
  }

  roundShouldEnd() {
    return Date.now() - this.roundStart > this.currentQ.duration
  }

  advanceRound() {
    for (const p of this.players.values()) {
      const ans = this.answers.get(p.id)
      const correct = (ans === this.currentQ.answer)
      if (correct) {
        send(p.socket, 'round-end', {})
      } else {
        send(p.socket, 'elim', { reason: 'You ran out of time!' })
        this.players.delete(p.id)
      }
    }

    if (this.players.size === 1 || this.players.size === 0) {
      this.roundNumber = this.questions.length
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
    this.broadcast('game-winner', {})
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

class Match {
  constructor(q, p1, p2) {
    this.q = q
    this.p1 = p1
    this.p2 = p2
    this.solo = (p2 === null)

    this.p1.match = this
    if (!this.solo) this.p2.match = this
  }

  startRound(game) {
    if (this.solo) {
      send(this.p1.socket, 'round-start', {
        q: {
          question: this.q.question,
          choices: this.q.choices
        },
        opponent: 'answer this correctly or else (you are alone)'
      })
    } else {
      send(this.p1.socket, 'round-start', {
        q: {
          question: this.q.question,
          choices: this.q.choices
        },
        opponent: this.p2.username
      })
      send(this.p2.socket, 'round-start', {
        q: {
          question: this.q.question,
          choices: this.q.choices
        },
        opponent: this.p1.username
      })
    }
  }
}

class Player {
  constructor(socket, username, id) {
    this.socket = socket
    this.username = username
    this.id = id
    this.match = null
    this.lives = 3
  }

  toString() {
    return `username: ${this.username}`
  }
}

const app = express()
app.use(express.static('../cairo'))
const wss = new WebSocket.Server({ server: app.listen(8080) })
const questions = [
  {
    question: `What is Mr. Cook's first name?`,
    choices: [
      'Quentin', 'Darrin', 'Cameron', 'Travis Scott'
    ],
    answer: 1,
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