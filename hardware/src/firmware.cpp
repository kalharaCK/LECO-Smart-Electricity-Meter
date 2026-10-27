#include "meter/firmware.hpp"

#include <cmath>

namespace leco::meter {
namespace {

bool is_finite_non_negative(double value) {
    return std::isfinite(value) && value >= 0.0;
}

}  // namespace

Firmware::Firmware(MeterSensor& sensor,
                   TelemetryTransport& transport,
                   const Clock& clock,
                   std::uint32_t sample_interval_ms)
    : sensor_(sensor),
      transport_(transport),
      clock_(clock),
      sample_interval_ms_(sample_interval_ms) {}

bool is_valid_reading(const MeterReading& reading) {
    return is_finite_non_negative(reading.voltage_v) &&
           is_finite_non_negative(reading.current_a) &&
           is_finite_non_negative(reading.active_power_w) &&
           is_finite_non_negative(reading.imported_energy_kwh) &&
           is_finite_non_negative(reading.exported_energy_kwh);
}

bool Firmware::run_once() {
    const std::uint64_t now = clock_.now_ms();
    if (has_sampled_ && now - last_sample_at_ms_ < sample_interval_ms_) {
        return false;
    }

    MeterReading reading{};
    if (!sensor_.read(reading)) {
        return false;
    }

    reading.sampled_at_ms = now;
    if (!is_valid_reading(reading)) {
        return false;
    }

    if (!transport_.publish(reading)) {
        return false;
    }

    last_sample_at_ms_ = now;
    has_sampled_ = true;
    return true;
}

}  // namespace leco::meter
