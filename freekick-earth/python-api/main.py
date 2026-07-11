"""
FreeKick Earth — FastAPI Backend

Endpoints:
  GET  /stadiums                 → list all available stadiums
  GET  /stadium/{id}/conditions  → weather + air density for a stadium
  POST /simulate                 → run physics simulation, return trajectory
"""

import json
import math
import sys
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from weather import (
    WeatherConditions,
    fetch_weather,
    estimate_conditions_from_altitude,
    calculate_air_density,
)

# ---------------------------------------------------------------
# Load the C++ physics engine
# ---------------------------------------------------------------
ENGINE_ROOT = Path(__file__).resolve().parent.parent / "cpp-engine" / "build"
ENGINE_PATHS = [ENGINE_ROOT]
RELEASE_ENGINE_PATH = ENGINE_ROOT / "Release"
if RELEASE_ENGINE_PATH.exists():
    ENGINE_PATHS.append(RELEASE_ENGINE_PATH)

for engine_path in ENGINE_PATHS:
    sys.path.insert(0, str(engine_path))

try:
    import physics_engine as pe  # type: ignore
    ENGINE_AVAILABLE = True
except ImportError:
    ENGINE_AVAILABLE = False
    checked_paths = ", ".join(str(p) for p in ENGINE_PATHS)
    print(f"⚠️  C++ physics engine not found. Checked: {checked_paths}. "
          "POST /simulate will be unavailable.")

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

# Allow the Vite dev server to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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


class TrajectoryPoint(BaseModel):
    x: float
    y: float
    z: float
    t: float


class SimulateResponse(BaseModel):
    trajectory: list[TrajectoryPoint]
    ghost_trajectory: list[TrajectoryPoint]  # baseline (sea-level, 15°C, no wind)
    conditions: ConditionsOut
    result: str  # "goal" | "miss_high" | "miss_wide" | "miss_short"


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------

GOAL_WIDTH  = 7.32   # metres
GOAL_HEIGHT = 2.44   # metres
GOAL_DISTANCE = 27.0  # metres from kick spot

BASELINE_DENSITY = 1.225  # sea-level, 15°C, dry air


def _kick_to_velocity(power: float, h_angle_deg: float, v_angle_deg: float) -> tuple:
    """Convert human-friendly kick params into a 3D velocity vector.
    Z axis = forward toward goal, X = lateral, Y = up.
    """
    # Negate h_angle_deg because in our 3D coordinate system, 
    # looking down +Z means +X is to the left of the screen.
    # A negative h_angle means "Left", so we want a positive X velocity.
    h_rad = math.radians(-h_angle_deg)
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
) -> list[TrajectoryPoint]:
    """Call the C++ engine and return a list of trajectory points."""
    vx, vy, vz = _kick_to_velocity(power, h_angle, v_angle)

    kick = pe.KickParams()
    kick.initial_velocity = pe.Vector3D(vx, vy, vz)
    kick.initial_spin = pe.Vector3D(
        spin_rate * spin_axis[0],
        spin_rate * spin_axis[1],
        spin_rate * spin_axis[2],
    )

    env = pe.Environment()
    env.air_density = air_density

    # Decompose wind direction into X/Z components
    wind_rad = math.radians(wind_dir_deg)
    env.wind_velocity = pe.Vector3D(
        wind_speed * math.sin(wind_rad),
        0.0,
        wind_speed * math.cos(wind_rad),
    )

    raw = pe.simulate_trajectory(kick, env)

    return [
        TrajectoryPoint(
            x=round(s.position.x, 4),
            y=round(s.position.y, 4),
            z=round(s.position.z, 4),
            t=round(s.time, 4),
        )
        for s in raw
    ]


def _classify_result(trajectory: list[TrajectoryPoint]) -> str:
    """Determine if the kick was a goal or a specific type of miss."""
    crossing_pt = None
    prev_pt = None
    
    for pt in trajectory:
        if prev_pt is not None and prev_pt.z < GOAL_DISTANCE and pt.z >= GOAL_DISTANCE:
            # Interpolate to find exact crossing point
            fraction = (GOAL_DISTANCE - prev_pt.z) / (pt.z - prev_pt.z)
            crossing_y = prev_pt.y + fraction * (pt.y - prev_pt.y)
            crossing_x = prev_pt.x + fraction * (pt.x - prev_pt.x)
            
            # Create the interpolated point
            crossing_pt = TrajectoryPoint(x=crossing_x, y=crossing_y, z=GOAL_DISTANCE, t=pt.t)
            break
        prev_pt = pt

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

    # Get conditions for this stadium
    conditions = await get_conditions(req.stadium_id)

    spin_axis = (req.spin_axis_x, req.spin_axis_y, req.spin_axis_z)

    # --- Actual trajectory (real conditions) ---
    actual = _run_simulation(
        power=req.power,
        h_angle=req.horizontal_angle,
        v_angle=req.vertical_angle,
        spin_rate=req.spin_rate,
        spin_axis=spin_axis,
        air_density=conditions.air_density,
        wind_speed=conditions.wind_speed_m_s,
        wind_dir_deg=conditions.wind_direction_deg,
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
    )

    result = _classify_result(actual)

    return SimulateResponse(
        trajectory=actual,
        ghost_trajectory=ghost,
        conditions=conditions,
        result=result,
    )
