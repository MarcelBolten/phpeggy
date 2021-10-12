#!/bin/bash

if [ "$0" = "$BASH_SOURCE" ]; then
  echo "This script must be sourced rather than executed directly."
  exit 1
fi

rm test/fixtures/*.php
phpbrew off
GENERATE_MISSING_FIXTURES=y npm test
phpbrew off
