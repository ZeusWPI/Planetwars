
use serde::{Deserialize};

use rocket::{Route, State};
use rocket::response::NamedFile;

use rocket_contrib::templates::Template;
use rocket_contrib::json::Json;

use async_std::prelude::*;
use async_std::fs;
use async_std::io::ReadExt;

use crate::util::*;

use std::path::Path;

#[get("/<file..>", rank = 6)]
async fn files(file: PathBuf) -> Option<NamedFile> {
    NamedFile::open(Path::new("static/").join(file)).ok()
}

#[get("/")]
async fn index() -> Template {
    // let context = context();
    let context = Context::new("Home");
    // context.insert("name".to_string(), "Arthur".to_string());
    Template::render("index", &context)
}

#[derive(Deserialize, Debug)]
struct MapReq {
    pub name: String,
    pub map: crate::planetwars::Map,
}

use std::path::PathBuf;

#[post("/maps", data="<map_req>")]
async fn map_post(map_req: Json<MapReq>) -> Result<String, String> {
    let MapReq { name, map } = map_req.into_inner();

    let path: PathBuf = PathBuf::from(format!("maps/{}.json", name));
    if path.exists() {
        return Err("File already exists!".into());
    }

    let mut file = fs::File::create(path).await.map_err(|_| "IO error".to_string())?;
    file.write_all(&serde_json::to_vec_pretty(&map).unwrap()).await.map_err(|_| "IO error".to_string())?;

    Ok("ok".into())
}

#[get("/lobby")]
async fn lobby_get(gm: State<'_, game::Manager>, state: State<'_, Games>) -> Result<Template, String> {
    let maps = get_maps().await?;
    let games = get_states(&state.get_games(), &gm).await?;
    let context = Context::new_with("Lobby", Lobby { games, maps });
    Ok(Template::render("lobby", &context))
}

#[get("/mapbuilder")]
async fn builder_get() -> Result<Template, String> {
    let context = Context::new("Map Builder");
    Ok(Template::render("mapbuilder", &context))
}

#[get("/visualizer")]
async fn visualizer_get() -> Result<Template, String> {
    let game_options = get_games().await?;
    let context = Context::new_with("Visualizer", ContextT::Games(game_options));
    Ok(Template::render("visualizer", &context))
}

#[get("/maps/<file>")]
async fn map_get(file: String) -> Result<Template, String> {
    let mut content = String::new();
    let mut file = fs::File::open(Path::new("maps/").join(file)).await.map_err(|_| "IO ERROR".to_string())?;
    file.read_to_string(&mut content).await.map_err(|_| "IO ERROR".to_string())?;

    Ok(Template::render("map_partial", &serde_json::from_str::<serde_json::Value>(&content).unwrap()))
}

#[get("/partial/state")]
async fn state_get(gm: State<'_, game::Manager>, state: State<'_, Games>) -> Result<Template, String> {
    let games = get_states(&state.get_games(), &gm).await?;
    let context = Context::new_with("Lobby", Lobby { games, maps: Vec::new() });

    Ok(Template::render("state_partial", &context))
}


#[derive(Deserialize, Debug)]
struct GameReq {
    nop: u64,
    max_turns: u64,
    map: String,
    name: String,
}

#[post("/lobby", data="<game_req>")]
async fn game_post(game_req: Json<GameReq>, tp: State<'_, ThreadPool>, gm: State<'_, game::Manager>, state: State<'_, Games>) -> Result<String, String> {
    let game = build_builder(tp.clone(), game_req.nop, game_req.max_turns, &game_req.map, &game_req.name);
    let game_id = gm.start_game(game).await.unwrap();
    state.add_game(game_req.name.clone(), game_id);
    Ok(format!("{:?}", gm.get_state(game_id).await))
}

pub fn fuel(routes: &mut Vec<Route>) {
    routes.extend(routes![files, index, map_post, map_get, lobby_get, builder_get, visualizer_get, game_post, state_get]);
}


use crate::planetwars;
use mozaic::modules::types::*;
use mozaic::modules::{game, StepLock};
use futures::executor::ThreadPool;

use rand::prelude::*;
fn generate_string_id() -> String {
    rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(15)
        .collect::<String>() + ".json"
}

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

    let game =
        planetwars::PlanetWarsGame::new(config.create_game(number_of_clients as usize), &generate_string_id(), name);

    let players: Vec<PlayerId> = (0..number_of_clients).collect();

    game::Builder::new(players.clone(), game).with_step_lock(
        StepLock::new(players.clone(), pool.clone())
            .with_timeout(std::time::Duration::from_secs(1)),
    )
}
