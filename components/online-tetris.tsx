"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useGameRoom } from "@/hooks/useGameRoom"
import { Users, Trophy, Zap, Target, Crown, Gamepad2, RefreshCw, Star, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase"

// Add this function after the imports and before the component
const formatTimeAgo = (dateString: string) => {
  const now = new Date()
  const created = new Date(dateString)
  const diffInSeconds = Math.floor((now.getTime() - created.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return "たった今"
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes}分前`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours}時間前`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days}日前`
  }
}

const TETROMINOS = {
  I: { shape: [[1, 1, 1, 1]], color: "bg-cyan-500", name: "I-Block" },
  J: {
    shape: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: "bg-blue-500",
    name: "J-Block",
  },
  L: {
    shape: [
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: "bg-orange-500",
    name: "L-Block",
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "bg-yellow-500",
    name: "O-Block",
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: "bg-green-500",
    name: "S-Block",
  },
  T: {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    color: "bg-purple-500",
    name: "T-Block",
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: "bg-red-500",
    name: "Z-Block",
  },
}

const BOARD_WIDTH = 10
const BOARD_HEIGHT = 20
const INITIAL_DROP_TIME = 600 // Changed from 800 to 600 for faster initial speed
const UPDATE_THROTTLE_MS = 100
const SPEED_INCREASE_FACTOR = 0.9
const ATTACK_FLASH_DURATION = 1000 // ms
const TIME_SPEED_INCREASE_INTERVAL = 30000 // 30 seconds
const TIME_SPEED_INCREASE_FACTOR = 0.95 // 5% faster every interval

const createEmptyBoard = () => Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0))

const randomTetromino = () => {
  const keys = Object.keys(TETROMINOS)
  const randKey = keys[Math.floor(Math.random() * keys.length)]
  return { ...TETROMINOS[randKey], type: randKey }
}

// Particle component for effects
const Particle = ({ x, y, color, delay = 0 }) => (
  <motion.div
    initial={{
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      rotate: 0,
    }}
    animate={{
      opacity: 0,
      scale: 0.2,
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 100,
      rotate: Math.random() * 360,
    }}
    exit={{ opacity: 0 }}
    transition={{
      duration: 1.5,
      delay,
      ease: "easeOut",
    }}
    className={`absolute w-2 h-2 ${color} rounded-full pointer-events-none z-50`}
    style={{
      left: x * 24 + 12,
      top: y * 24 + 12,
      transform: "translate(-50%, -50%)",
    }}
  />
)

export default function OnlineTetris() {
  const [playerId] = useState(() => `player_${Math.random().toString(36).substr(2, 9)}`)
  const [playerName, setPlayerName] = useState("")
  const [gameState, setGameState] = useState("lobby")
  const [board, setBoard] = useState(createEmptyBoard())
  const [currentPiece, setCurrentPiece] = useState(null)
  const [nextPiece, setNextPiece] = useState(null)
  const [score, setScore] = useState(0)
  const [level, setLevel] = useState(1)
  const [linesCleared, setLinesCleared] = useState(0)
  const [opponentBoard, setOpponentBoard] = useState(createEmptyBoard())
  const [opponentScore, setOpponentScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [winner, setWinner] = useState(null)
  const [combo, setCombo] = useState(0)
  const [lastClearTime, setLastClearTime] = useState(0)
  const [showCombo, setShowCombo] = useState(false)
  const [dropTime, setDropTime] = useState(INITIAL_DROP_TIME)
  const [error, setError] = useState(null) // Declare setError variable
  const [pendingGarbage, setPendingGarbage] = useState(0)
  const [showAttack, setShowAttack] = useState(false)
  const [gameStartTime, setGameStartTime] = useState(null)
  const [isGameInitialized, setIsGameInitialized] = useState(false)

  // Animation states
  const [clearingRows, setClearingRows] = useState([])
  const [particles, setParticles] = useState([])
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [showScorePopup, setShowScorePopup] = useState(null)
  const [piecePlacementEffect, setPiecePlacementEffect] = useState(null)
  const [rotationEffect, setRotationEffect] = useState(false)
  const [backgroundParticles, setBackgroundParticles] = useState([])

  const {
    rooms,
    currentRoom,
    loading,
    createRoom,
    joinRoom,
    updateGameState,
    endGame,
    subscribeToRoom,
    subscribeToGameStates,
    fetchRooms,
  } = useGameRoom()

  const dropInterval = useRef(null)
  const roomSubscription = useRef(null)
  const gameStateSubscription = useRef(null)
  const lastUpdateTime = useRef(0)
  const gameContainerRef = useRef(null)
  const particleIdCounter = useRef(0)

  // Generate background particles
  useEffect(() => {
    if (gameState === "playing") {
      const generateBackgroundParticles = () => {
        const newParticles = Array.from({ length: 20 }, (_, i) => ({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 3 + 1,
          speed: Math.random() * 2 + 1,
          opacity: Math.random() * 0.3 + 0.1,
        }))
        setBackgroundParticles(newParticles)
      }

      generateBackgroundParticles()
      const interval = setInterval(generateBackgroundParticles, 10000)
      return () => clearInterval(interval)
    }
  }, [gameState])

  const checkCollision = (x, y, shape, boardToCheck = board) => {
    for (let row = 0; row < shape.length; row++) {
      for (let col = 0; col < shape[row].length; col++) {
        if (shape[row][col] !== 0) {
          const newX = x + col
          const newY = y + row
          if (
            newX < 0 ||
            newX >= BOARD_WIDTH ||
            newY >= BOARD_HEIGHT ||
            (newY >= 0 && boardToCheck[newY][newX] !== 0)
          ) {
            return true
          }
        }
      }
    }
    return false
  }

  const isValidMove = (x, y, shape, boardToCheck = board) => !checkCollision(x, y, shape, boardToCheck)

  const calculateGhostPosition = useCallback(() => {
    if (!currentPiece) return null

    let ghostY = currentPiece.y
    while (isValidMove(currentPiece.x, ghostY + 1, currentPiece.tetromino.shape, board)) {
      ghostY++
    }

    return {
      x: currentPiece.x,
      y: ghostY,
      tetromino: currentPiece.tetromino,
    }
  }, [currentPiece, board])

  const createParticleEffect = (x, y, color, count = 8) => {
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: particleIdCounter.current++,
      x,
      y,
      color,
      delay: i * 0.1,
    }))
    setParticles((prev) => [...prev, ...newParticles])

    // Clean up particles after animation
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.some((np) => np.id === p.id)))
    }, 2000)
  }

  const initializeGame = useCallback(() => {
    console.log("Initializing game...")
    setBoard(createEmptyBoard())
    setCurrentPiece(null)
    setScore(0)
    setLevel(1)
    setLinesCleared(0)
    setGameOver(false)
    setCombo(0)
    setDropTime(INITIAL_DROP_TIME)
    setPendingGarbage(0)
    setShowAttack(false)
    setNextPiece(randomTetromino())
    setIsGameInitialized(true)
    setClearingRows([])
    setParticles([])
    setShowLevelUp(false)
    setShowScorePopup(null)
    setPiecePlacementEffect(null)

    // Clear any existing intervals
    if (dropInterval.current) {
      clearInterval(dropInterval.current)
    }
  }, [])

  const moveDown = useCallback(() => {
    if (!currentPiece || gameOver) return
    if (isValidMove(currentPiece.x, currentPiece.y + 1, currentPiece.tetromino.shape, board)) {
      setCurrentPiece((prev) => ({ ...prev, y: prev.y + 1 }))
    } else {
      placePiece()
    }
  }, [currentPiece, board, gameOver])

  const hardDrop = useCallback(() => {
    if (!currentPiece || gameOver) return

    let dropY = currentPiece.y
    while (isValidMove(currentPiece.x, dropY + 1, currentPiece.tetromino.shape, board)) {
      dropY++
    }

    // Create a new piece object with the final drop position
    const droppedPiece = {
      ...currentPiece,
      y: dropY,
    }

    // Create impact effect
    setPiecePlacementEffect({
      x: droppedPiece.x,
      y: droppedPiece.y,
      color: droppedPiece.tetromino.color,
    })
    setTimeout(() => setPiecePlacementEffect(null), 500)

    // Directly place the piece at the calculated position
    const newBoard = board.map((row) => [...row])
    let placementSuccessful = false

    droppedPiece.tetromino.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          const boardY = y + droppedPiece.y
          const boardX = x + droppedPiece.x
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            newBoard[boardY][boardX] = droppedPiece.tetromino.color
            placementSuccessful = true
            // Create particle effect for each placed block
            createParticleEffect(boardX, boardY, droppedPiece.tetromino.color, 4)
          }
        }
      })
    })

    if (placementSuccessful) {
      setBoard(newBoard)
      setCurrentPiece(null) // Clear current piece immediately
      clearLines(newBoard)
      spawnNewPiece()
    }
  }, [currentPiece, board, gameOver])

  const placePiece = useCallback(() => {
    if (!currentPiece) return

    const newBoard = board.map((row) => [...row])
    let placementSuccessful = false

    // Create placement effect
    setPiecePlacementEffect({
      x: currentPiece.x,
      y: currentPiece.y,
      color: currentPiece.tetromino.color,
    })
    setTimeout(() => setPiecePlacementEffect(null), 300)

    currentPiece.tetromino.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          const boardY = y + currentPiece.y
          const boardX = x + currentPiece.x
          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            newBoard[boardY][boardX] = currentPiece.tetromino.color
            placementSuccessful = true
            // Create subtle particle effect
            createParticleEffect(boardX, boardY, currentPiece.tetromino.color, 2)
          }
        }
      })
    })

    if (placementSuccessful) {
      setBoard(newBoard)
      setCurrentPiece(null) // Clear current piece immediately
      clearLines(newBoard)
      spawnNewPiece()
    }
  }, [currentPiece, board])

  const clearLines = useCallback(
    (newBoard) => {
      const fullRows = []
      newBoard.forEach((row, index) => {
        if (row.every((cell) => cell !== 0)) {
          fullRows.push(index)
        }
      })

      if (fullRows.length > 0) {
        // Set clearing animation
        setClearingRows(fullRows)

        // Create explosion particles for cleared lines
        fullRows.forEach((rowIndex) => {
          for (let col = 0; col < BOARD_WIDTH; col++) {
            createParticleEffect(col, rowIndex, newBoard[rowIndex][col], 6)
          }
        })

        // Wait for animation before actually clearing
        setTimeout(() => {
          const updatedBoard = newBoard.filter((_, index) => !fullRows.includes(index))

          while (updatedBoard.length < BOARD_HEIGHT) {
            updatedBoard.unshift(Array(BOARD_WIDTH).fill(0))
          }

          setBoard(updatedBoard)
          setClearingRows([])

          const now = Date.now()
          const timeSinceLastClear = now - lastClearTime

          // Combo system
          let newCombo = 1
          if (timeSinceLastClear < 3000) {
            newCombo = combo + 1
            setCombo(newCombo)
          } else {
            setCombo(1)
          }

          setLastClearTime(now)
          setShowCombo(true)
          setTimeout(() => setShowCombo(false), 1500)

          const basePoints = fullRows.length * 100
          const comboBonus = newCombo * 50
          const levelBonus = level * 10
          const totalPoints = basePoints + comboBonus + levelBonus

          // Show score popup
          setShowScorePopup({
            points: totalPoints,
            lines: fullRows.length,
            combo: newCombo,
          })
          setTimeout(() => setShowScorePopup(null), 2000)

          setScore((prev) => prev + totalPoints)
          setLinesCleared((prev) => prev + fullRows.length)

          // Check for level up
          const newLevel = Math.floor((linesCleared + fullRows.length) / 10) + 1
          if (newLevel > level) {
            setLevel(newLevel)
            setDropTime((prev) => Math.max(100, prev * SPEED_INCREASE_FACTOR))
            setShowLevelUp(true)
            setTimeout(() => setShowLevelUp(false), 2000)
          }

          // Calculate garbage to send based on lines cleared
          let garbageToSend = 0
          if (fullRows.length === 2) garbageToSend = 1
          else if (fullRows.length === 3) garbageToSend = 2
          else if (fullRows.length >= 4) garbageToSend = 4

          // Add combo bonus to garbage
          if (newCombo > 1) {
            garbageToSend += Math.min(newCombo - 1, 3) // Max +3 from combo
          }

          // Send garbage to opponent if applicable
          if (garbageToSend > 0 && currentRoom) {
            updateGameState(currentRoom.id, playerId, {
              board: updatedBoard,
              currentPiece,
              score: score + totalPoints,
              level: newLevel,
              linesCleared: linesCleared + fullRows.length,
              attackSent: garbageToSend,
            })

            // Show attack animation
            setShowAttack(true)
            setTimeout(() => setShowAttack(false), ATTACK_FLASH_DURATION)
          }
        }, 800) // Wait for line clearing animation
      } else {
        setCombo(0)
      }
    },
    [linesCleared, level, combo, lastClearTime, currentRoom, playerId, score],
  )

  const addGarbageLines = useCallback(
    (amount) => {
      if (amount <= 0) return

      setBoard((prevBoard) => {
        const newBoard = prevBoard.map((row) => [...row])

        // Remove rows from the top
        for (let i = 0; i < amount; i++) {
          newBoard.shift()
        }

        // Add garbage rows at the bottom
        for (let i = 0; i < amount; i++) {
          const garbageRow = Array(BOARD_WIDTH).fill("bg-gray-500")
          // Add one random hole in each garbage row
          const holePosition = Math.floor(Math.random() * BOARD_WIDTH)
          garbageRow[holePosition] = 0
          newBoard.push(garbageRow)
        }

        // Check if the current piece would collide with the new garbage
        if (currentPiece && checkCollision(currentPiece.x, currentPiece.y, currentPiece.tetromino.shape, newBoard)) {
          // Try to move the piece up to avoid collision
          const newY = currentPiece.y - amount
          if (!checkCollision(currentPiece.x, newY, currentPiece.tetromino.shape, newBoard)) {
            setCurrentPiece((prev) => ({ ...prev, y: newY }))
          } else {
            // If we can't avoid collision, game over
            handleGameOver()
          }
        }

        return newBoard
      })
    },
    [currentPiece],
  )

  const handleGameOver = useCallback(async () => {
    if (gameOver) return

    setGameOver(true)

    if (currentRoom) {
      // Send final score to determine winner
      await updateGameState(currentRoom.id, playerId, {
        board,
        currentPiece: null,
        score,
        level,
        linesCleared,
        gameOver: true,
      })

      // Wait a moment to ensure both players have reported their final state
      setTimeout(async () => {
        try {
          const { data } = await supabase.from("game_states").select("player_id, score").eq("room_id", currentRoom.id)

          if (data && data.length > 1) {
            const playerState = data.find((state) => state.player_id === playerId)
            const opponentState = data.find((state) => state.player_id !== playerId)

            const playerWins = playerState && opponentState && playerState.score > opponentState.score

            await endGame(currentRoom.id, playerWins ? playerId : opponentState.player_id, {
              player1: currentRoom.player1_id === playerId ? score : opponentScore,
              player2: currentRoom.player2_id === playerId ? score : opponentScore,
            })
          } else {
            // If we can't determine a winner, just end the game
            await endGame(currentRoom.id, null, {
              player1: currentRoom.player1_id === playerId ? score : opponentScore,
              player2: currentRoom.player2_id === playerId ? score : opponentScore,
            })
          }
        } catch (error) {
          console.error("Error handling game over:", error)
        }
      }, 1000)
    }
  }, [gameOver, currentRoom, playerId, board, score, level, linesCleared, opponentScore, updateGameState, endGame])

  const spawnNewPiece = useCallback(() => {
    if (gameOver) return

    const piece = nextPiece || randomTetromino()
    setNextPiece(randomTetromino())

    const newPiece = {
      x: Math.floor(BOARD_WIDTH / 2) - 1,
      y: 0,
      tetromino: piece,
    }

    if (checkCollision(newPiece.x, newPiece.y, newPiece.tetromino.shape, board)) {
      handleGameOver()
    } else {
      setCurrentPiece(newPiece)
    }
  }, [board, nextPiece, gameOver, handleGameOver])

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError("プレイヤー名を入力してください")
      return
    }
    const room = await createRoom(`${playerName}:${playerId}`)
    if (room) {
      setGameState("waiting")
    }
  }

  const handleJoinRoom = async (roomId: string) => {
    if (!playerName.trim()) {
      setError("プレイヤー名を入力してください")
      return
    }
    const room = await joinRoom(roomId, `${playerName}:${playerId}`)
    if (room) {
      console.log("Successfully joined room, initializing game...")
      setGameState("playing")
      initializeGame()
    }
  }

  const handleBackToLobby = async () => {
    // Clean up current room if it's in waiting state
    if (currentRoom && currentRoom.status === "waiting") {
      try {
        await supabase
          .from("game_rooms")
          .delete()
          .eq("id", currentRoom.id)
          .eq("player1_id", `${playerName}:${playerId}`)
      } catch (error) {
        console.warn("Error cleaning up room:", error)
      }
    }

    setGameState("lobby")
    setIsGameInitialized(false)
    initializeGame()
    setError(null)

    if (roomSubscription.current) {
      roomSubscription.current.unsubscribe()
    }
    if (gameStateSubscription.current) {
      gameStateSubscription.current.unsubscribe()
    }

    fetchRooms()
  }

  // Game loop
  useEffect(() => {
    if (gameState === "playing" && !gameOver && isGameInitialized) {
      if (dropInterval.current) {
        clearInterval(dropInterval.current)
      }
      dropInterval.current = setInterval(moveDown, dropTime)
    }
    return () => {
      if (dropInterval.current) {
        clearInterval(dropInterval.current)
      }
    }
  }, [moveDown, gameState, gameOver, dropTime, isGameInitialized])

  // Spawn initial piece
  useEffect(() => {
    if (!currentPiece && gameState === "playing" && !gameOver && isGameInitialized) {
      console.log("Spawning initial piece...")
      spawnNewPiece()
    }
  }, [currentPiece, gameState, gameOver, spawnNewPiece, isGameInitialized])

  // Throttled update game state to Supabase
  useEffect(() => {
    if (currentRoom && gameState === "playing" && isGameInitialized) {
      const now = Date.now()
      if (now - lastUpdateTime.current > UPDATE_THROTTLE_MS) {
        lastUpdateTime.current = now
        updateGameState(currentRoom.id, playerId, {
          board,
          currentPiece,
          score,
          level,
          linesCleared,
        })
      }
    }
  }, [board, currentPiece, score, level, linesCleared, currentRoom, playerId, gameState, isGameInitialized])

  // Subscribe to room changes
  useEffect(() => {
    if (currentRoom) {
      roomSubscription.current = subscribeToRoom(currentRoom.id, (room) => {
        console.log("Room status changed:", room.status)
        if (room.status === "playing" && gameState === "waiting") {
          console.log("Room status changed to playing, starting game...")
          setGameState("playing")
          initializeGame()
        }
        if (room.status === "finished") {
          setGameState("finished")
          setWinner(room.winner_id)
        }
      })

      gameStateSubscription.current = subscribeToGameStates(currentRoom.id, (gameStateData) => {
        if (gameStateData.player_id !== playerId) {
          setOpponentBoard(gameStateData.board_state || createEmptyBoard())
          setOpponentScore(gameStateData.score || 0)

          // Handle incoming attacks
          if (gameStateData.attackSent && gameStateData.attackSent > 0) {
            setPendingGarbage((prev) => prev + gameStateData.attackSent)
            setTimeout(() => {
              addGarbageLines(gameStateData.attackSent)
              setPendingGarbage((prev) => Math.max(0, prev - gameStateData.attackSent))
            }, 2000) // Delay before garbage appears
          }
        }
      })
    }

    return () => {
      if (roomSubscription.current) {
        roomSubscription.current.unsubscribe()
      }
      if (gameStateSubscription.current) {
        gameStateSubscription.current.unsubscribe()
      }
    }
  }, [currentRoom, playerId, gameState, addGarbageLines, initializeGame])

  // Enhanced keyboard controls with scroll prevention
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Prevent default behavior for arrow keys to stop page scrolling
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.key)) {
        e.preventDefault()
      }

      if (gameState !== "playing" || gameOver || !isGameInitialized) return

      switch (e.key) {
        case "ArrowLeft":
          if (currentPiece && isValidMove(currentPiece.x - 1, currentPiece.y, currentPiece.tetromino.shape, board)) {
            setCurrentPiece((prev) => ({ ...prev, x: prev.x - 1 }))
          }
          break
        case "ArrowRight":
          if (currentPiece && isValidMove(currentPiece.x + 1, currentPiece.y, currentPiece.tetromino.shape, board)) {
            setCurrentPiece((prev) => ({ ...prev, x: prev.x + 1 }))
          }
          break
        case "ArrowDown":
          moveDown()
          break
        case "ArrowUp":
          // Only up arrow for rotation now
          if (currentPiece) {
            const rotated = currentPiece.tetromino.shape[0].map((_, i) =>
              currentPiece.tetromino.shape.map((row) => row[i]).reverse(),
            )
            if (isValidMove(currentPiece.x, currentPiece.y, rotated, board)) {
              setCurrentPiece((prev) => ({
                ...prev,
                tetromino: { ...prev.tetromino, shape: rotated },
              }))
              // Rotation effect
              setRotationEffect(true)
              setTimeout(() => setRotationEffect(false), 200)
            }
          }
          break
        case " ": // Space bar for hard drop
          hardDrop()
          break
      }
    }

    // Focus the game container to ensure it receives keyboard events
    if (gameContainerRef.current && gameState === "playing") {
      gameContainerRef.current.focus()
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [currentPiece, gameState, gameOver, moveDown, hardDrop, board, isGameInitialized])

  useEffect(() => {
    if (gameState === "playing" && !gameOver && isGameInitialized) {
      setGameStartTime(Date.now())

      // Set up interval for time-based speed increases
      const speedIncreaseInterval = setInterval(() => {
        setDropTime((prev) => Math.max(100, prev * TIME_SPEED_INCREASE_FACTOR))
      }, TIME_SPEED_INCREASE_INTERVAL)

      return () => clearInterval(speedIncreaseInterval)
    }
  }, [gameState, gameOver, isGameInitialized])

  const renderBoard = (boardData, isOpponent = false) => {
    const ghostPiece = !isOpponent ? calculateGhostPosition() : null

    return (
      <div className="relative">
        {/* Background particles */}
        {!isOpponent &&
          backgroundParticles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-1 h-1 bg-white rounded-full pointer-events-none"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                opacity: particle.opacity,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [particle.opacity, particle.opacity * 0.5, particle.opacity],
              }}
              transition={{
                duration: particle.speed,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
          ))}

        <div
          className="grid bg-gray-800 border-2 border-gray-600 relative overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
            width: `${BOARD_WIDTH * 24}px`,
            height: `${BOARD_HEIGHT * 24}px`,
          }}
        >
          {boardData.map((row, y) =>
            row.map((cell, x) => {
              let cellClass = "w-6 h-6 border border-gray-700 transition-all duration-150"
              let isGhostCell = false
              let isCurrentPiece = false
              const isClearingRow = clearingRows.includes(y)

              // Check if this is part of the current piece
              if (
                !isOpponent &&
                currentPiece &&
                currentPiece.tetromino.shape[y - currentPiece.y] &&
                currentPiece.tetromino.shape[y - currentPiece.y][x - currentPiece.x]
              ) {
                cellClass += ` ${currentPiece.tetromino.color} shadow-lg`
                isCurrentPiece = true
              }
              // Check if this is part of the ghost piece
              else if (
                !isOpponent &&
                ghostPiece &&
                ghostPiece.tetromino.shape[y - ghostPiece.y] &&
                ghostPiece.tetromino.shape[y - ghostPiece.y][x - ghostPiece.x] &&
                !isCurrentPiece
              ) {
                cellClass += ` ${ghostPiece.tetromino.color} opacity-30 border-2 border-dashed`
                isGhostCell = true
              }
              // Regular board cell
              else if (cell) {
                cellClass += ` ${cell} shadow-sm`
              } else {
                cellClass += " bg-gray-900"
              }

              return (
                <motion.div
                  key={`${y}-${x}`}
                  className={cellClass}
                  animate={{
                    scale: isClearingRow ? [1, 1.2, 0] : 1,
                    opacity: isClearingRow ? [1, 1, 0] : 1,
                    rotateZ: rotationEffect && isCurrentPiece ? [0, 360] : 0,
                  }}
                  transition={{
                    duration: isClearingRow ? 0.8 : rotationEffect ? 0.2 : 0.15,
                    ease: isClearingRow ? "easeInOut" : "easeOut",
                  }}
                />
              )
            }),
          )}

          {/* Piece placement effect */}
          <AnimatePresence>
            {piecePlacementEffect && (
              <motion.div
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 1.5, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 border-4 border-white rounded-lg pointer-events-none"
                style={{
                  left: piecePlacementEffect.x * 24,
                  top: piecePlacementEffect.y * 24,
                  width: 24,
                  height: 24,
                }}
              />
            )}
          </AnimatePresence>

          {/* Particles */}
          <AnimatePresence>
            {particles.map((particle) => (
              <Particle key={particle.id} x={particle.x} y={particle.y} color={particle.color} delay={particle.delay} />
            ))}
          </AnimatePresence>

          {/* Pending garbage indicator */}
          {pendingGarbage > 0 && (
            <motion.div
              className="absolute bottom-0 left-0 w-full"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
            >
              {Array.from({ length: pendingGarbage }).map((_, i) => (
                <motion.div
                  key={i}
                  className="h-1.5 bg-red-500 w-full"
                  style={{ marginTop: "1px" }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.3, delay: i * 0.1 }}
                />
              ))}
            </motion.div>
          )}

          {/* Attack effect */}
          <AnimatePresence>
            {showAttack && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.5 }}
                className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 bg-opacity-40 flex items-center justify-center z-50"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{ duration: 0.5, repeat: 2 }}
                  className="text-3xl font-bold text-white drop-shadow-lg flex items-center gap-2"
                >
                  <Zap className="w-8 h-8" />
                  攻撃！
                  <Zap className="w-8 h-8" />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  const renderNextPiece = () => {
    if (!nextPiece) return null

    return (
      <motion.div
        className="bg-gray-800 p-4 rounded border-2 border-gray-600"
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <h3 className="text-white text-sm font-bold mb-2 flex items-center gap-2">
          <Star className="w-4 h-4" />
          Next
        </h3>
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(4, 1fr)`,
            width: "80px",
            height: "80px",
          }}
        >
          {Array.from({ length: 16 }, (_, i) => {
            const row = Math.floor(i / 4)
            const col = i % 4
            const isActive = nextPiece.shape[row] && nextPiece.shape[row][col]
            return (
              <motion.div
                key={i}
                className={`w-4 h-4 ${isActive ? nextPiece.color : "bg-gray-900"} border border-gray-700`}
                animate={{
                  scale: isActive ? [1, 1.1, 1] : 1,
                }}
                transition={{
                  duration: 2,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: i * 0.1,
                }}
              />
            )
          })}
        </div>
      </motion.div>
    )
  }

  if (gameState === "lobby") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-20"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.2, 0.5, 0.2],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                repeat: Number.POSITIVE_INFINITY,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <motion.h1
              className="text-5xl font-bold text-white text-center mb-4 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent"
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            >
              🎮 オンライン テトリス バトル
            </motion.h1>
            <motion.p
              className="text-center text-gray-300 mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              リアルタイム対戦で最高のテトリス体験を！
            </motion.p>
          </motion.div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg"
            >
              {error}
            </motion.div>
          )}

          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="backdrop-blur-sm bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Gamepad2 className="w-5 h-5" />
                  プレイヤー名
                </CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  type="text"
                  placeholder="あなたの名前を入力..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/90"
                  maxLength={20}
                />
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
            >
              <Card className="hover:shadow-xl transition-shadow duration-300 backdrop-blur-sm bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Users className="w-5 h-5 text-green-400" />
                    ゲームを作成
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 mb-4">新しいゲームルームを作成して、他のプレイヤーを待ちます。</p>
                  <Button
                    onClick={handleCreateRoom}
                    disabled={loading || !playerName.trim()}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                  >
                    {loading ? "作成中..." : "🚀 ルーム作成"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              whileHover={{ scale: 1.02 }}
            >
              <Card className="hover:shadow-xl transition-shadow duration-300 backdrop-blur-sm bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-white">
                    <span className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                      ゲームに参加
                    </span>
                    <Button variant="ghost" size="sm" onClick={fetchRooms} className="text-gray-300 hover:text-white">
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300 mb-4">待機中のゲームルームに参加します。</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                      {rooms.length === 0 ? (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-gray-400 text-center py-4"
                        >
                          待機中のルームがありません
                        </motion.p>
                      ) : (
                        rooms.map((room) => {
                          const player1Name = room.player1_id?.split(":")[0] || "プレイヤー1"
                          const timeAgo = formatTimeAgo(room.created_at)
                          return (
                            <motion.div
                              key={room.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              transition={{ duration: 0.3 }}
                              whileHover={{ scale: 1.02 }}
                              className="flex items-center justify-between p-3 border rounded-lg bg-white/10 hover:bg-white/20 transition-colors border-white/20"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-500/20 text-green-300 border-green-400"
                                  >
                                    待機中
                                  </Badge>
                                  <span className="text-sm text-gray-300">{player1Name} が待機中</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <span>🕒 {timeAgo}</span>
                                  <span>•</span>
                                  <span>ID: {room.id.slice(0, 8)}...</span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleJoinRoom(room.id)}
                                disabled={loading || !playerName.trim()}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 ml-3"
                              >
                                ⚡ 参加
                              </Button>
                            </motion.div>
                          )
                        })
                      )}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-8 text-center"
          >
            <Card className="backdrop-blur-sm bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">🎮 操作方法</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <motion.div className="flex items-center gap-2 text-gray-300" whileHover={{ scale: 1.05 }}>
                    <kbd className="px-2 py-1 bg-gray-700/50 rounded">←→</kbd>
                    <span>左右移動</span>
                  </motion.div>
                  <motion.div className="flex items-center gap-2 text-gray-300" whileHover={{ scale: 1.05 }}>
                    <kbd className="px-2 py-1 bg-gray-700/50 rounded">↓</kbd>
                    <span>高速落下</span>
                  </motion.div>
                  <motion.div className="flex items-center gap-2 text-gray-300" whileHover={{ scale: 1.05 }}>
                    <kbd className="px-2 py-1 bg-gray-700/50 rounded">↑</kbd>
                    <span>回転</span>
                  </motion.div>
                  <motion.div className="flex items-center gap-2 text-gray-300" whileHover={{ scale: 1.05 }}>
                    <kbd className="px-2 py-1 bg-gray-700/50 rounded">Space</kbd>
                    <span>一気に落下</span>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    )
  }

  if (gameState === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: Math.random() * 2 + 1,
                repeat: Number.POSITIVE_INFINITY,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-96 backdrop-blur-sm bg-white/10 border-white/20">
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2 text-white">
                <Users className="w-5 h-5" />
                プレイヤーを待機中...
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full mx-auto mb-4"
              />
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              >
                <p className="text-gray-300 mb-4">他のプレイヤーがゲームに参加するのを待っています。</p>
                <p className="text-sm text-gray-400 mb-4">ルームID: {currentRoom?.id.slice(0, 8)}...</p>
              </motion.div>
              <Button
                variant="outline"
                onClick={handleBackToLobby}
                className="border-white/30 text-white hover:bg-white/10"
              >
                ロビーに戻る
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div
      ref={gameContainerRef}
      tabIndex={0}
      className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4 focus:outline-none relative overflow-hidden"
    >
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 100 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-10"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -window.innerHeight],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
              delay: Math.random() * 10,
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          className="flex justify-between items-center mb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Crown className="w-8 h-8 text-yellow-400" />
            テトリス バトル
          </h1>
          <Button
            variant="outline"
            onClick={handleBackToLobby}
            className="border-white/30 text-white hover:bg-white/10"
          >
            ロビーに戻る
          </Button>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Your Game */}
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="backdrop-blur-sm bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <span className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-400" />
                    あなた ({playerName})
                  </span>
                  <div className="flex gap-4 text-sm">
                    <motion.span
                      className="flex items-center gap-1"
                      animate={{ scale: showScorePopup ? [1, 1.2, 1] : 1 }}
                    >
                      <Trophy className="w-4 h-4" />
                      {score.toLocaleString()}
                    </motion.span>
                    <motion.span className="flex items-center gap-1" animate={{ scale: showLevelUp ? [1, 1.3, 1] : 1 }}>
                      <Zap className="w-4 h-4" />
                      Lv.{level}
                    </motion.span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div className="relative">
                  {renderBoard(board)}

                  {/* Combo animation */}
                  <AnimatePresence>
                    {showCombo && combo > 1 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: -20 }}
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
                      >
                        <motion.div
                          animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 5, -5, 0],
                          }}
                          transition={{ duration: 0.5, repeat: 2 }}
                          className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-4 py-2 rounded-full font-bold text-lg shadow-lg flex items-center gap-2"
                        >
                          <Sparkles className="w-5 h-5" />
                          {combo}x COMBO!
                          <Sparkles className="w-5 h-5" />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Score popup */}
                  <AnimatePresence>
                    {showScorePopup && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 0 }}
                        animate={{ opacity: 1, scale: 1, y: -50 }}
                        exit={{ opacity: 0, scale: 0.5, y: -100 }}
                        className="absolute top-1/4 left-1/2 transform -translate-x-1/2 z-50"
                      >
                        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-3 py-2 rounded-lg font-bold text-sm shadow-lg">
                          +{showScorePopup.points.toLocaleString()}
                          {showScorePopup.lines > 1 && (
                            <div className="text-xs opacity-90">{showScorePopup.lines} Lines!</div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Level up animation */}
                  <AnimatePresence>
                    {showLevelUp && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.5 }}
                        className="absolute inset-0 flex items-center justify-center z-50"
                      >
                        <motion.div
                          animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 360],
                          }}
                          transition={{ duration: 1 }}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-full font-bold text-xl shadow-lg flex items-center gap-2"
                        >
                          <Star className="w-6 h-6" />
                          LEVEL UP!
                          <Star className="w-6 h-6" />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <motion.div
                  className="flex gap-4 text-sm text-gray-300"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                >
                  <span>ライン: {linesCleared}</span>
                  <span>コンボ: {combo}</span>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Game Info */}
          <motion.div
            className="lg:col-span-1 space-y-4"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            {renderNextPiece()}

            <Card className="backdrop-blur-sm bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-sm text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  統計
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <motion.div className="flex justify-between text-gray-300" whileHover={{ scale: 1.05 }}>
                  <span>スコア:</span>
                  <span className="font-bold text-green-400">{score.toLocaleString()}</span>
                </motion.div>
                <motion.div className="flex justify-between text-gray-300" whileHover={{ scale: 1.05 }}>
                  <span>レベル:</span>
                  <span className="font-bold text-blue-400">{level}</span>
                </motion.div>
                <motion.div className="flex justify-between text-gray-300" whileHover={{ scale: 1.05 }}>
                  <span>ライン:</span>
                  <span className="font-bold text-purple-400">{linesCleared}</span>
                </motion.div>
                <motion.div className="flex justify-between text-gray-300" whileHover={{ scale: 1.05 }}>
                  <span>コンボ:</span>
                  <span className="font-bold text-yellow-400">{combo}</span>
                </motion.div>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-sm bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-sm text-white flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4" />
                  操作ガイド
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 text-gray-300">
                  <motion.div whileHover={{ scale: 1.05 }}>←→: 移動</motion.div>
                  <motion.div whileHover={{ scale: 1.05 }}>↓: 高速落下</motion.div>
                  <motion.div whileHover={{ scale: 1.05 }}>↑: 回転</motion.div>
                  <motion.div whileHover={{ scale: 1.05 }}>Space: 一気に落下</motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Opponent Game */}
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="backdrop-blur-sm bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <span className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-red-400" />
                    相手
                  </span>
                  <div className="flex gap-4 text-sm">
                    <motion.span
                      className="flex items-center gap-1"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                    >
                      <Trophy className="w-4 h-4" />
                      {opponentScore.toLocaleString()}
                    </motion.span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">{renderBoard(opponentBoard, true)}</CardContent>
            </Card>
          </motion.div>
        </div>

        <AnimatePresence>
          {(gameOver || gameState === "finished") && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0, rotateY: 180 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                exit={{ scale: 0.5, opacity: 0, rotateY: -180 }}
                transition={{ type: "spring", damping: 15 }}
              >
                <Card className="w-96 backdrop-blur-sm bg-white/10 border-white/20">
                  <CardHeader>
                    <CardTitle className="text-center text-2xl text-white">
                      {gameState === "finished" ? (
                        currentRoom && currentRoom.winner_id === playerId ? (
                          <motion.span
                            className="text-green-400 flex items-center justify-center gap-2"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 0.5, repeat: 3 }}
                          >
                            🏆 勝利！ <Crown className="w-8 h-8" />
                          </motion.span>
                        ) : (
                          <span className="text-red-400">😢 敗北...</span>
                        )
                      ) : (
                        <span className="text-gray-300">ゲーム終了</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center space-y-4">
                    <motion.div
                      className="space-y-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <p className="text-lg text-gray-300">
                        最終スコア: <span className="font-bold text-blue-400">{score.toLocaleString()}</span>
                      </p>
                      <p className="text-gray-300">
                        レベル: {level} | ライン: {linesCleared}
                      </p>
                      <p className="text-gray-300">最大コンボ: {combo}</p>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={handleBackToLobby}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      >
                        ロビーに戻る
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
