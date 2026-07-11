#include "physics.hpp"

// ============================================================
// FreeKick Earth — Physics Engine Implementation
// Placeholder — full force model + RK4 integration will be
// implemented in Phase 2.
// ============================================================

using namespace PhysicsConstants;

// --- Force helpers (stubs for Phase 2) ---

static Vector3D gravity_force() {
    return {0.0, -GRAVITY * BALL_MASS, 0.0};
}

static Vector3D drag_force(const Vector3D& velocity,
                           const Vector3D& wind,
                           double air_density) {
    // TODO: Phase 2 — full drag implementation
    (void)velocity; (void)wind; (void)air_density;
    return {0.0, 0.0, 0.0};
}

static Vector3D magnus_force(const Vector3D& angular_velocity,
                             const Vector3D& velocity,
                             const Vector3D& wind) {
    // TODO: Phase 2 — full Magnus implementation
    (void)angular_velocity; (void)velocity; (void)wind;
    return {0.0, 0.0, 0.0};
}

// --- Simulation entry point (stub) ---

std::vector<BallState> simulate_trajectory(const KickParams& kick,
                                           const Environment& env) {
    std::vector<BallState> trajectory;

    BallState state;
    state.position         = {0.0, 0.0, 0.0};
    state.velocity         = kick.initial_velocity;
    state.angular_velocity = kick.initial_spin;
    state.time             = 0.0;

    trajectory.push_back(state);

    // TODO: Phase 2 — RK4 integration loop
    // For now, simple Euler stub so the pipeline compiles end-to-end.
    const double dt = TIMESTEP;
    for (int i = 0; i < 10000; ++i) {
        Vector3D f_gravity = gravity_force();
        Vector3D f_drag    = drag_force(state.velocity, env.wind_velocity, env.air_density);
        Vector3D f_magnus  = magnus_force(state.angular_velocity, state.velocity, env.wind_velocity);

        Vector3D total_force = f_gravity + f_drag + f_magnus;
        Vector3D acceleration = total_force / BALL_MASS;

        state.velocity = state.velocity + acceleration * dt;
        state.position = state.position + state.velocity * dt;
        state.time += dt;

        trajectory.push_back(state);

        // Stop when ball hits the ground
        if (state.position.y < 0.0 && i > 0) break;
    }

    return trajectory;
}
