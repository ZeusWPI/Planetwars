#!/bin/bash

echo "Using token $1"
python3 runner.py -n simple.py --host ${HOST:-localhost} -p 9142 -i $1 python3 simple.py
