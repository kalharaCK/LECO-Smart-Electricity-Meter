# Decoupled SMS Notification Gateway Module

## Overview
This module exposes the SMS notification system for the LECO Smart Electricity Meter platform. It isolates the third-party Text.lk API communication, phone normalization, and trilingual templates (English, Sinhala, Tamil) from HTTP controllers.

## Features
- **Phone Normalization**: Standardizes `07XXXXXXXX`, `+94XXXXXXXXX`, and `7XXXXXXXX` numbers into `94XXXXXXXXX`.
- **Trilingual Templates**: Compact, single-SMS length templates for OTP registration, forgot password, payments, low balance alerts, and meter relay commands.
- **Delivery Logging**: Tracks outgoing SMS dispatch and provider delivery statuses in `sms_logs`.
