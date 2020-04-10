use crate::planetwars::{self, FinishedState};
use crate::util::*;

use rocket::{Route, State};
use rocket_contrib::json::Json;
use rocket_contrib::templates::Template;

use mozaic::modules::types::*;
use mozaic::modules::{game, StepLock};
use mozaic::util::request::Connect;

use async_std::fs;
use async_std::prelude::StreamExt;

use futures::executor::ThreadPool;
use futures::future::{join_all, FutureExt};

use serde_json::Value;

use rand::prelude::*;
use std::time::SystemTime;

/// The type required to build a game.
/// (json in POST request).
#[derive(Deserialize, Debug)]
struct GameReq {
    nop: u64,
    max_turns: u64,
    map: String,
    name: String,
}

/// Response when building a game.
#[derive(Serialize)]
struct GameRes {
    players: Vec<u64>,
    state: Value,
}

/// Standard get function for the lobby tab
#[get("/lobby")]
async fn get_lobby(
    gm: State<'_, game::Manager>,
    state: State<'_, Games>,
) -> Result<Template, String> {
    let maps = get_maps().await?;
    let games = get_states(&state.get_games(), &gm).await?;
    let context = Context::new_with("Lobby", Lobby { games, maps });
    Ok(Template::render("lobby", &context))
}

/// The lobby get's this automatically on load and on refresh.
#[get("/partial/state")]
async fn state_get(
    gm: State<'_, game::Manager>,
    state: State<'_, Games>,
) -> Result<Template, String> {
    let games = get_states(&state.get_games(), &gm).await?;
    let context = Context::new_with(
        "Lobby",
        Lobby {
            games,
            maps: Vec::new(),
        },
    );

    Ok(Template::render("state_partial", &context))
}

/// Post function to create a game.
/// Returns the keys of the players in json.
#[post("/lobby", data = "<game_req>")]
async fn post_game(
    game_req: Json<GameReq>,
    tp: State<'_, ThreadPool>,
    gm: State<'_, game::Manager>,
    state: State<'_, Games>,
) -> Result<Json<GameRes>, String> {
    let game = build_builder(
        tp.clone(),
        game_req.nop,
        game_req.max_turns,
        &game_req.map,
        &game_req.name,
    );
    let game_id = gm.start_game(game).await.unwrap();
    state.add_game(game_req.name.clone(), game_id);

    match gm.get_state(game_id).await {
        Some(Ok((state, conns))) => {
            let players: Vec<u64> = conns
                .iter()
                .map(|conn| match conn {
                    Connect::Waiting(_, key) => *key,
                    _ => 0,
                })
                .collect();

            Ok(Json(GameRes { players, state }))
        }
        Some(Err(v)) => Err(serde_json::to_string(&v).unwrap()),
        None => Err(String::from("Fuck the world")),
    }
}

/// Generate random ID for the game, used as filename
fn generate_string_id() -> String {
    rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(15)
        .collect::<String>()
        + ".json"
}

/// game::Manager spawns game::Builder to start games.
/// This returns such a Builder for a planetwars game.
fn build_builder(
    pool: ThreadPool,
    number_of_clients: u64,
    max_turns: u64,
    map: &str,
    name: &str,
) -> game::Builder<planetwars::PlanetWarsGame> {
    let config = planetwars::Config {
        map_file: map.to_string(),
        max_turns: max_turns,
    };

    let game = planetwars::PlanetWarsGame::new(
        config.create_game(number_of_clients as usize),
        &generate_string_id(),
        name,
        map,
    );

    let players: Vec<PlayerId> = (0..number_of_clients).collect();

    game::Builder::new(players.clone(), game).with_step_lock(
        StepLock::new(players.clone(), pool.clone())
            .with_timeout(std::time::Duration::from_secs(1)),
    )
}

/// Fuels the lobby routes
pub fn fuel(routes: &mut Vec<Route>) {
    routes.extend(routes![post_game, get_lobby, state_get]);
}

#[derive(Serialize)]
pub struct Lobby {
    pub games: Vec<GameState>,
    pub maps: Vec<Map>,
}

#[derive(Serialize)]
pub struct Map {
    name: String,
    url: String,
}

async fn get_maps() -> Result<Vec<Map>, String> {
    let mut maps = Vec::new();
    let mut entries = fs::read_dir("maps")
        .await
        .map_err(|_| "IO error".to_string())?;
    while let Some(file) = entries.next().await {
        let file = file.map_err(|_| "IO error".to_string())?.path();
        if let Some(stem) = file.file_stem().and_then(|x| x.to_str()) {
            maps.push(Map {
                name: stem.to_string(),
                url: file.to_str().unwrap().to_string(),
            });
        }
    }

    Ok(maps)
}

pub async fn get_states(
    game_ids: &Vec<(String, u64, SystemTime)>,
    manager: &game::Manager,
) -> Result<Vec<GameState>, String> {
    let mut states = Vec::new();
    let gss = join_all(
        game_ids
            .iter()
            .cloned()
            .map(|(name, id, time)| manager.get_state(id).map(move |f| (f, name, time))),
    )
    .await;

    for (gs, name, time) in gss {
        if let Some(state) = gs {
            match state {
                Ok((state, conns)) => {
                    let players: Vec<PlayerStatus> =
                        conns.iter().cloned().map(|x| x.into()).collect();
                    let connected = players.iter().filter(|x| x.connected).count();

                    states.push(GameState::Playing {
                        name: name,
                        total: players.len(),
                        players,
                        connected,
                        map: String::new(),
                        state,
                        time,
                    });
                }
                Err(value) => {
                    let state: FinishedState = serde_json::from_value(value).expect("Shit failed");
                    states.push(state.into());
                }
            }
        }
    }

    states.sort();
    Ok(states)
}
