cmake_minimum_required(VERSION 3.16)

project(leco_meter_firmware_core LANGUAGES CXX)

add_library(leco_meter_firmware_core
    src/firmware.cpp
)

target_include_directories(leco_meter_firmware_core
    PUBLIC include
)

target_compile_features(leco_meter_firmware_core PUBLIC cxx_std_17)

if(MSVC)
    target_compile_options(leco_meter_firmware_core PRIVATE /W4 /permissive-)
else()
    target_compile_options(leco_meter_firmware_core PRIVATE -Wall -Wextra -Wpedantic)
endif()
