# Six single-transistor projects

Each project uses exactly one transistor, a 3 V pack and ordinary passive parts.
They appear in the NPN only and PNP only library tabs and in all showcases.
Construction uses rigid snap strips wherever the body-aware router can keep
parts visible, with insulated cables for the remaining paths.

| Collection | Project | Useful behavior |
| --- | --- | --- |
| NPN | Night Watch | A photoresistor turns an LED on in darkness. |
| NPN | Porch Timer | A button charges a capacitor; the light fades after release. |
| NPN | Desk Fan | A dial controls motor current through an NPN low-side switch. |
| PNP | Sunrise Beacon | A photoresistor turns an LED on in daylight. |
| PNP | Courtesy Light | A complementary capacitor circuit gives a short afterglow. |
| PNP | Breeze Dial | A dial controls motor current through a PNP high-side switch. |

The NPN emitter returns to minus; the PNP emitter connects to the switched
positive supply. The LED has its own 100 Ω protective resistor. The fan has a
flyback diode across the motor, a 1 kΩ base resistor, and a 10 kΩ base/emitter
resistor. The timer uses a 470 µF capacitor, 1 kΩ charging resistor, 10 kΩ base
resistor and 5.1 kΩ discharge resistor. Its capacitor polarity is reversed in
the PNP arrangement so its marked plus remains at the higher potential.

These are original functional circuits, not copies of manufacturer diagrams.
The manufacturer naming presets identify equivalent parts and terminals; actual
body geometry, sensor thresholds, motor loading, gain and timing remain estimated.
Consult the supplied parts/terminal guide and a kit's own manual when comparing
with real parts. Some kits may need additional resistors or connecting strips.

Validation covers all six layouts and their electrical results in the actual
WebAssembly engine: repeated day/night transitions, master switch operation,
charging and discharging twice, adjustable fan speed and unpowered coasting.
Browser tests open both collections and operate their real on-board controls.
No program or presentation effect substitutes for transistor behavior.
