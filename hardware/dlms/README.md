# DLMS source files

This directory contains the supplied Gurux DLMS C source files and their
matching headers. Source files retain their original copyright and license
notices. Those notices identify the files as Gurux Device Framework code
licensed under GNU GPL version 2; the license text is available at
https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt.

The original package did not include a repository URL, release identifier, or
standalone license file, so that provenance is not inferred here. These files
are kept separate from the portable firmware core and are not yet compiled by
`hardware/CMakeLists.txt`. Integrate them after selecting the MCU toolchain,
memory-allocation configuration, and DLMS client transport for the meter.
