#include "physics.hpp"

// ============================================================
// FreeKick Earth — Physics Engine Implementation
//
// Forces modelled:
//   1. Gravity           — constant downward pull
//   2. Aerodynamic Drag  — F_d = ½ ρ v² C_d A  (opposes motion)
//   3. Magnus Effect     — F_M = C_m × (ω × v_rel) (curves the ball)
//
// Integration: Runge-Kutta 4th Order (RK4) for accuracy.
// ============================================================

using namespace PhysicsConstants;

// ---------------------------------------------------------------
// Force Calculations
// ---------------------------------------------------------------

/// Gravitational force (constant, downward along Y axis).
static Vector3D gravity_force() {
    return {0.0, -GRAVITY * BALL_MASS, 0.0};
}

/// Aerodynamic drag force.
/// Opposes the ball's motion relative to the wind.
/// F_d = -½ ρ |v_rel|² C_d A × v̂_rel
static Vector3D drag_force(const Vector3D& velocity,
                           const Vector3D& wind,
                           double air_density) {
    // Velocity of ball relative to the air mass
    Vector3D v_rel = velocity - wind;
    double speed = v_rel.magnitude();

    if (speed < 1e-12) return {0.0, 0.0, 0.0};

    // Drag magnitude: ½ ρ v² C_d A
    double drag_magnitude = 0.5 * air_density * speed * speed
                            * DRAG_COEFFICIENT * BALL_CROSS_SECTION;

    // Direction: opposite to relative velocity
    Vector3D drag_direction = v_rel.normalized() * -1.0;

    return drag_direction * drag_magnitude;
}

/// Magnus force (spin-induced lateral deflection).
/// F_M = C_m × (ω × v_rel)
/// The cross product naturally gives a force perpendicular to both
/// the spin axis and the velocity — exactly the curve direction.
static Vector3D magnus_force(const Vector3D& angular_velocity,
                             const Vector3D& velocity,
                             const Vector3D& wind,
                             double air_density) {
    Vector3D v_rel = velocity - wind;
    double speed = v_rel.magnitude();

    if (speed < 1e-12) return {0.0, 0.0, 0.0};

    // Cross product gives the curve direction
    Vector3D magnus_dir = cross(angular_velocity, v_rel);

    // Scale by the Magnus coefficient and ball geometry.
    // We include ½ ρ r A to make the coefficient physically meaningful
    // and to ensure density affects curve just like it affects drag.
    double scale = MAGNUS_COEFFICIENT * 0.5 * air_density
                   * BALL_RADIUS * BALL_CROSS_SECTION;

    return magnus_dir * scale;
}

// ---------------------------------------------------------------
// Compute total acceleration from all forces at a given state
// ---------------------------------------------------------------

struct SimState {
    Vector3D pos;
    Vector3D vel;
};

static Vector3D compute_acceleration(const Vector3D& vel,
                                     const Vector3D& angular_vel,
                                     const Environment& env) {
    Vector3D f_gravity = gravity_force();
    Vector3D f_drag    = drag_force(vel, env.wind_velocity, env.air_density);
    Vector3D f_magnus  = magnus_force(angular_vel, vel, env.wind_velocity,
                                      env.air_density);

    Vector3D total = f_gravity + f_drag + f_magnus;
    return total / BALL_MASS;
}

// ---------------------------------------------------------------
// RK4 Integration
// ---------------------------------------------------------------

/// Advance the simulation by one RK4 step of size dt.
/// Returns updated (position, velocity).
static SimState rk4_step(const SimState& s,
                         const Vector3D& angular_vel,
                         const Environment& env,
                         double dt) {
    // k1 — derivatives at the start of the interval
    Vector3D a1 = compute_acceleration(s.vel, angular_vel, env);
    Vector3D k1v = a1 * dt;          // Δv from k1
    Vector3D k1p = s.vel * dt;       // Δpos from k1

    // k2 — derivatives at the midpoint using k1
    Vector3D v2 = s.vel + k1v * 0.5;
    Vector3D a2 = compute_acceleration(v2, angular_vel, env);
    Vector3D k2v = a2 * dt;
    Vector3D k2p = v2 * dt;

    // k3 — derivatives at the midpoint using k2
    Vector3D v3 = s.vel + k2v * 0.5;
    Vector3D a3 = compute_acceleration(v3, angular_vel, env);
    Vector3D k3v = a3 * dt;
    Vector3D k3p = v3 * dt;

    // k4 — derivatives at the end using k3
    Vector3D v4 = s.vel + k3v;
    Vector3D a4 = compute_acceleration(v4, angular_vel, env);
    Vector3D k4v = a4 * dt;
    Vector3D k4p = v4 * dt;

    // Weighted average (RK4 formula)
    SimState next;
    next.vel = s.vel + (k1v + k2v * 2.0 + k3v * 2.0 + k4v) / 6.0;
    next.pos = s.pos + (k1p + k2p * 2.0 + k3p * 2.0 + k4p) / 6.0;

    return next;
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

std::vector<BallState> simulate_trajectory(const KickParams& kick,
                                           const Environment& env) {
    std::vector<BallState> trajectory;
    trajectory.reserve(1024);

    const double dt = TIMESTEP;

    // Initial state
    BallState state;
    state.position         = {0.0, 0.0, 0.0};  // kick taken at origin
    state.velocity         = kick.initial_velocity;
    state.angular_velocity = kick.initial_spin;
    state.time             = 0.0;

    trajectory.push_back(state);

    // Simulate until the ball hits the ground or we exceed a
    // safety limit (prevents infinite loops on edge cases).
    constexpr int MAX_FRAMES = 10000;  // ~160 seconds at 60 Hz

    for (int i = 0; i < MAX_FRAMES; ++i) {
        SimState current{state.position, state.velocity};

        // Advance physics one step
        SimState next = rk4_step(current, state.angular_velocity, env, dt);

        state.position = next.pos;
        state.velocity = next.vel;
        state.time    += dt;
        // Angular velocity stays constant (no spin decay for simplicity)

        trajectory.push_back(state);

        // Stop when ball hits the ground (after at least one frame of flight)
        if (state.position.y < 0.0 && i > 0) {
            // Clamp Y to ground level on the final frame
            state.position.y = 0.0;
            trajectory.back().position.y = 0.0;
            break;
        }
    }

    return trajectory;
}
