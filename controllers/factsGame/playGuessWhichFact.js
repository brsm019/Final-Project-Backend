// @ts-check
'use strict'

const actions = require('../../constants/actions')
const { secondsToWait } = require('../../constants/game')
const {
    incrementPlayersScores,
} = require('../../models/factsGame/incrementPlayersScores')
// const { initialiseTurn } = require('../models/factsGame/initialiseTurn')
// const { lockAnswers } = require('../models/factsGame/lockAnswers')
// const { unlockAnswers } = require('../models/factsGame/unlockAnswers')
const { getGame } = require('../../models/factsGame/getGame')

const { broadcastForNSeconds } = require('./broadcastForNSeconds')
const { delay } = require('./delay')

/**
 * Handles second question: "guess which fact is fake"
 */
module.exports.playGuessWhichFact = async ({
    gameId,
    roundNumber,
    broadcastToGame,
}) => {
    {
        const game = await getGame({ gameId })
        // const game = await initialiseTurn({ gameId })
        const [question] = game.rounds[roundNumber - 1].slice(1)

        await broadcastForNSeconds({
            totalSeconds: secondsToWait.forAnswer,
            broadcastFunc(secondsLeft) {
                broadcastToGame({
                    gameId,
                    roundNumber,
                    action: actions.GUESS_FAKE_FACT_TIMER,
                    facts: question.statements,
                    secondsLeft,
                    turnId: game.currentTurnId,
                })
            },
        })
    }

    {
        // Give it a second in case of network congestion.
        await delay(secondsToWait.forAnswerBuffer)
    }

    // Players' current answers have been updated
    // (asynchronously in the background).

    {
        // Check + award players point where appropriate
        const game = await getGame({ gameId })

        const [question] = game.rounds[roundNumber - 1].slice(1)

        // Increment players' scores if they got the answer right.
        console.log("About to increment players' scores")
        const playerIdsWhoAnsweredCorrectly = Object.values(game.players)
            .filter(
                ({ currentAnswer }) =>
                    currentAnswer === question.correctAnswer.choiceId
            )
            .map(({ playerId }) => playerId)

        await incrementPlayersScores({
            gameId,
            playerIds: playerIdsWhoAnsweredCorrectly,
        })
        console.log("Incremented players' scores")

        await broadcastForNSeconds({
            totalSeconds: secondsToWait.beforeReveal,
            broadcastFunc(secondsLeft) {
                broadcastToGame({
                    gameId,
                    roundNumber,
                    action: actions.REVEAL_FAKE_FACT_TIMER,
                    secondsLeft,
                })
            },
        })

        await broadcastToGame({
            gameId,
            action: actions.REVEAL_FAKE_FACT,
            roundNumber,
            lie: question.correctAnswer.text,
            displayName: question.correctAnswer.displayName,
        })

        await delay(secondsToWait.afterReveal)
    }
}