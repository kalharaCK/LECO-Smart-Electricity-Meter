# Meter firmware foundation

This directory contains a portable C++ firmware core for the LECO smart meter
project. The controller was described as “Newton”, but that name does not
identify a specific MCU or development board. The core therefore avoids
vendor-specific registers, pin numbers, and SDK calls.

## Structure

- `include/meter/` defines the sensor, transport, clock, and reading contracts.
- `src/` implements input validation and the sampling/publishing loop.
- `CMakeLists.txt` builds the portable core as a C++17 library.

To connect a physical device, implement `MeterSensor`, `TelemetryTransport`,
and `Clock` for the selected board and connect those implementations to the
firmware loop. Board startup, sensor calibration, communication credentials,
and deployment settings belong in that board-specific adapter layer.

`MeterReading` carries voltage, current, active power, and cumulative imported
and exported energy in SI units (V, A, W, and kWh). The transport contract
leaves the wire format and backend endpoint to the device integration.

## Build

```sh
cmake -S hardware -B hardware/build
cmake --build hardware/build
```

This builds the portable core; it does not produce a flashable image until a
specific board, toolchain, and hardware adapters are selected.
