/**
 * FreeKick Earth — API Client
 * Handles all communication with the FastAPI backend.
 */

import axios from 'axios'

// The Vite proxy rewrites /api/* → http://localhost:8000/*
const BASE = '/api'

// --- Types ---

export interface Stadium {
  id: string
  name: string
  city: string
  country: string
  lat: number
  lon: number
  altitude_meters: number
}

export interface StadiumConditions {
  stadium: Stadium
  temperature_celsius: number
  pressure_hpa: number
  humidity_percent: number
  wind_speed_m_s: number
  wind_direction_deg: number
  air_density: number
  data_source: 'live' | 'estimated' | 'randomized'
}

export interface TrajectoryPoint {
  x: number
  y: number
  z: number
  t: number
}

export interface SimulateResult {
  trajectory: TrajectoryPoint[]
  ghost_trajectory: TrajectoryPoint[]
  conditions: StadiumConditions
  result: 'goal' | 'miss_high' | 'miss_wide' | 'miss_short'
  keeper_trajectory: TrajectoryPoint[]
}

export interface SimulateParams {
  stadium_id: string
  power: number
  horizontal_angle: number
  vertical_angle: number
  spin_rate: number
  spin_axis_x: number
  spin_axis_y: number
  spin_axis_z: number
  conditions: StadiumConditions
  ball_start_x?: number
  ball_start_z?: number
}

export interface GameInitResult {
  stadium: Stadium
  conditions: StadiumConditions
}

// --- API Calls ---

export async function fetchStadiums(): Promise<Stadium[]> {
  const { data } = await axios.get<Stadium[]>(`${BASE}/stadiums`)
  return data
}

export async function fetchConditions(stadiumId: string): Promise<StadiumConditions> {
  const { data } = await axios.get<StadiumConditions>(
    `${BASE}/stadium/${stadiumId}/conditions`
  )
  return data
}

export async function fetchGameInit(): Promise<GameInitResult> {
  const { data } = await axios.get<GameInitResult>(`${BASE}/game/init`)
  return data
}

export async function runSimulation(params: SimulateParams, signal?: AbortSignal): Promise<SimulateResult> {
  const { data } = await axios.post<SimulateResult>(`${BASE}/simulate`, params, { signal })
  return data
}
