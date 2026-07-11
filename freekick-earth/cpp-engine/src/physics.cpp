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
    trajectory.reserve(2000); // Increased for longer rolling

    const double dt = TIMESTEP;

    BallState state;
    state.position         = {0.0, 0.111, 0.0};  // Kick taken at origin, y = 0.111 (just above ground radius)
    state.velocity         = kick.initial_velocity;
    state.angular_velocity = kick.initial_spin;
    state.time             = 0.0;

    trajectory.push_back(state);

    constexpr int MAX_FRAMES = 20000;
    
    // Physical constants for bouncing/rolling
    const double COEFF_RESTITUTION = 0.65; // Retained vertical speed
    const double KINETIC_FRICTION = 0.85; // Retained horizontal speed on bounce
    const double ROLL_FRICTION = 3.0; // Deceleration in m/s^2
    const double BOUNCE_THRESHOLD = 0.5; // Minimum v_y to bounce

    // State machine
    bool is_rolling = false;
    bool entered_goal_mouth = false;

    for (int i = 0; i < MAX_FRAMES; ++i) {
        double prev_z = state.position.z;
        double prev_y = state.position.y;
        double prev_x = state.position.x;
        if (!is_rolling) {
            // Airborne physics
            SimState current{state.position, state.velocity};
            SimState next = rk4_step(current, state.angular_velocity, env, dt);
            
            state.position = next.pos;
            state.velocity = next.vel;
        } else {
            // Rolling physics (on ground)
            state.position = state.position + state.velocity * dt;
            
            // Apply rolling friction
            double speed = state.velocity.magnitude();
            if (speed > 0) {
                Vector3D dir = state.velocity.normalized();
                double new_speed = speed - ROLL_FRICTION * dt;
                if (new_speed <= 0) {
                    state.velocity = {0.0, 0.0, 0.0};
                    break; // Ball has completely stopped
                } else {
                    state.velocity = dir * new_speed;
                }
            }
        }

        // Check entry into goal mouth
        if (!entered_goal_mouth && prev_z < 27.0 && state.position.z >= 27.0) {
            double fraction = (27.0 - prev_z) / (state.position.z - prev_z);
            double cross_x = prev_x + (state.position.x - prev_x) * fraction;
            double cross_y = prev_y + (state.position.y - prev_y) * fraction;
            
            if (cross_x >= -3.66 && cross_x <= 3.66 && cross_y <= 2.44) {
                entered_goal_mouth = true;
            }
        }

        // Goal Net Collision Detection
        // Goal mouth is Z=27. Back net is Z=29. Left/Right = +/- 3.66. Top = 2.44.
        if (state.position.z > 27.0 && state.position.z < 35.0) {
            if (entered_goal_mouth) {
                // Ball is INSIDE the net
                bool hit_net = false;
                
                // Back net
                if (state.position.z > 29.0 - 0.11) {
                    state.position.z = 29.0 - 0.11;
                    if (state.velocity.z > 0) state.velocity.z = 0.0;
                    hit_net = true;
                }
                // Left net
                if (state.position.x < -3.66 + 0.11) {
                    state.position.x = -3.66 + 0.11;
                    if (state.velocity.x < 0) state.velocity.x = 0.0;
                    hit_net = true;
                }
                // Right net
                if (state.position.x > 3.66 - 0.11) {
                    state.position.x = 3.66 - 0.11;
                    if (state.velocity.x > 0) state.velocity.x = 0.0;
                    hit_net = true;
                }
                // Top net
                if (state.position.y > 2.44 - 0.11) {
                    state.position.y = 2.44 - 0.11;
                    if (state.velocity.y > 0) state.velocity.y = 0.0;
                    hit_net = true;
                }
                
                if (hit_net) {
                    // Net absorbs speed completely so it just drops
                    state.velocity.x *= 0.1;
                    state.velocity.y *= 0.1;
                    state.velocity.z *= 0.1;
                    state.angular_velocity = {0, 0, 0};
                }
            } else {
                // Ball is OUTSIDE the net. Keep it outside.
                // Check if it collides with the outer bounding box of the net
                if (state.position.x > -3.66 - 0.11 && state.position.x < 3.66 + 0.11 &&
                    state.position.y < 2.44 + 0.11 && state.position.z < 29.0 + 0.11) {
                    
                    // Simple outward push based on which face it most likely hit
                    if (state.position.y >= 2.44) {
                        state.position.y = 2.44 + 0.11;
                        if (state.velocity.y < 0) state.velocity.y = -state.velocity.y * 0.3; // bounce off roof
                        state.velocity.z *= 0.8; // friction
                        state.velocity.x *= 0.8;
                    } else if (state.position.x <= -3.66) {
                        state.position.x = -3.66 - 0.11;
                        if (state.velocity.x > 0) state.velocity.x = -state.velocity.x * 0.3;
                    } else if (state.position.x >= 3.66) {
                        state.position.x = 3.66 + 0.11;
                        if (state.velocity.x < 0) state.velocity.x = -state.velocity.x * 0.3;
                    } else if (state.position.z >= 29.0) {
                        state.position.z = 29.0 + 0.11;
                        if (state.velocity.z < 0) state.velocity.z = -state.velocity.z * 0.3;
                    }
                }
            }
        }

        // Ground Collision Detection
        if (state.position.y <= 0.11) { // 0.11 is the ball radius
            state.position.y = 0.11;
            
            if (!is_rolling && state.velocity.y < 0) { // Only collide if falling!
                if (state.velocity.y < -BOUNCE_THRESHOLD) {
                    // BOUNCE
                    state.velocity.y = -state.velocity.y * COEFF_RESTITUTION;
                    
                    // Horizontal friction
                    state.velocity.x *= KINETIC_FRICTION;
                    state.velocity.z *= KINETIC_FRICTION;
                    
                    // Simple Spin interaction (Topspin +X accelerates Z, Backspin -X decelerates Z)
                    // Angular velocity is rad/s. A spin of 10 rad/s * 0.11m = 1.1 m/s surface speed
                    double surface_speed_z = state.angular_velocity.x * BALL_RADIUS;
                    // Transfer some of this spin surface speed into linear velocity
                    state.velocity.z += surface_speed_z * 0.2;
                    
                    double surface_speed_x = -state.angular_velocity.z * BALL_RADIUS;
                    state.velocity.x += surface_speed_x * 0.2;
                    
                    // Decay spin on bounce
                    state.angular_velocity = state.angular_velocity * 0.7;
                    
                } else {
                    // START ROLLING
                    is_rolling = true;
                    state.velocity.y = 0.0;
                }
            }
        }

        state.time += dt;
        
        // Add to trajectory (every N frames if we want to save space, but UI handles all)
        trajectory.push_back(state);
        
        // Failsafe exit
        if (state.time > 20.0) break;
    }

    return trajectory;
}
