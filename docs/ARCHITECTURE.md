# Architecture and model contracts

The website imports no remote runtime libraries. React handles authoring; Three
renders original geometric parts; a dedicated module Worker owns the Emscripten
electrical engine and Rapier world. A static HTTP/CDN origin serves bytes only.
No cross-origin-isolation headers, SharedArrayBuffer, backend API, login, serial
device or remote compilation service is required.

## Electrical foundation

The matrix solver and primitive element equations come from SimulIDE at
`4bf26bc839147551a00938aa2949012681a3e046`. The extraction scripts and per-file
original/modified SHA-256 records are in `tools` and `provenance`. Custom models
stamp branches into that solver; TypeScript never assigns a lamp brightness or
motor speed in place of solving a circuit.

An engine context owns its nodes, pins, elements, matrix and MCU instances. Each
PIC owns its cycle counter and breakpoints; an RAII thread-local scope routes the
legacy emulator interfaces to that context. Separate contexts may be interleaved.
An individual context must be called serially. Pin sequence numbers fix the
order of floating-point accumulation. Nonlinear relaxation is deterministic.

The default electrical step is 10 microseconds. `ws_advance` is bounded at 10,000
steps per call; nonlinear iteration at 512. Numeric parameters must be finite,
and physical scales such as resistance, capacitance and thermal mass positive.
Singular/non-converging systems stop with a diagnostic. The C ABI retains the
last successfully published batch of observations; failed replacement loads
leave the prior observations available. It never substitutes an invented LU
pivot. Floating nets have an **explicit modelled 1 teraohm leakage** to reference.

Rapier receives motor torque every 1 millisecond of physical time and returns
angular velocity for the next interval. Render frames cannot advance physical
time. Heavy workloads slow down and report simulated time rather than skipping
steps. Software browser tests are not a hardware performance certification.

## Model assumptions

| Model | Equations/behavior | Current limitations |
| --- | --- | --- |
| Battery | Thevenin voltage and internal resistance; I²R heating; protection | Generic estimates; no chemistry/discharge curve |
| Lamp | Tungsten-like R(T); electrical heating and T⁴ radiation; open failure | Thermal mass and emissivity calibrated only as educational estimates |
| DC motor | V = IR + L dI/dt + kω; torque = kI; inertia and friction; copper heating | Generic constants; no brush commutation or magnetic saturation |
| Semiconductor | Imported junction/BJT loading; thermal/current stress; open failure | Simplified original models; failure mode is an explicit choice |
| Reactive element | Imported backward-Euler capacitor/inductor | Ideal stored energy is not treated as heat; external ESR models loss |
| MCU | Real instructions and timers; supply-dependent GPIO impedance | Verified profiles only; approximate supply/pin limits, no analogue silicon model |
| Microphone/speaker | Input-dependent resistance / electrical load | Acoustic waveform and enclosure models not complete |
| Mechanical load | Rapier rotor plus attached mass; blocking/external torque | No complete catalogue mechanism or gear/belt constraints yet |

Lamp visible brightness uses a Planck-radiance approximation near 550 nm,
normalized at 2673 K; residual infrared heat does not become visible glow.
The L1/L2 filament heat capacities are estimated at 20/30 microjoules per kelvin,
respectively, not measured Elenco specifications. VCC's
[incandescent application information](https://vcclite.com/incandescent-lamp-application-information/)
describes the temperature-dependent visible spectrum and short inrush transient.
The six-volt fixture drops below 1% visible brightness within 0.1 simulated
seconds after opening the circuit. Rendering uses this brightness directly,
without a square-root boost that would exaggerate the cooling tail.

Normal projects start running after startup preparation. Manual Pause remains
available; invalid construction and Guided protection stop operation. Virtual
Breakage Lab templates retain their explicit paused opening. Moving a component
disengages external snaps on lift; cancellation reconnects its original position.
Flexible wires and snaps within a moving assembly remain attached.
Selecting a flexible cable exposes two endpoint handles. Dragging one sends a
worker `detach` command naming only that cable, with no lifted components. A
valid drop changes one connection and reloads the topology preserving physical
state; cancellation removes the temporary detachment. Optional endpoint `snap`
indices identify individual metal snaps sharing one terminal, while electrical
net identity remains `(part, terminal)`. This is an additive document-v2 field;
older endpoints without it still use their terminal's default snap.
Dropping, deleting, undoing, rotating or adding a wire updates the running circuit.
The optional `preserveState` field on `ws_load` leaves C ABI 1 unchanged and
transactionally rebuilds the network while retaining time, heat, damage,
protection, reactive histories, rotor motion and matching MCU execution state.
Changed model parameters create a fresh physical model for that part. Rewiring
does not restart firmware. Controls settle electrical observations immediately;
the worker's mechanical feedback settles on its next fixed physical step.

Failure is a change to the circuit (open connections), not a visual effect.
Turning the power off or resetting preserves failed state, temperature and
stress. Repair explicitly replaces a virtual part. Project persistence merges
observed damage before edits or exports. Guided mode intervenes at an estimated
threshold before failure; the preceding physics is identical in both modes.

## Programming

Blockly workspace JSON compiles to a typed intermediate representation and a
bounded bytecode program (4096 bytes, 32 stack entries, 16 variable slots). AVR
programs are stored at byte address `0x6000`; PIC bytecodes in RETLW words at
word address `0x1000`. The prebuilt runtimes are compiled with AVR GCC and gpasm
inside Docker and packaged locally with the bytecode as Intel HEX. Compiler
output runs inside simavr/gpsim. Every exposed block compiles for both profiles;
unsupported pin selections produce a compile diagnostic. Arithmetic is unsigned
8-bit, with division by zero a runtime fault. Physical waits use MCU timers.

## Versioned boundaries

`engine/include/wiresnaps.h` defines C ABI version 1 with opaque context handles.
UTF-8 JSON inputs are copied during each call. `ws_snapshot` returns borrowed
memory valid until the next snapshot on that handle; copy it before another
call. Dispose with `ws_destroy`. No pointer is shared between workers.

`src/types.ts` defines project schema 2, catalogue version `2026-09-27.1` and
worker protocol 2. Schema 1 documents migrate without moving their components.
Workers return project identity, load generation, revision IDs, timestamps, events, diagnostics
and a transferable Float64Array (voltage, current, temperature, angular velocity
per part). Electrical terminals and mechanical attachment IDs are distinct.
Adjacent compatible snap positions or explicit wires create electrical nets;
visual overlap does not. Mechanical connections do not join electrical nets.

## Workbench and saved projects

`component-design.ts` supplies compound body primitives to rendering and
construction checks, including battery cells, bulbs, housings and rotor sweep
clearance. Quarter-turn primitive envelopes are deliberately conservative. The
rounded plastic outline and bevel lie within these envelopes. A matching snap
may contact an adjacent base; a body's overlap is never an electrical connection.
Invalid old layouts are preserved, outlined and prevented from running. Attached
axle assemblies move together. Flexible wires use overhead clearance routes.
Exact measured CAD, arbitrary orientations and all mechanical mechanisms remain
outside this milestone.

Manufacturer identity lives separately in `manufacturer-mappings.ts`. Snap
Circuits sources include manual-page references; Znatok numbers cite the 999
manual's component table. Current matches are functional equivalents, **not
verified physical construction matches**. The default is original WireSnaps
naming. Dark Night now removes ambient sunlight from the physical environment,
so solar cells and photoresistors respond as well as the renderer. The saved
`environment.light` retains the daytime setting; `simulationEnvironment` maps it
to zero while `presentation.night` is true. Worker `control.night` changes this
live, including while paused, without reloading or restarting the circuit.
Environment edits and topology reloads use the same mapping. Naming and graphics
quality remain presentation settings.

Choosing a library part or selecting/placing a board component shows up to four
authored "Try next" candidates. Local rules consider the focused component,
present healthy parts, supply voltage and mechanical companions. Existing parts
are ranked lower; a higher supply selects a larger LED resistor, and controllers
recommend their 5 V supply. Suggestions are building ideas rather than a wiring
or hardware-safety verdict. Clicking a candidate enters normal placement with
unchanged construction checks. Explanations are externalized in
`src/i18n/next-parts.en.ts` and available on hover, focus and touch; they need no
backend. Suggestions clear with selection/project changes and are not saved as
circuit state.

IndexedDB `wiresnaps`, database version 1, has `projects` and `settings` stores.
Project documents retain code, firmware, lesson progress, presentation settings
and measured damage. Saves atomically compare the stored version; concurrent
edits create a separate conflict copy. Opening a saved document does not itself
overwrite it. Momentary switches restore released. Legacy localStorage is copied
once in a transaction and retained as a recovery backup. Project changes pause
and flush saves before switching; undo and worker load generations are isolated.

Nineteen regular lessons and four virtual breakage labs are built to local JSON
templates in Docker. The two controller templates include matching editable
workspaces and packaged AVR/PIC firmware. `snap-routing.ts` replaces authored
flexible connections with rigid snap routes only when both body clearance and
the original circuit connectivity are preserved. Remaining flexible connections
are explicit and follow body-aware orthogonal cable paths. Template snap routing
happens during packaging; the Auto wire tool also supports individual point-to-point
edits. Rigid connectors retain their electrical resistance. Wire traces stop at
component terminals. See CLEAR_WIRING.md for routing, gear constraints and evidence.

The BJT retains upstream gain, saturation and Early-effect equations, using a
deterministic three-terminal Norton Jacobian to converge with resistive emitter
leads. AVR input feedback does not overwrite an output latch or peripheral PWM.
Power restart preserves current controls, safety mode and accumulated damage.
Failure/intervention events include physical timestamps without changing C ABI 1.

Auto rendering starts cheaply, tries ambient occlusion, bloom and restrained
depth of field only after steady frames, and reduces effects after slow frames.
Top view, wiring, placement, dragging and exploded layers disable blur. Rendering
pauses behind the block editor; simulation cadence remains unchanged. High and
Low are explicit overrides. All effects and procedural assets ship locally.
Low uses a smaller drawing buffer. The fixed studio shadow is cached until a
part or rotor moves; cached observations are not reapplied on every display frame.

Before revealing the board, Three's `compileAsync` prepares all supported
material variants with zero through eight spill lights, for the direct and
postprocessed render targets. Tiny offscreen renders also prepare shadow, SSAO,
bloom, depth-of-field and output passes. Retained probe materials keep these
programs cached across deletion and project changes; a bounded pool of eight
point lights prevents unbounded shader variants. Browser tests instrument
WebGL program linking and require no new links during light-count, naming,
quality, day/night, selection and placement changes after startup.

Browser reports include day/night screenshots and `render-and-input.json`
attachments at 1440×1000 in Docker software WebGL. They record actual FPS and
time to two frames after an input; 60 FPS and less than 100 ms remain performance
targets, not a claim of certification on every computer.
The documented software-rendering reference is Docker Desktop 29.5.3 on an AMD
Ryzen 9 5900HX, with 16 logical CPUs and 12,540,604,416 bytes available to Docker,
using the pinned Playwright image and a 1440×1000 viewport. Frame measurements
warm up for 30 frames after changing quality, then sample 30 fresh intervals.
This environment does not expose a hardware-accelerated graphics device.

See `STATUS.md` for the remaining work needed for the full specification.
