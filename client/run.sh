#!/bin/bash

echo "Using token $1"
python runner.py --host ${HOST:-localhost} -p 9142 -i $1 python simple.py
