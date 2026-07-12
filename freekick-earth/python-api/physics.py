import math
from typing import List

# ============================================================
# FreeKick Earth — Physics Engine Implementation (Pure Python)
#
# Forces modelled:
#   1. Gravity           — constant downward pull
#   2. Aerodynamic Drag  — F_d = ½ ρ v² C_d A  (opposes motion)
#   3. Magnus Effect     — F_M = C_m × (ω × v_rel) (curves the ball)
#
# Integration: Runge-Kutta 4th Order (RK4) for accuracy.
# ============================================================

# Physical constants
BALL_RADIUS = 0.11         # m (standard size 5 football)
BALL_MASS = 0.43           # kg
BALL_CROSS_SECTION = math.pi * BALL_RADIUS * BALL_RADIUS
DRAG_COEFFICIENT = 0.25    # C_d
MAGNUS_COEFFICIENT = 0.25  # C_m
TIMESTEP = 0.0166667       # ~60Hz

class Vector3D:
    __slots__ = ['x', 'y', 'z']
    def __init__(self, x=0.0, y=0.0, z=0.0):
        self.x = x
        self.y = y
        self.z = z

    def magnitude(self) -> float:
        return math.sqrt(self.x*self.x + self.y*self.y + self.z*self.z)

    def normalized(self) -> 'Vector3D':
        mag = self.magnitude()
        if mag < 1e-12:
            return Vector3D(0, 0, 0)
        return Vector3D(self.x/mag, self.y/mag, self.z/mag)

    def __add__(self, other):
        return Vector3D(self.x + other.x, self.y + other.y, self.z + other.z)

    def __sub__(self, other):
        return Vector3D(self.x - other.x, self.y - other.y, self.z - other.z)

    def __mul__(self, scalar: float):
        return Vector3D(self.x * scalar, self.y * scalar, self.z * scalar)
    
    def __rmul__(self, scalar: float):
        return self.__mul__(scalar)

    def __truediv__(self, scalar: float):
        return Vector3D(self.x / scalar, self.y / scalar, self.z / scalar)

def cross(a: Vector3D, b: Vector3D) -> Vector3D:
    return Vector3D(
        a.y * b.z - a.z * b.y,
        a.z * b.x - a.x * b.z,
        a.x * b.y - a.y * b.x
    )

class Environment:
    __slots__ = ['air_density', 'gravity', 'wind_velocity']
    def __init__(self):
        self.air_density = 1.225
        self.gravity = 9.81
        self.wind_velocity = Vector3D(0, 0, 0)

class KickParams:
    __slots__ = ['initial_velocity', 'initial_spin']
    def __init__(self):
        self.initial_velocity = Vector3D(0, 0, 0)
        self.initial_spin = Vector3D(0, 0, 0)

class BallState:
    __slots__ = ['position', 'velocity', 'angular_velocity', 'time']
    def __init__(self):
        self.position = Vector3D(0, 0, 0)
        self.velocity = Vector3D(0, 0, 0)
        self.angular_velocity = Vector3D(0, 0, 0)
        self.time = 0.0

class SimState:
    __slots__ = ['pos', 'vel']
    def __init__(self, pos: Vector3D, vel: Vector3D):
        self.pos = pos
        self.vel = vel

def gravity_force(gravity: float) -> Vector3D:
    return Vector3D(0.0, -gravity * BALL_MASS, 0.0)

def drag_force(velocity: Vector3D, wind: Vector3D, air_density: float) -> Vector3D:
    v_rel = velocity - wind
    speed = v_rel.magnitude()
    if speed < 1e-12:
        return Vector3D(0, 0, 0)
    
    drag_magnitude = 0.5 * air_density * speed * speed * DRAG_COEFFICIENT * BALL_CROSS_SECTION
    drag_direction = v_rel.normalized() * -1.0
    return drag_direction * drag_magnitude

def magnus_force(angular_velocity: Vector3D, velocity: Vector3D, wind: Vector3D, air_density: float) -> Vector3D:
    v_rel = velocity - wind
    speed = v_rel.magnitude()
    if speed < 1e-12:
        return Vector3D(0, 0, 0)
    
    magnus_dir = cross(angular_velocity, v_rel)
    scale = MAGNUS_COEFFICIENT * 0.5 * air_density * BALL_RADIUS * BALL_CROSS_SECTION
    return magnus_dir * scale

def compute_acceleration(vel: Vector3D, angular_vel: Vector3D, env: Environment) -> Vector3D:
    f_gravity = gravity_force(env.gravity)
    f_drag = drag_force(vel, env.wind_velocity, env.air_density)
    f_magnus = magnus_force(angular_vel, vel, env.wind_velocity, env.air_density)
    total = f_gravity + f_drag + f_magnus
    return total / BALL_MASS

def rk4_step(s: SimState, angular_vel: Vector3D, env: Environment, dt: float) -> SimState:
    a1 = compute_acceleration(s.vel, angular_vel, env)
    k1v = a1 * dt
    k1p = s.vel * dt

    v2 = s.vel + k1v * 0.5
    a2 = compute_acceleration(v2, angular_vel, env)
    k2v = a2 * dt
    k2p = v2 * dt

    v3 = s.vel + k2v * 0.5
    a3 = compute_acceleration(v3, angular_vel, env)
    k3v = a3 * dt
    k3p = v3 * dt

    v4 = s.vel + k3v
    a4 = compute_acceleration(v4, angular_vel, env)
    k4v = a4 * dt
    k4p = v4 * dt

    next_vel = s.vel + (k1v + k2v * 2.0 + k3v * 2.0 + k4v) / 6.0
    next_pos = s.pos + (k1p + k2p * 2.0 + k3p * 2.0 + k4p) / 6.0

    return SimState(next_pos, next_vel)

def simulate_trajectory(kick: KickParams, env: Environment, ball_start_x: float = 0.0, ball_start_z: float = 0.0) -> List[BallState]:
    trajectory = []
    
    dt = TIMESTEP
    state = BallState()
    state.position = Vector3D(ball_start_x, 0.111, ball_start_z)
    state.velocity = kick.initial_velocity
    state.angular_velocity = kick.initial_spin
    state.time = 0.0

    # We use a copy of the state for the trajectory array to avoid reference issues
    def save_state(st: BallState):
        copy = BallState()
        copy.position = Vector3D(st.position.x, st.position.y, st.position.z)
        copy.velocity = Vector3D(st.velocity.x, st.velocity.y, st.velocity.z)
        copy.angular_velocity = Vector3D(st.angular_velocity.x, st.angular_velocity.y, st.angular_velocity.z)
        copy.time = st.time
        trajectory.append(copy)

    save_state(state)

    MAX_FRAMES = 20000
    COEFF_RESTITUTION = 0.65
    KINETIC_FRICTION = 0.85
    ROLL_FRICTION = 3.0
    BOUNCE_THRESHOLD = 0.5

    is_rolling = False
    entered_goal_mouth = False

    for i in range(MAX_FRAMES):
        prev_z = state.position.z
        prev_y = state.position.y
        prev_x = state.position.x

        if not is_rolling:
            current = SimState(state.position, state.velocity)
            next_state = rk4_step(current, state.angular_velocity, env, dt)
            state.position = next_state.pos
            state.velocity = next_state.vel
        else:
            state.position = state.position + state.velocity * dt
            speed = state.velocity.magnitude()
            if speed > 0:
                dir_vec = state.velocity.normalized()
                new_speed = speed - ROLL_FRICTION * dt
                if new_speed <= 0:
                    state.velocity = Vector3D(0, 0, 0)
                    break
                else:
                    state.velocity = dir_vec * new_speed

        # Check entry into goal mouth
        if not entered_goal_mouth and prev_z < 27.0 and state.position.z >= 27.0:
            fraction = (27.0 - prev_z) / (state.position.z - prev_z) if (state.position.z - prev_z) != 0 else 0
            cross_x = prev_x + (state.position.x - prev_x) * fraction
            cross_y = prev_y + (state.position.y - prev_y) * fraction
            
            if -3.66 <= cross_x <= 3.66 and cross_y <= 2.44:
                entered_goal_mouth = True

        # Goal Net Collision Detection
        if 27.0 < state.position.z < 35.0:
            if entered_goal_mouth:
                hit_net = False
                if state.position.z > 29.0 - 0.11:
                    state.position.z = 29.0 - 0.11
                    if state.velocity.z > 0: state.velocity.z = 0.0
                    hit_net = True
                if state.position.x < -3.66 + 0.11:
                    state.position.x = -3.66 + 0.11
                    if state.velocity.x < 0: state.velocity.x = 0.0
                    hit_net = True
                if state.position.x > 3.66 - 0.11:
                    state.position.x = 3.66 - 0.11
                    if state.velocity.x > 0: state.velocity.x = 0.0
                    hit_net = True
                if state.position.y > 2.44 - 0.11:
                    state.position.y = 2.44 - 0.11
                    if state.velocity.y > 0: state.velocity.y = 0.0
                    hit_net = True
                
                if hit_net:
                    state.velocity.x *= 0.1
                    state.velocity.y *= 0.1
                    state.velocity.z *= 0.1
                    state.angular_velocity = Vector3D(0, 0, 0)
            else:
                if (-3.66 - 0.11 < state.position.x < 3.66 + 0.11 and
                    state.position.y < 2.44 + 0.11 and state.position.z < 29.0 + 0.11):
                    
                    if state.position.y >= 2.44:
                        state.position.y = 2.44 + 0.11
                        if state.velocity.y < 0: state.velocity.y = -state.velocity.y * 0.3
                        state.velocity.z *= 0.8
                        state.velocity.x *= 0.8
                    elif state.position.x <= -3.66:
                        state.position.x = -3.66 - 0.11
                        if state.velocity.x > 0: state.velocity.x = -state.velocity.x * 0.3
                    elif state.position.x >= 3.66:
                        state.position.x = 3.66 + 0.11
                        if state.velocity.x < 0: state.velocity.x = -state.velocity.x * 0.3
                    elif state.position.z >= 29.0:
                        state.position.z = 29.0 + 0.11
                        if state.velocity.z < 0: state.velocity.z = -state.velocity.z * 0.3

        # Ground Collision Detection
        if state.position.y <= 0.11:
            state.position.y = 0.11
            if not is_rolling and state.velocity.y < 0:
                if state.velocity.y < -BOUNCE_THRESHOLD:
                    state.velocity.y = -state.velocity.y * COEFF_RESTITUTION
                    state.velocity.x *= KINETIC_FRICTION
                    state.velocity.z *= KINETIC_FRICTION
                    
                    surface_speed_z = state.angular_velocity.x * BALL_RADIUS
                    state.velocity.z += surface_speed_z * 0.2
                    surface_speed_x = -state.angular_velocity.z * BALL_RADIUS
                    state.velocity.x += surface_speed_x * 0.2
                    
                    state.angular_velocity = state.angular_velocity * 0.7
                else:
                    is_rolling = True
                    state.velocity.y = 0.0

        state.time += dt
        save_state(state)
        
        if state.time > 20.0:
            break

    return trajectory
