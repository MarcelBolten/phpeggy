#!/bin/bash

rm test/fixtures/*.php
GENERATE_MISSING_FIXTURES=y npm test
