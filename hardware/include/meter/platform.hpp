#pragma once

#include "meter/reading.hpp"

namespace leco::meter {

class MeterSensor {
public:
    virtual ~MeterSensor() = default;
    virtual bool read(MeterReading& reading) = 0;
};

class TelemetryTransport {
public:
    virtual ~TelemetryTransport() = default;
    virtual bool publish(const MeterReading& reading) = 0;
};

class Clock {
public:
    virtual ~Clock() = default;
    virtual std::uint64_t now_ms() const = 0;
};

}  // namespace leco::meter
