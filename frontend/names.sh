#!/bin/bash

function name {
    rig | head -n 1
}

for var in "$@"
do
    mv "$var" "$(name).json"
done
