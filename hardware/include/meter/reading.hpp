#pragma once

#include <cstdint>

namespace leco::meter {

struct MeterReading {
    std::uint64_t sampled_at_ms{0};
    double voltage_v{0.0};
    double current_a{0.0};
    double active_power_w{0.0};
    double imported_energy_kwh{0.0};
    double exported_energy_kwh{0.0};
};

}  // namespace leco::meter
