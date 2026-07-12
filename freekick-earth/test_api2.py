import sys
sys.path.append("/Users/vincee_ong/Desktop/hackathons/United-Hacks-V7/freekick-earth/python-api")
from main import simulate, SimulateRequest, ConditionsOut
import asyncio

req = SimulateRequest(
    stadium_id="azteca",
    power=50.0,
    horizontal_angle=0.0,
    vertical_angle=20.0,
    spin_rate=0.0,
    spin_axis_x=0.0,
    spin_axis_y=0.0,
    spin_axis_z=0.0,
    conditions=ConditionsOut(
        stadium={
            "id": "azteca",
            "name": "Estadio Azteca",
            "city": "Mexico City",
            "country": "Mexico",
            "capacity": 87523,
            "climate_type": "high-altitude",
            "avg_temp_c": 15.0,
            "altitude_m": 2200.0,
            "image_url": ""
        },
        temperature_celsius=20,
        pressure_hpa=1013,
        humidity_percent=50,
        wind_speed_m_s=0,
        wind_direction_deg=0,
        air_density=1.2,
        data_source="live"
    ),
    ball_start_x=0,
    ball_start_z=0,
    is_preview=True
)

async def test():
    try:
        res = await simulate(req)
        print("SUCCESS, trajectory length:", len(res.trajectory))
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(test())
