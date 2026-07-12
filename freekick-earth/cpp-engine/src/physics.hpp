#pragma once

#include <vector>
#include <cmath>

// ============================================================
// FreeKick Earth — Physics Engine Header
// Data structures and function declarations for the ballistics
// simulation. Implementation lives in physics.cpp.
// ============================================================

// --- Vector Math ---

struct Vector3D {
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;

    Vector3D() = default;
    Vector3D(double x, double y, double z) : x(x), y(y), z(z) {}

    Vector3D operator+(const Vector3D& o) const { return {x + o.x, y + o.y, z + o.z}; }
    Vector3D operator-(const Vector3D& o) const { return {x - o.x, y - o.y, z - o.z}; }
    Vector3D operator*(double s) const { return {x * s, y * s, z * s}; }
    Vector3D operator/(double s) const { return {x / s, y / s, z / s}; }

    double magnitude() const { return std::sqrt(x * x + y * y + z * z); }

    Vector3D normalized() const {
        double m = magnitude();
        if (m < 1e-12) return {0.0, 0.0, 0.0};
        return {x / m, y / m, z / m};
    }
};

inline Vector3D cross(const Vector3D& a, const Vector3D& b) {
    return {
        a.y * b.z - a.z * b.y,
        a.z * b.x - a.x * b.z,
        a.x * b.y - a.y * b.x
    };
}

inline double dot(const Vector3D& a, const Vector3D& b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

// --- Simulation Data ---

struct BallState {
    Vector3D position;
    Vector3D velocity;
    Vector3D angular_velocity;
    double time = 0.0;
};

struct Environment {
    double air_density;        // kg/m³  (sea-level ≈ 1.225)
    Vector3D wind_velocity;    // m/s
    double gravity = 9.81;     // m/s²   (defaults to sea-level gravity)
};

struct KickParams {
    Vector3D initial_velocity;  // m/s — direction + magnitude
    Vector3D initial_spin;      // rad/s — angular velocity vector
};

// --- Constants (FIFA match ball) ---

namespace PhysicsConstants {
    constexpr double BALL_MASS            = 0.43;    // kg
    constexpr double BALL_RADIUS          = 0.11;    // m
    constexpr double BALL_CROSS_SECTION   = 0.038;   // m²
    constexpr double DRAG_COEFFICIENT     = 0.25;    // C_d (smooth-ish ball)
    constexpr double MAGNUS_COEFFICIENT   = 0.5;     // C_m (tunable)
    constexpr double GRAVITY              = 9.81;    // m/s²
    constexpr double TIMESTEP             = 0.016;   // s  (~60 Hz)
}

// --- Public API ---

/// Run the full ballistic simulation and return every frame.
std::vector<BallState> simulate_trajectory(const KickParams& kick,
                                           const Environment& env);
