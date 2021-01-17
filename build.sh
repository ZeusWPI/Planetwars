#!/bin/bash

info() {
  echo
  echo ">>>>>>>>>>>>>>>>>>>>>>>>>>> $1"
  echo
}

source /home/$USER/.cargo/env

cd "$(dirname "$0")"

info "Pulling git"
git pull

cd frontend

info "Building WASM package"
cargo update
wasm-pack build

cd www
info "Building frontend with npm"
npm run build

cd ../..
cd backend

info "Building backend with cargo --release"
cargo update
cargo build --release
