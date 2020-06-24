FROM rust:1.44 AS build-env


WORKDIR /sources

RUN git clone -b wasm32-target-fix https://github.com/drager/wasm-pack.git
WORKDIR wasm-pack

RUN rustup default nightly
RUN cargo install --path .


WORKDIR /planetwars
COPY . .

WORKDIR backend
RUN cargo build --release


WORKDIR ../frontend

RUN cargo update
RUN wasm-pack build

FROM node:10
COPY --from=build-env /planetwars /planetwars
WORKDIR /planetwars/frontend/www
RUN npm install
RUN npm run build

WORKDIR /planetwars/backend

EXPOSE 9142
EXPOSE 8123
EXPOSE 3012

CMD ["target/release/planetwars"]

