"use client"

import { useState, useEffect, useRef } from "react"
import { supabase, callServerCleanup } from "@/lib/supabase"
import type { Database } from "@/lib/supabase"

type GameRoom = Database["public"]["Tables"]["game_rooms"]["Row"]
type GameState = Database["public"]["Tables"]["game_states"]["Row"] & {
  attackSent?: number
  gameOver?: boolean
}

export function useGameRoom() {
  const [rooms, setRooms] = useState<GameRoom[]>([])
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const roomsSubscription = useRef(null)

  const fetchRooms = async () => {
    try {
      // Perform cleanup before fetching rooms
      await callServerCleanup()

      const { data, error } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("status", "waiting")
        .order("created_at", { ascending: false })
        .limit(10) // Limit to 10 most recent rooms

      if (error) throw error
      setRooms(data || [])
    } catch (err) {
      console.error("Error fetching rooms:", err)
      setError("ルームの取得に失敗しました")
    }
  }

  const subscribeToRoomsList = () => {
    // Clean up existing subscription
    if (roomsSubscription.current) {
      roomsSubscription.current.unsubscribe()
    }

    roomsSubscription.current = supabase
      .channel("waiting-rooms")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rooms",
        },
        async (payload) => {
          console.log("Room change detected:", payload)

          if (payload.eventType === "INSERT") {
            const newRoom = payload.new as GameRoom
            if (newRoom.status === "waiting") {
              setRooms((prev) => {
                // Check if room already exists to avoid duplicates
                const exists = prev.some((room) => room.id === newRoom.id)
                if (!exists) {
                  return [newRoom, ...prev].slice(0, 10) // Keep only 10 most recent
                }
                return prev
              })
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedRoom = payload.new as GameRoom
            setRooms((prev) => {
              if (updatedRoom.status === "waiting") {
                // Update existing room or add if it's now waiting
                const existingIndex = prev.findIndex((room) => room.id === updatedRoom.id)
                if (existingIndex >= 0) {
                  const newRooms = [...prev]
                  newRooms[existingIndex] = updatedRoom
                  return newRooms
                } else {
                  return [updatedRoom, ...prev].slice(0, 10)
                }
              } else {
                // Remove room if it's no longer waiting
                return prev.filter((room) => room.id !== updatedRoom.id)
              }
            })
          } else if (payload.eventType === "DELETE") {
            const deletedRoom = payload.old as GameRoom
            setRooms((prev) => prev.filter((room) => room.id !== deletedRoom.id))
          }
        },
      )
      .subscribe((status) => {
        console.log("Rooms subscription status:", status)
      })
  }

  const createRoom = async (playerId: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from("game_rooms")
        .insert({
          player1_id: playerId,
          status: "waiting",
        })
        .select()
        .single()

      if (error) throw error
      setCurrentRoom(data)
      return data
    } catch (err) {
      console.error("Error creating room:", err)
      setError("ルームの作成に失敗しました")
      return null
    } finally {
      setLoading(false)
    }
  }

  const joinRoom = async (roomId: string, playerId: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from("game_rooms")
        .update({
          player2_id: playerId,
          status: "playing",
        })
        .eq("id", roomId)
        .eq("status", "waiting")
        .select()
        .single()

      if (error) throw error
      if (!data) {
        throw new Error("ルームが見つからないか、既に開始されています")
      }

      setCurrentRoom(data)
      return data
    } catch (err) {
      console.error("Error joining room:", err)
      setError("ルームへの参加に失敗しました")
      return null
    } finally {
      setLoading(false)
    }
  }

  const updateGameState = async (roomId: string, playerId: string, gameState: any) => {
    try {
      const { data: existingData, error: selectError } = await supabase
        .from("game_states")
        .select("id")
        .eq("room_id", roomId)
        .eq("player_id", playerId)
        .single()

      const updateData = {
        board_state: gameState.board,
        current_piece: gameState.currentPiece,
        score: gameState.score,
        level: gameState.level,
        lines_cleared: gameState.linesCleared,
        updated_at: new Date().toISOString(),
      }

      // Add optional fields if they exist
      if (gameState.attackSent !== undefined) {
        updateData["attackSent"] = gameState.attackSent
      }

      if (gameState.gameOver !== undefined) {
        updateData["gameOver"] = gameState.gameOver
      }

      if (existingData) {
        const { error: updateError } = await supabase.from("game_states").update(updateData).eq("id", existingData.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from("game_states").insert({
          room_id: roomId,
          player_id: playerId,
          ...updateData,
        })

        if (insertError) throw insertError
      }
    } catch (err) {
      console.error("Error updating game state:", err)
    }
  }

  const endGame = async (
    roomId: string,
    winnerId: string | null,
    finalScores?: { player1: number; player2: number },
  ) => {
    try {
      const updateData: any = {
        status: "finished",
        winner_id: winnerId,
      }

      if (finalScores) {
        updateData.player1_score = finalScores.player1
        updateData.player2_score = finalScores.player2
      }

      const { error } = await supabase.from("game_rooms").update(updateData).eq("id", roomId)

      if (error) throw error

      // Clean up game states for this room after a delay
      setTimeout(async () => {
        await supabase.from("game_states").delete().eq("room_id", roomId)
      }, 5000) // Clean up after 5 seconds
    } catch (err) {
      console.error("Error ending game:", err)
    }
  }

  const subscribeToRoom = (roomId: string, callback: (room: GameRoom) => void) => {
    const subscription = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as GameRoom)
          }
        },
      )
      .subscribe()

    return subscription
  }

  const subscribeToGameStates = (roomId: string, callback: (gameState: GameState) => void) => {
    const subscription = supabase
      .channel(`game-states-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_states",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            callback(payload.new as GameState)
          }
        },
      )
      .subscribe()

    return subscription
  }

  useEffect(() => {
    // Initial fetch
    fetchRooms()

    // Set up real-time subscription for rooms list
    subscribeToRoomsList()

    // Set up periodic cleanup every 10 minutes
    const cleanupInterval = setInterval(
      async () => {
        await callServerCleanup()
      },
      10 * 60 * 1000,
    )

    return () => {
      clearInterval(cleanupInterval)
      if (roomsSubscription.current) {
        roomsSubscription.current.unsubscribe()
      }
    }
  }, [])

  return {
    rooms,
    currentRoom,
    loading,
    error,
    createRoom,
    joinRoom,
    updateGameState,
    endGame,
    subscribeToRoom,
    subscribeToGameStates,
    fetchRooms,
  }
}
