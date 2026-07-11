cmake_minimum_required(VERSION 3.16)
project(freekick_physics LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Find pybind11 (installed via pip)
find_package(pybind11 REQUIRED)

# Build the shared Python extension module
pybind11_add_module(physics_engine
    src/bindings.cpp
    src/physics.cpp
)

target_include_directories(physics_engine PRIVATE src)
