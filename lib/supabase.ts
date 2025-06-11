import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Enhanced cleanup function with better error handling
export const cleanupOldData = async () => {
  try {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Delete finished games older than 1 day
    const { error: finishedError } = await supabase
      .from("game_rooms")
      .delete()
      .eq("status", "finished")
      .lt("created_at", oneDayAgo.toISOString())

    if (finishedError) {
      console.warn("Error cleaning finished games:", finishedError)
    }

    // Delete abandoned waiting rooms older than 1 hour
    const { error: waitingError } = await supabase
      .from("game_rooms")
      .delete()
      .eq("status", "waiting")
      .lt("created_at", oneHourAgo.toISOString())

    if (waitingError) {
      console.warn("Error cleaning waiting rooms:", waitingError)
    }

    // Delete old game states (older than 1 day)
    const { error: statesError } = await supabase.from("game_states").delete().lt("updated_at", oneDayAgo.toISOString())

    if (statesError) {
      console.warn("Error cleaning game states:", statesError)
    }

    console.log("Cleanup completed successfully at", now.toISOString())
  } catch (error) {
    console.error("Error during cleanup:", error)
  }
}

// Call the SQL cleanup function
export const callServerCleanup = async () => {
  try {
    const { error } = await supabase.rpc("cleanup_old_games")
    if (error) {
      console.warn("Server cleanup error:", error)
      // Fallback to client-side cleanup
      await cleanupOldData()
    } else {
      console.log("Server cleanup completed successfully")
    }
  } catch (error) {
    console.warn("Server cleanup failed, using client-side cleanup:", error)
    await cleanupOldData()
  }
}

export type Database = {
  public: {
    Tables: {
      game_rooms: {
        Row: {
          id: string
          created_at: string
          player1_id: string | null
          player2_id: string | null
          status: "waiting" | "playing" | "finished"
          winner_id: string | null
          player1_score: number
          player2_score: number
        }
        Insert: {
          id?: string
          created_at?: string
          player1_id?: string | null
          player2_id?: string | null
          status?: "waiting" | "playing" | "finished"
          winner_id?: string | null
          player1_score?: number
          player2_score?: number
        }
        Update: {
          id?: string
          created_at?: string
          player1_id?: string | null
          player2_id?: string | null
          status?: "waiting" | "playing" | "finished"
          winner_id?: string | null
          player1_score?: number
          player2_score?: number
        }
      }
      game_states: {
        Row: {
          id: string
          room_id: string
          player_id: string
          board_state: number[][]
          current_piece: any
          score: number
          level: number
          lines_cleared: number
          updated_at: string
          attackSent?: number
          gameOver?: boolean
        }
        Insert: {
          id?: string
          room_id: string
          player_id: string
          board_state: number[][]
          current_piece?: any
          score?: number
          level?: number
          lines_cleared?: number
          updated_at?: string
          attackSent?: number
          gameOver?: boolean
        }
        Update: {
          id?: string
          room_id?: string
          player_id?: string
          board_state?: number[][]
          current_piece?: any
          score?: number
          level?: number
          lines_cleared?: number
          updated_at?: string
          attackSent?: number
          gameOver?: boolean
        }
      }
    }
    Functions: {
      cleanup_old_games: {
        Args: {}
        Returns: void
      }
    }
  }
}
