#pragma once

#include <cstdint>

#include "meter/platform.hpp"

namespace leco::meter {

class Firmware {
public:
    Firmware(MeterSensor& sensor,
             TelemetryTransport& transport,
             const Clock& clock,
             std::uint32_t sample_interval_ms);

    // Call repeatedly from the board's main loop or scheduler.
    // Returns true only when a valid reading was successfully published.
    bool run_once();

private:
    MeterSensor& sensor_;
    TelemetryTransport& transport_;
    const Clock& clock_;
    std::uint32_t sample_interval_ms_;
    std::uint64_t last_sample_at_ms_{0};
    bool has_sampled_{false};
};

bool is_valid_reading(const MeterReading& reading);

}  // namespace leco::meter
