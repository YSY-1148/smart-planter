#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Please install Python 3.10+ to run the local lab. The online Pages version needs only a browser."
  read -r -p "Press Enter to close. "
  exit 1
fi
python3 launch.py --study
if [ "$?" -ne 0 ]; then
  echo "Local C experiments require Apple's Command Line Tools (xcode-select --install)."
  read -r -p "Press Enter to close. "
fi
