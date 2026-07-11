"""
FreeKick Earth — Weather Service

Fetches live weather data from OpenWeatherMap for a given lat/lon.
Falls back to estimated conditions based on altitude when no API key
is configured.
"""

import os
import math
import httpx
from dataclasses import dataclass


@dataclass
class WeatherConditions:
    temperature_celsius: float
    pressure_hpa: float
    humidity_percent: float
    wind_speed_m_s: float
    wind_direction_deg: float


# --- International Standard Atmosphere fallback ---

def estimate_conditions_from_altitude(altitude_m: float) -> WeatherConditions:
    """
    Use the International Standard Atmosphere (ISA) model to estimate
    temperature and pressure from altitude alone.  This provides a
    reasonable physics-based fallback when no API key is available.
    """
    # ISA: T drops 6.5 °C per 1000 m, P follows barometric formula
    sea_level_temp = 15.0  # °C
    sea_level_pressure = 1013.25  # hPa
    lapse_rate = 0.0065  # °C per metre

    temp_c = sea_level_temp - lapse_rate * altitude_m

    # Barometric formula (troposphere)
    temp_k = temp_c + 273.15
    sea_k = sea_level_temp + 273.15
    pressure = sea_level_pressure * (temp_k / sea_k) ** (9.81 / (lapse_rate * 287.05))

    return WeatherConditions(
        temperature_celsius=round(temp_c, 1),
        pressure_hpa=round(pressure, 1),
        humidity_percent=50.0,     # neutral default
        wind_speed_m_s=0.0,
        wind_direction_deg=0.0,
    )


# --- OpenWeatherMap integration ---

async def fetch_weather(lat: float, lon: float) -> WeatherConditions | None:
    """
    Call OpenWeatherMap Current Weather API.
    Returns None if the API key is missing or the request fails.
    """
    api_key = os.getenv("OPENWEATHER_API_KEY", "")
    if not api_key:
        return None

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": api_key,
        "units": "metric",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        main = data.get("main", {})
        wind = data.get("wind", {})

        return WeatherConditions(
            temperature_celsius=main.get("temp", 15.0),
            pressure_hpa=main.get("pressure", 1013.25),
            humidity_percent=main.get("humidity", 50.0),
            wind_speed_m_s=wind.get("speed", 0.0),
            wind_direction_deg=wind.get("deg", 0.0),
        )
    except Exception:
        return None


# --- Air Density Calculation ---

def calculate_air_density(
    temperature_c: float,
    pressure_hpa: float,
    humidity_pct: float,
) -> float:
    """
    Calculate air density (kg/m³) using the ideal gas law with
    humidity correction.

    ρ = (p_d / (R_d × T)) + (p_v / (R_v × T))

    where p_d is dry air partial pressure and p_v is water vapour
    partial pressure.
    """
    T = temperature_c + 273.15          # Kelvin
    p = pressure_hpa * 100.0            # Pa

    R_d = 287.058   # J/(kg·K) — specific gas constant, dry air
    R_v = 461.495   # J/(kg·K) — specific gas constant, water vapour

    # Saturation vapour pressure (Buck equation, hPa)
    e_sat = 6.1121 * math.exp((18.678 - temperature_c / 234.5)
                               * (temperature_c / (257.14 + temperature_c)))

    # Actual vapour pressure
    e = (humidity_pct / 100.0) * e_sat   # hPa
    e_pa = e * 100.0                     # Pa

    # Partial pressure of dry air
    p_d = p - e_pa

    # Air density with humidity correction
    rho = (p_d / (R_d * T)) + (e_pa / (R_v * T))

    return round(rho, 6)
