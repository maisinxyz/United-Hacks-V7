"""
FreeKick Earth — FastAPI Backend

Endpoints:
  GET  /stadiums                 → list all available stadiums
  GET  /stadium/{id}/conditions  → weather + air density for a stadium
  GET  /game/init                → randomly select stadium + generate conditions
  POST /simulate                 → run physics simulation, return trajectory
"""

import json
import math
import random
import sys
import os
from pathlib import Path
from typing import Optional, Dict, List, Any
import string
import asyncio

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from weather import (
    WeatherConditions,
    fetch_weather,
    estimate_conditions_from_altitude,
    calculate_air_density,
)

# ---------------------------------------------------------------
# Load the Python physics engine
# ---------------------------------------------------------------
import physics as pe

ENGINE_AVAILABLE = True

# ---------------------------------------------------------------
# Load stadium data
# ---------------------------------------------------------------
STADIUMS_FILE = Path(__file__).resolve().parent / "stadiums.json"
with open(STADIUMS_FILE, "r") as f:
    STADIUMS_LIST = json.load(f)

STADIUMS = {s["id"]: s for s in STADIUMS_LIST}

# ---------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------
app = FastAPI(
    title="FreeKick Earth API",
    description="Physics simulation backend for the FreeKick Earth game.",
    version="0.1.0",
)

# Allow the Vite dev server and production frontend to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------

class StadiumOut(BaseModel):
    id: str
    name: str
    city: str
    country: str
    lat: float
    lon: float
    altitude_meters: float


class ConditionsOut(BaseModel):
    stadium: StadiumOut
    temperature_celsius: float
    pressure_hpa: float
    humidity_percent: float
    wind_speed_m_s: float
    wind_direction_deg: float
    air_density: float
    data_source: str  # "live" or "estimated"


class Vec3In(BaseModel):
    x: float
    y: float
    z: float


class SimulateRequest(BaseModel):
    stadium_id: str
    power: float              # m/s  (kick speed)
    horizontal_angle: float   # degrees  (left/right aim, 0 = straight)
    vertical_angle: float     # degrees  (launch pitch, e.g. 25°)
    spin_rate: float           # rad/s  (magnitude of spin)
    spin_axis_x: float = 0.0   # spin axis components (normalised by engine)
    spin_axis_y: float = 1.0
    spin_axis_z: float = 0.0
    conditions: ConditionsOut
    ball_start_x: float = 0.0  # lateral offset from centre
    ball_start_z: float = 0.0  # forward offset from default kick spot

class TrajectoryPoint(BaseModel):
    x: float
    y: float
    z: float
    t: float

class GameInitResponse(BaseModel):
    stadium: StadiumOut
    conditions: ConditionsOut

class SimulateResponse(BaseModel):
    trajectory: list[TrajectoryPoint]
    ghost_trajectory: list[TrajectoryPoint]  # baseline (sea-level, 15°C, no wind)
    conditions: ConditionsOut
    result: str  # "goal" | "miss_high" | "miss_wide" | "miss_short"
    keeper_trajectory: list[TrajectoryPoint]  # goalkeeper dive path

# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------

GOAL_WIDTH  = 7.32   # metres
GOAL_HEIGHT = 2.44   # metres
GOAL_DISTANCE = 27.0  # metres from kick spot

BASELINE_DENSITY = 1.225  # sea-level, 15°C, dry air

# Goalkeeper AI constants
KEEPER_REACTION_TIME = 0.35  # seconds before keeper starts moving
KEEPER_SPEED = 8.0           # m/s lateral movement speed
KEEPER_REACH = 2.2           # m arm span + dive extension
KEEPER_START_X = 0.0
KEEPER_START_Y = 1.0         # standing height
KEEPER_START_Z = 27.0        # on the goal line

def _kick_to_velocity(power: float, h_angle_deg: float, v_angle_deg: float, ball_start_x: float = 0.0, ball_start_z: float = 0.0) -> tuple:
    """Convert human-friendly kick params into a 3D velocity vector.
    Z axis = forward toward goal, X = lateral, Y = up.
    """
    dx = 0.0 - ball_start_x
    dz = 27.0 - ball_start_z
    base_angle = math.atan2(dx, dz)

    # Negate h_angle_deg because in our 3D coordinate system, 
    # looking down +Z means +X is to the left of the screen.
    # A negative h_angle means "Left", so we want a positive X velocity.
    h_rad = math.radians(-h_angle_deg) + base_angle
    v_rad = math.radians(v_angle_deg)

    vz = power * math.cos(v_rad) * math.cos(h_rad)  # forward
    vx = power * math.cos(v_rad) * math.sin(h_rad)  # lateral
    vy = power * math.sin(v_rad)                     # upward

    return (vx, vy, vz)

def _run_simulation(
    power: float,
    h_angle: float,
    v_angle: float,
    spin_rate: float,
    spin_axis: tuple,
    air_density: float,
    wind_speed: float,
    wind_dir_deg: float,
    gravity: float = 9.81,
    ball_start_x: float = 0.0,
    ball_start_z: float = 0.0,
) -> list[TrajectoryPoint]:
    """Call the Python engine and return a list of trajectory points."""
    vx, vy, vz = _kick_to_velocity(power, h_angle, v_angle, ball_start_x, ball_start_z)

    kick = pe.KickParams()
    kick.initial_velocity = pe.Vector3D(vx, vy, vz)
    kick.initial_spin = pe.Vector3D(
        spin_rate * spin_axis[0],
        spin_rate * spin_axis[1],
        spin_rate * spin_axis[2],
    )

    env = pe.Environment()
    env.air_density = air_density
    env.gravity = gravity

    # Decompose wind direction into X/Z components
    wind_rad = math.radians(wind_dir_deg)
    env.wind_velocity = pe.Vector3D(
        wind_speed * math.sin(wind_rad),
        0.0,
        wind_speed * math.cos(wind_rad),
    )

    raw = pe.simulate_trajectory(kick, env, ball_start_x=ball_start_x, ball_start_z=ball_start_z)

    # Calculate wall parameters
    wall_dist = 9.144
    dist_to_goal = math.hypot(0 - ball_start_x, 27 - ball_start_z)
    has_wall = dist_to_goal >= 10.0
    
    wall_center_x = 0
    wall_center_z = 0
    if has_wall:
        dir_x = (0 - ball_start_x) / dist_to_goal
        dir_z = (27 - ball_start_z) / dist_to_goal
        wall_center_x = ball_start_x + dir_x * wall_dist
        wall_center_z = ball_start_z + dir_z * wall_dist

    processed_traj = []
    wall_hit = False

    for i, s in enumerate(raw):
        pt = TrajectoryPoint(
            x=round(s.position.x, 4),
            y=round(s.position.y, 4),
            z=round(s.position.z, 4),
            t=round(s.time, 4),
        )

        if has_wall and not wall_hit:
            dist_from_start = math.hypot(pt.x - ball_start_x, pt.z - ball_start_z)
            if dist_from_start >= wall_dist:
                # Crossed the wall plane
                lateral_dist = math.hypot(pt.x - wall_center_x, pt.z - wall_center_z)
                # Wall is approx 3m wide (1.5m half-width)
                # Base height is 1.85m. Calculate the dynamic jump height at time pt.t
                # Average jump parameters matching the frontend: v=2.44, g=5.42 (h~0.55m, hangTime~0.9s)
                jump_y = max(0, 2.44 * pt.t - 0.5 * 5.42 * pt.t * pt.t)
                current_wall_height = 1.85 + jump_y

                if lateral_dist <= 1.5 and pt.y <= current_wall_height:
                    wall_hit = True
                    processed_traj.append(pt)
                    
                    # Generate a simple bounce off the wall
                    bounce_t = pt.t
                    bx = pt.x
                    by = pt.y
                    bz = pt.z
                    
                    # Approximate velocity at impact
                    vx = (pt.x - raw[i-1].position.x) / (pt.t - raw[i-1].time) if i > 0 else 0
                    vy = (pt.y - raw[i-1].position.y) / (pt.t - raw[i-1].time) if i > 0 else 0
                    vz = (pt.z - raw[i-1].position.z) / (pt.t - raw[i-1].time) if i > 0 else 0
                    
                    # Reverse and dampen velocity for the bounce
                    vx = -vx * 0.4
                    vy = abs(vy) * 0.3 if vy < 0 else vy * 0.3
                    vz = -vz * 0.4
                    
                    for _ in range(15):
                        bounce_t += 0.05
                        bx += vx * 0.05
                        by += vy * 0.05
                        bz += vz * 0.05
                        vy -= gravity * 0.05
                        if by < 0.11:  # hit the ground
                            by = 0.11
                            vy = -vy * 0.5
                        processed_traj.append(TrajectoryPoint(
                            x=round(bx, 4), y=round(by, 4), z=round(bz, 4), t=round(bounce_t, 4)
                        ))
                    break # Stop reading raw trajectory, we bounced!
                    
        processed_traj.append(pt)

    return processed_traj

def _get_crossing_point(trajectory: list[TrajectoryPoint]) -> Optional[TrajectoryPoint]:
    prev_pt = None
    for pt in trajectory:
        if prev_pt is not None and prev_pt.z < GOAL_DISTANCE and pt.z >= GOAL_DISTANCE:
            fraction = (GOAL_DISTANCE - prev_pt.z) / (pt.z - prev_pt.z)
            crossing_y = prev_pt.y + fraction * (pt.y - prev_pt.y)
            crossing_x = prev_pt.x + fraction * (pt.x - prev_pt.x)
            return TrajectoryPoint(x=crossing_x, y=crossing_y, z=GOAL_DISTANCE, t=pt.t)
        prev_pt = pt
    return None

def _classify_result(trajectory: list[TrajectoryPoint]) -> str:
    """Determine if the kick was a goal or a specific type of miss."""
    crossing_pt = _get_crossing_point(trajectory)

    if crossing_pt is None:
        return "miss_short"

    half_w = GOAL_WIDTH / 2.0

    # Check if within the posts and under the bar
    if abs(crossing_pt.x) <= half_w and 0.0 <= crossing_pt.y <= GOAL_HEIGHT:
        return "goal"
    elif crossing_pt.y > GOAL_HEIGHT:
        return "miss_high"
    else:
        return "miss_wide"

def _calculate_keeper_trajectory(
    trajectory: list[TrajectoryPoint],
) -> tuple[list[TrajectoryPoint], bool]:
    """Calculate the goalkeeper's dive path and whether they save the shot."""
    # Find the crossing point
    crossing_pt = None
    t_cross = None
    prev_pt = None
    for pt in trajectory:
        if prev_pt is not None and prev_pt.z < GOAL_DISTANCE and pt.z >= GOAL_DISTANCE:
            fraction = (GOAL_DISTANCE - prev_pt.z) / (pt.z - prev_pt.z)
            cross_x = prev_pt.x + fraction * (pt.x - prev_pt.x)
            cross_y = prev_pt.y + fraction * (pt.y - prev_pt.y)
            t_cross = prev_pt.t + fraction * (pt.t - prev_pt.t)
            crossing_pt = (cross_x, cross_y)
            break
        prev_pt = pt

    # Default: keeper stays put
    keeper_start = TrajectoryPoint(
        x=KEEPER_START_X, y=KEEPER_START_Y, z=KEEPER_START_Z, t=0.0
    )

    if crossing_pt is None or t_cross is None:
        # Ball never reaches goal line — keeper stands still
        return [keeper_start, keeper_start], False

    cross_x, cross_y = crossing_pt
    dx = cross_x - KEEPER_START_X
    dy = cross_y - KEEPER_START_Y
    distance = math.sqrt(dx * dx + dy * dy)

    available_time = t_cross - KEEPER_REACTION_TIME
    if available_time < 0:
        available_time = 0

    max_reachable = available_time * KEEPER_SPEED + KEEPER_REACH
    saved = distance <= max_reachable

    # Clamp dive target to max reachable distance
    if distance > 0:
        clamp_factor = min(1.0, max_reachable / distance)
        target_x = KEEPER_START_X + dx * clamp_factor
        target_y = KEEPER_START_Y + dy * clamp_factor
    else:
        target_x = KEEPER_START_X
        target_y = KEEPER_START_Y

    # Keeper starts moving after reaction time
    dive_start_t = KEEPER_REACTION_TIME
    dive_end_t = t_cross

    keeper_path = [
        TrajectoryPoint(x=KEEPER_START_X, y=KEEPER_START_Y, z=KEEPER_START_Z, t=0.0),
        TrajectoryPoint(x=KEEPER_START_X, y=KEEPER_START_Y, z=KEEPER_START_Z, t=round(dive_start_t, 4)),
        TrajectoryPoint(x=round(target_x, 4), y=round(target_y, 4), z=KEEPER_START_Z, t=round(dive_end_t, 4)),
    ]

    return keeper_path, saved

# ---------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------

@app.get("/")
async def root():
    """Health-check."""
    return {"status": "ok", "engine": ENGINE_AVAILABLE}

@app.get("/stadiums", response_model=list[StadiumOut])
async def list_stadiums():
    """Return all available stadiums."""
    return [StadiumOut(**s) for s in STADIUMS_LIST]

@app.get("/game/init", response_model=GameInitResponse)
async def game_init():
    """Randomly select a stadium and generate locale-bounded conditions."""
    stadium_data = random.choice(STADIUMS_LIST)

    # Generate randomized weather bounded by the stadium's climate ranges
    temp_range = stadium_data.get("temp_range_c", [10, 30])
    wind_range = stadium_data.get("wind_range_m_s", [0, 10])

    temperature = round(random.uniform(temp_range[0], temp_range[1]), 1)
    wind_speed = round(random.uniform(wind_range[0], wind_range[1]), 1)
    wind_direction = round(random.uniform(0, 360), 1)
    humidity = 50.0  # fixed

    # Calculate pressure from altitude using ISA model
    altitude = stadium_data["altitude_meters"]
    estimated = estimate_conditions_from_altitude(altitude)
    pressure = estimated.pressure_hpa

    density = calculate_air_density(temperature, pressure, humidity)

    stadium_out = StadiumOut(**stadium_data)
    conditions = ConditionsOut(
        stadium=stadium_out,
        temperature_celsius=temperature,
        pressure_hpa=round(pressure, 1),
        humidity_percent=humidity,
        wind_speed_m_s=wind_speed,
        wind_direction_deg=wind_direction,
        air_density=round(density, 4),
        data_source="randomized",
    )

    return GameInitResponse(stadium=stadium_out, conditions=conditions)

@app.get("/stadium/{stadium_id}/conditions", response_model=ConditionsOut)
async def get_conditions(stadium_id: str):
    """Fetch current weather + calculated air density for a stadium."""
    stadium = STADIUMS.get(stadium_id)
    if not stadium:
        raise HTTPException(404, f"Stadium '{stadium_id}' not found.")

    # Try live weather first, fall back to ISA model
    live = await fetch_weather(stadium["lat"], stadium["lon"])
    if live:
        weather = live
        source = "live"
    else:
        weather = estimate_conditions_from_altitude(stadium["altitude_meters"])
        source = "estimated"

    density = calculate_air_density(
        weather.temperature_celsius,
        weather.pressure_hpa,
        weather.humidity_percent,
    )

    return ConditionsOut(
        stadium=StadiumOut(**stadium),
        temperature_celsius=weather.temperature_celsius,
        pressure_hpa=weather.pressure_hpa,
        humidity_percent=weather.humidity_percent,
        wind_speed_m_s=weather.wind_speed_m_s,
        wind_direction_deg=weather.wind_direction_deg,
        air_density=density,
        data_source=source,
    )

@app.post("/simulate", response_model=SimulateResponse)
async def simulate(req: SimulateRequest):
    """Run the physics simulation and return actual + ghost trajectories."""
    if not ENGINE_AVAILABLE:
        raise HTTPException(503, "C++ physics engine is not loaded.")

    stadium = STADIUMS.get(req.stadium_id)
    if not stadium:
        raise HTTPException(404, f"Stadium '{req.stadium_id}' not found.")

    # Use conditions provided by the frontend
    conditions = req.conditions

    spin_axis = (req.spin_axis_x, req.spin_axis_y, req.spin_axis_z)
    bsx = req.ball_start_x
    bsz = req.ball_start_z

    # Altitude mechanic: lower gravity at high altitude
    # Mexico City (2200m) -> 9.81 - 1.1 = 8.71 m/s^2 (significantly floatier)
    custom_gravity = 9.81 - (stadium["altitude_meters"] / 1000.0) * 0.5

    # Temperature drift mechanic (sweat on ball)
    actual_h_angle = req.horizontal_angle
    actual_v_angle = req.vertical_angle
    if conditions.temperature_celsius > 25.0:
        diff = conditions.temperature_celsius - 25.0
        max_err = (diff / 5.0) * 2.0 # ±2 deg per 5 deg over 25°C
        actual_h_angle += random.uniform(-max_err, max_err)
        actual_v_angle += random.uniform(-max_err, max_err)

    # --- Actual trajectory (real conditions) ---
    actual = _run_simulation(
        power=req.power,
        h_angle=actual_h_angle,
        v_angle=actual_v_angle,
        spin_rate=req.spin_rate,
        spin_axis=spin_axis,
        air_density=conditions.air_density,
        wind_speed=conditions.wind_speed_m_s,
        wind_dir_deg=conditions.wind_direction_deg,
        gravity=custom_gravity,
        ball_start_x=bsx,
        ball_start_z=bsz,
    )

    # --- Ghost trajectory (baseline: sea-level, 15°C, no wind) ---
    ghost = _run_simulation(
        power=req.power,
        h_angle=req.horizontal_angle,
        v_angle=req.vertical_angle,
        spin_rate=req.spin_rate,
        spin_axis=spin_axis,
        air_density=BASELINE_DENSITY,
        wind_speed=0.0,
        wind_dir_deg=0.0,
        gravity=9.81,
        ball_start_x=bsx,
        ball_start_z=bsz,
    )

    result = _classify_result(actual)

    return SimulateResponse(
        trajectory=actual,
        ghost_trajectory=ghost,
        conditions=conditions,
        result=result,
        keeper_trajectory=[],
    )

# ---------------------------------------------------------------
# Multiplayer
# ---------------------------------------------------------------

class Room:
    def __init__(self, code: str):
        self.code = code
        self.players: Dict[str, dict] = {} # client_id -> { "ws": WebSocket, "score": 0, "name": str, "connected": bool }
        self.roles: Dict[str, str] = {} # "kicker" -> client_id, "goalkeeper" -> client_id
        self.stadium: Optional[StadiumOut] = None
        self.conditions: Optional[ConditionsOut] = None
        self.ball_positions: List[List[float]] = []
        self.current_turn: Optional[str] = None
        self.round: int = 0
        self.max_rounds: int = 5
        self.ready_count: int = 0
        self.history: List[str] = []
        self.pending_kick: Optional[tuple] = None  # (client_id, SimulateRequest)

class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}

    def generate_code(self) -> str:
        while True:
            code = "".join(random.choices(string.ascii_uppercase, k=4))
            if code not in self.rooms:
                return code

    async def broadcast(self, room: Room, message: dict):
        for p in room.players.values():
            if p["connected"]:
                await p["ws"].send_json(message)

manager = RoomManager()

async def process_shot(manager, room, client_id: str, req: SimulateRequest, keeper_guess: Optional[tuple[float, float]]):
    spin_axis = (req.spin_axis_x, req.spin_axis_y, req.spin_axis_z)
    actual = _run_simulation(
        power=req.power,
        h_angle=req.horizontal_angle,
        v_angle=req.vertical_angle,
        spin_rate=req.spin_rate,
        spin_axis=spin_axis,
        air_density=room.conditions.air_density,
        wind_speed=room.conditions.wind_speed_m_s,
        wind_dir_deg=room.conditions.wind_direction_deg,
        gravity=9.81,
        ball_start_x=req.ball_start_x,
        ball_start_z=req.ball_start_z,
    )
    
    res = _classify_result(actual)
    if res == "goal" and keeper_guess is not None:
        crossing_pt = None
        prev_pt = None
        for pt in actual:
            if prev_pt is not None and prev_pt.z < 27.0 and pt.z >= 27.0:
                fraction = (27.0 - prev_pt.z) / (pt.z - prev_pt.z)
                cross_x = prev_pt.x + fraction * (pt.x - prev_pt.x)
                cross_y = prev_pt.y + fraction * (pt.y - prev_pt.y)
                crossing_pt = (cross_x, cross_y)
                break
            prev_pt = pt
            
        if crossing_pt:
            kx, ky = keeper_guess
            cx, cy = crossing_pt
            # Give the keeper a decent reach radius (e.g. 1.5 meters)
            dist = math.hypot(kx - cx, ky - cy)
            if dist <= 1.5:
                res = "save"

    keeper_id = room.roles.get("goalkeeper")
    if res == "goal":
        room.players[client_id]["score"] += 1
    elif keeper_id and keeper_id in room.players:
        room.players[keeper_id]["score"] += 1

    room.history.append(res)

    players_state = {
        pid: {"name": p["name"], "score": p["score"], "connected": p["connected"]}
        for pid, p in room.players.items()
    }
    
    await manager.broadcast(room, {
        "type": "shot_result",
        "player_id": client_id,
        "trajectory": [pt.model_dump() for pt in actual],
        "result": res,
        "score": room.players[client_id]["score"],
        "players": players_state,
        "history": room.history
    })

class CreateRoomResponse(BaseModel):
    room_code: str

@app.post("/multiplayer/create", response_model=CreateRoomResponse)
async def create_room():
    code = manager.generate_code()
    manager.rooms[code] = Room(code)
    return CreateRoomResponse(room_code=code)

@app.websocket("/multiplayer/ws/{room_code}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, client_id: str, name: str = "Player"):
    await websocket.accept()
    room = manager.rooms.get(room_code)
    if not room:
        await websocket.send_json({"type": "error", "message": "Room not found"})
        await websocket.close()
        return

    if client_id not in room.players:
        # Clear out any disconnected players to free up space
        disconnected = [pid for pid, p in room.players.items() if not p.get("connected", False)]
        for pid in disconnected:
            del room.players[pid]
            # Also remove their role
            roles_to_remove = [r for r, r_pid in list(room.roles.items()) if r_pid == pid]
            for r in roles_to_remove:
                del room.roles[r]

        if len(room.players) >= 2:
            await websocket.send_json({"type": "error", "message": "Room is full"})
            await websocket.close()
            return
        room.players[client_id] = {"ws": websocket, "score": 0, "name": name, "connected": True}
    else:
        room.players[client_id]["ws"] = websocket
        room.players[client_id]["connected"] = True

    try:
        if len(room.players) == 2 and room.round == 0 and not room.stadium:
            # Need role selection
            await manager.broadcast(room, {
                "type": "role_selection",
                "roles": room.roles
            })
        else:
            # Just send state
            msg = {
                "type": "room_state",
                "players": {pid: {"name": p["name"], "score": p["score"], "connected": p["connected"]} for pid, p in room.players.items()},
                "roles": room.roles
            }
            if room.stadium:
                msg["stadium"] = room.stadium.model_dump()
                msg["conditions"] = room.conditions.model_dump()
                msg["ball_positions"] = room.ball_positions
                msg["turn"] = room.current_turn
                msg["round"] = room.round
                msg["history"] = room.history
            await websocket.send_json(msg)

        while True:
            data = await websocket.receive_json()
            if data["type"] == "select_role":
                role = data["role"]
                if role not in room.roles:
                    for r, cid in list(room.roles.items()):
                        if cid == client_id:
                            del room.roles[r]
                    room.roles[role] = client_id
                    
                    await manager.broadcast(room, {
                        "type": "role_update",
                        "roles": room.roles
                    })
                    
                    if "kicker" in room.roles and "goalkeeper" in room.roles and room.round == 0 and not room.stadium:
                        # Initialize game
                        stadium_data = random.choice(STADIUMS_LIST)
                        stadium_out = StadiumOut(**stadium_data)
                        room.stadium = stadium_out
                        
                        room.conditions = ConditionsOut(
                            stadium=stadium_out,
                            temperature_celsius=20.0,
                            pressure_hpa=1013.25,
                            humidity_percent=50.0,
                            wind_speed_m_s=0.0,
                            wind_direction_deg=0.0,
                            air_density=1.225,
                            data_source="randomized"
                        )
                        for _ in range(5):
                            bx = round(random.uniform(-12, 12), 1)
                            bz = round(random.uniform(2, 12), 1)
                            room.ball_positions.append([bx, bz])
                        
                        room.current_turn = room.roles["kicker"] # Kicker starts
                        
                        await manager.broadcast(room, {
                            "type": "game_start",
                            "stadium": room.stadium.model_dump(),
                            "conditions": room.conditions.model_dump(),
                            "ball_positions": room.ball_positions,
                            "turn": room.current_turn,
                            "history": room.history,
                            "players": {pid: {"name": p["name"], "score": p["score"]} for pid, p in room.players.items()}
                        })
                        
            elif data["type"] == "take_shot":
                req = SimulateRequest(**data["params"])
                room.pending_kick = (client_id, req)
                
                # Pre-calculate trajectory to get target for Goalkeeper
                raw_traj = _run_simulation(
                    power=req.power,
                    h_angle=req.horizontal_angle,
                    v_angle=req.vertical_angle,
                    spin_rate=req.spin_rate,
                    spin_axis=(req.spin_axis_x, req.spin_axis_y, req.spin_axis_z),
                    air_density=req.conditions.air_density,
                    wind_speed=req.conditions.wind_speed_m_s,
                    wind_dir_deg=req.conditions.wind_direction_deg,
                    ball_start_x=req.ball_start_x,
                    ball_start_z=req.ball_start_z
                )
                crossing_pt = _get_crossing_point(raw_traj)
                
                await manager.broadcast(room, {
                    "type": "keeper_reaction_phase",
                    "target_x": crossing_pt.x if crossing_pt else None,
                    "target_y": crossing_pt.y if crossing_pt else None
                })
                
                async def wait_for_reaction(room_ref, current_req):
                    await asyncio.sleep(2.0)
                    if room_ref.pending_kick and room_ref.pending_kick[1] == current_req:
                        # Timeout - process without save
                        cid, r = room_ref.pending_kick
                        room_ref.pending_kick = None
                        await process_shot(manager, room_ref, cid, r, None)
                
                asyncio.create_task(wait_for_reaction(room, req))
                
            elif data["type"] == "keeper_reaction":
                if room.pending_kick:
                    cid, req = room.pending_kick
                    room.pending_kick = None
                    guess = (data.get("x"), data.get("y")) if "x" in data else None
                    await process_shot(manager, room, cid, req, guess)
                
            elif data["type"] == "animation_complete":
                room.ready_count += 1
                if room.ready_count >= len(room.players):
                    room.ready_count = 0
                    
                    room.current_turn = room.roles.get("kicker")
                    room.round += 1
                        
                    if room.round >= room.max_rounds:
                        await manager.broadcast(room, {
                            "type": "game_over",
                            "players": {pid: {"name": p["name"], "score": p["score"]} for pid, p in room.players.items()}
                        })
                    else:
                        await manager.broadcast(room, {
                            "type": "turn_start",
                            "turn": room.current_turn,
                            "round": room.round,
                            "history": room.history
                        })

    except WebSocketDisconnect:
        room.players[client_id]["connected"] = False
        await manager.broadcast(room, {
            "type": "player_disconnected",
            "player_id": client_id
        })
        if all(not p["connected"] for p in room.players.values()):
            del manager.rooms[room_code]
