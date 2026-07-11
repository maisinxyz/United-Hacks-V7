# **Product Requirements Document: FreeKick Earth**

**"Master the environment before you master the ball."**

## **1. Executive Summary & Core Concept**

FreeKick Earth is an educational sports strategy game where players travel around the world taking free kicks in famous football stadiums. Unlike traditional sports games that test twitch reflexes, this game acts as a physics puzzle. The exact same free kick can score in Vancouver but miss entirely in Mexico City due to thinner air.

Players configure parameters (aim, power, launch angle, spin) based on real-world environmental data (altitude, temperature, humidity, wind) and learn how the environment changes the physics of the ball through immediate, simulated feedback.

---

## **2. Architecture & Tech Stack Strategy**

To balance performance (physics calculations) with rapid prototyping (hackathon constraints), the architecture relies on a hybrid stack.

* **C++ (The Physics Core):** The heavy lifting of the ballistics model, aerodynamics, and vector math will be written in C++. It will be exposed to the Python backend via bindings (`pybind11`).
* **Python (The Data Layer & API):** A FastAPI backend that handles simulation requests and integrates with live weather APIs (e.g., OpenWeatherMap) to fetch real-time altitude, temperature, humidity, and wind data.
* **TypeScript (The Frontend & Simulation UI):** A web-based 3D environment built with React, Three.js, and `@react-three/fiber`. It handles user inputs, the "Preparation Phase" UI, and renders the 3D post-kick analysis.

---

## **3. Core Physics Requirements (C++ Engine)**

The C++ simulation engine must calculate the ball's position at a fixed timestep (e.g., 0.016s for 60Hz). It must implement the following physical models:

**Air Density Equation:**
Calculated from temperature, pressure, and humidity to determine air resistance.


$$\rho = \frac{p}{R_{specific} T}$$

**Aerodynamic Drag:**
The force slowing the ball down, highly dependent on the air density ($\rho$) of the specific city.


$$F_{d} = \frac{1}{2} \rho v^{2} C_{d} A$$

**Magnus Effect (Spin/Curve):**
The force that causes a spinning football to curve. The cross product of the angular velocity vector ($\vec{\omega}$) and the velocity vector ($\vec{v}$) dictates the direction of the curve.


$$\vec{F}_{M} = S (\vec{\omega} \times \vec{v})$$

---

## **4. Extensive Implementation Guide (Hackathon Timeline)**

### **Phase 1: Architecture Setup & Scaffolding (Hours 1–3)**

**1. Initialize the Monorepo**

* Create a root folder: `mkdir freekick-earth && cd freekick-earth`
* Initialize Git: `git init`
* Create three main directories: `cpp-engine`, `python-api`, and `ts-frontend`.

**2. Setup the C++ Environment**

* Navigate to `cpp-engine`.
* Create a `CMakeLists.txt` file configured to compile a shared library using **pybind11** so Python can import the C++ engine natively.
* Install `pybind11` (via pip or Git submodule).
* Create the source directory: `mkdir src` and `touch src/physics.cpp src/physics.hpp src/bindings.cpp`.

**3. Setup the Python Backend**

* Navigate to `python-api`.
* Initialize a virtual environment: `python -m venv venv` and activate it.
* Install dependencies: `pip install fastapi uvicorn pydantic requests httpx`.
* Create the main application file: `touch main.py`.

**4. Setup the TypeScript Frontend**

* Navigate to `ts-frontend`.
* Initialize a Vite project: `npm create vite@latest . -- --template react-ts`.
* Install 3D and UI libraries: `npm install three @react-three/fiber @react-three/drei axios tailwindcss`.
* Configure Tailwind CSS for rapid UI styling.

### **Phase 2: The C++ Physics Engine (Hours 4–12)**

**1. Define the Data Structures (`physics.hpp`)**

* Create a `Vector3D` struct with `x`, `y`, `z` properties and overload basic math operators.
* Create a `BallState` struct to track a specific frame (`position`, `velocity`, `angular_velocity`, `time`).
* Create an `Environment` struct (`air_density`, `wind_velocity`).
* Create a `KickParams` struct (`initial_velocity`, `initial_spin`).

**2. Implement the Physics Constants**

* Define FIFA match ball specs: Mass ($m = 0.43$ kg), Radius ($r = 0.11$ m), Cross-sectional Area ($A = 0.038$ m²).
* Define base coefficients: Drag coefficient ($C_d \approx 0.2$ to $0.4$) and Magnus coefficient ($C_m$).

**3. Write the Force Functions (`physics.cpp`)**

* **Gravity:** Returns `{0.0, -9.81, 0.0}`.
* **Drag Force:** Calculate relative velocity (`v_rel = ball.velocity - env.wind_velocity`). Calculate magnitude using the density formula, applying force in the opposite direction of `v_rel`.
* **Magnus Force:** Calculate the cross product of angular velocity and relative velocity (`cross_product(ball.angular_velocity, v_rel)`).

**4. Build the Integration Loop**

* Create function: `std::vector<BallState> simulate_trajectory(KickParams kick, Environment env)`.
* Set timestep constraint: `float dt = 0.016f;`.
* Implement a **Runge-Kutta 4th Order (RK4)** integration loop to prevent drift.
* Calculate acceleration: `a = (F_gravity + F_drag + F_magnus) / mass`.
* Update velocity and position.


* Break the loop when `position.y < 0` (ball hits the ground).

**5. Create the Pybind11 Bindings (`bindings.cpp`)**

* Use `PYBIND11_MODULE` to expose C++ structs as Python classes.
* Expose `simulate_trajectory`. Compile the library via CMake to output `physics_engine.so`.

### **Phase 3: Python Backend & Data Integration (Hours 13–17)**

**1. Build the Stadium Database**

* Create `stadiums.json` with entries for 2026 World Cup stadiums (fields: `id`, `name`, `city`, `lat`, `lon`, `altitude_meters`).

**2. Integrate the Weather API**

* Create `weather.py`. Use `httpx` to ping OpenWeatherMap using the stadium's coordinates.
* Extract: `temperature_celsius`, `pressure_hpa`, `humidity_percent`, `wind_speed_m_s`, `wind_deg`.

**3. Calculate Air Density**

* Translate raw weather into an air density float ($\rho$ in kg/m³) using the ideal gas law with humidity correction before passing to C++.

**4. Build the FastAPI Endpoints (`main.py`)**

* `GET /stadiums`: Returns available stadiums.
* `GET /stadium/{id}/conditions`: Fetches live weather, merges with static altitude, returns payload.
* `POST /simulate`:
* **Input:** Receives `KickParams` and `StadiumID`.
* **Logic:** Fetches density/wind. Calls C++ module: `trajectory = physics_engine.simulate_trajectory(kick, env)`.
* **Output:** Maps the C++ `std::vector<BallState>` into a JSON array of `[x, y, z]` coordinates and returns it.



### **Phase 4: TypeScript Frontend & 3D Simulation (Hours 18–22)**

**1. Build the Preparation UI**

* **Stadium Selector:** Dropdown to trigger `/stadium/{id}/conditions`.
* **Environment Dashboard:** Displays Altitude, Temp, Humidity, and an "Air Density Indicator".
* **Kick Controls:** Sliders for Power, Horizontal Angle, Vertical Pitch, Spin Rate, and Spin Axis.
* **Simulate Button:** Triggers the POST request to `/simulate`.

**2. Setup the 3D Scene (@react-three/fiber)**

* Set up `<Canvas>`, `<PerspectiveCamera>`, and `<OrbitControls>`.
* Build the pitch (textured `<Plane>`), goalposts (simple cylinders 27 meters away), and the ball (`<Sphere>`).

**3. Animate the Trajectory**

* Store the returned `[x, y, z]` array in React state.
* Use Drei's `<Line>` to draw a glowing path instantly.
* Use a `useFrame` hook to animate the ball mesh moving frame-by-frame along the coordinate array.

### **Phase 5: Educational Analysis & Polish (Hours 23–24)**

**1. Implement the "Ghost" Trajectory**

* Run the C++ simulation *twice* on the backend: once with actual stadium conditions, once with baseline conditions (sea level, 15°C, zero wind).
* Render the baseline trajectory as a semi-transparent white line alongside the actual trajectory to visually prove the environmental impact.

**2. Generate Post-Kick Insights**

* Compare the final resting coordinates of both lines in the frontend.
* Trigger UI popups explaining the delta (e.g., *"At Mexico City's altitude, lower air density reduced aerodynamic drag, causing your shot to sail 0.8m over the crossbar."*).

---

## **5. Benchmarks & Success Metrics**

| Benchmark Category | Target Metric | Hackathon Standard |
| --- | --- | --- |
| **Physics Accuracy** | Simulation execution time | **< 50ms** per full kick trajectory |
| **Data Integration** | Weather API fetch time | **< 500ms** latency on Python backend |
| **Visual Smoothness** | Frontend rendering frame rate | **60 FPS** during ball flight animation |
| **Game Loop Speed** | Time to complete one full turn | **< 45 seconds** from UI to final replay |
| **Educational Impact** | Analysis delivery | **100%** of missed shots provide a physics-based reason |

---

## **6. Strategy & Presentation Tips for Judges**

* **Focus on the Delta:** The most impressive visual is the *exact same kick parameters* resulting in two completely different trajectories in two different stadiums. Make this the centerpiece of the live demo.
* **Keep Graphics Minimalist:** Do not waste time modeling complex 3D stadiums. A clean, wireframe, or low-poly aesthetic keeps the focus on the data, the backend, and the C++ engine.
* **The "What-If" Feature:** If time permits, build a real-time slider that lets users manually override the air density or wind speed mid-flight to instantly see the trajectory warp.
