#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include "physics.hpp"

// ============================================================
// Pybind11 bindings — exposes the C++ physics engine to Python
// so FastAPI can call simulate_trajectory() natively.
// ============================================================

namespace py = pybind11;

PYBIND11_MODULE(physics_engine, m) {
    m.doc() = "FreeKick Earth physics engine (C++ core)";

    // Vector3D
    py::class_<Vector3D>(m, "Vector3D")
        .def(py::init<>())
        .def(py::init<double, double, double>())
        .def_readwrite("x", &Vector3D::x)
        .def_readwrite("y", &Vector3D::y)
        .def_readwrite("z", &Vector3D::z)
        .def("magnitude", &Vector3D::magnitude)
        .def("__repr__", [](const Vector3D& v) {
            return "Vector3D(" + std::to_string(v.x) + ", "
                               + std::to_string(v.y) + ", "
                               + std::to_string(v.z) + ")";
        });

    // BallState
    py::class_<BallState>(m, "BallState")
        .def(py::init<>())
        .def_readwrite("position",         &BallState::position)
        .def_readwrite("velocity",         &BallState::velocity)
        .def_readwrite("angular_velocity", &BallState::angular_velocity)
        .def_readwrite("time",             &BallState::time);

    // Environment
    py::class_<Environment>(m, "Environment")
        .def(py::init<>())
        .def_readwrite("air_density",    &Environment::air_density)
        .def_readwrite("wind_velocity",  &Environment::wind_velocity);

    // KickParams
    py::class_<KickParams>(m, "KickParams")
        .def(py::init<>())
        .def_readwrite("initial_velocity", &KickParams::initial_velocity)
        .def_readwrite("initial_spin",     &KickParams::initial_spin);

    // Main simulation function
    m.def("simulate_trajectory", &simulate_trajectory,
          py::arg("kick"), py::arg("env"),
          "Run full ballistic simulation, returns list of BallState frames.");
}
