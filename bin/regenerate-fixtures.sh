#!/bin/bash

if [ "$0" = "$BASH_SOURCE" ]; then
	echo "This script must be sourced rather than executed directly."
	exit 1
fi

phpbrew off && \
	rm test/fixtures/*.php && \
	GENERATE_MISSING_FIXTURES=y npm test && \
	phpbrew use 5.2.17 && \
	GENERATE_MISSING_FIXTURES=y npm test && \
	phpbrew off
