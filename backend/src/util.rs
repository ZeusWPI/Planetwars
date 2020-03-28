use async_std::prelude::*;
use async_std::fs;

static NAV: [(&'static str, &'static str); 4] = [("/", "Home"), ("/lobby", "Lobby"), ("/mapbuilder", "Map Builder"), ("/visualizer", "Visualizer")];

#[derive(Serialize)]
pub struct Map {
    name: String,
    url: String,
}

#[derive(Serialize)]
pub struct GameState {
    name: String,
    finished: bool,
    turns: Option<u64>,
    players: Vec<String>,
}

/// Visualiser game option
#[derive(Serialize)]
pub struct GameOption {
    name: String,
    location: String,
    turns: u64,
}
impl GameOption {
    pub fn new(name: &str, location: &str, turns: u64) -> Self {
        Self {
            name: name.to_string(),
            location: location.to_string(),
            turns
        }
    }
}

#[derive(Serialize)]
struct Link {
    name: String,
    href: String,
    active: bool,
}

#[derive(Serialize)]
pub struct Lobby {
    pub games: Vec<GameState>,
    pub maps: Vec<Map>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ContextT {
    Games(Vec<GameOption>),
}

#[derive(Serialize)]
pub struct Context<T> {
    pub name: String,
    nav: Vec<Link>,

    #[serde(flatten)]
    pub t: Option<T>
}

impl<T> Context<T> {
    pub fn new_with(active: &str, t: T) -> Self {
        let nav = NAV.iter().map(|(href, name)| Link { name: name.to_string(), href: href.to_string(), active: *name == active }).collect();

        Context {
            nav, name: String::from(""), t: Some(t)
        }
    }
}

impl Context<()> {
    pub fn new(active: &str) -> Self {
        let nav = NAV.iter().map(|(href, name)| Link { name: name.to_string(), href: href.to_string(), active: *name == active }).collect();

        Context {
            nav, name: String::from(""), t: None,
        }
    }
}

pub async fn get_maps() -> Result<Vec<Map>, String> {
    let mut maps = Vec::new();
    let mut entries = fs::read_dir("maps").await.map_err(|_| "IO error".to_string())?;
    while let Some(file) = entries.next().await  {
        let file = file.map_err(|_| "IO error".to_string())?.path();
        if let Some(stem) = file.file_stem().and_then(|x| x.to_str()) {
            maps.push(Map { name: stem.to_string(), url: file.to_str().unwrap().to_string() });
        }
    }

    Ok(maps)
}

use ini::Ini;
pub async fn get_games() -> Result<Vec<GameOption>, String> {
    let mut games = Vec::new();

    let content = match fs::read_to_string("games.ini").await {
        Ok(v) => v,
        Err(_) => {
            fs::File::create("games.ini").await.map_err(|_| "IO Error".to_string())?;
            String::new()
        }
    };

    let i = Ini::load_from_str(&content).map_err(|_| "Corrupt ini file".to_string())?;

    for (sec, prop) in i.iter() {
        if let Some(sec) = sec {
            let name = match prop.get("name") { None => continue, Some(v) => v};
            let turns = match prop.get("turns").and_then(|v| v.parse().ok()) { None => continue, Some(v) => v};
            games.push(GameOption::new(name, sec, turns));
        }
    }

    Ok(games)
}


use mozaic::modules::game;
use mozaic::util::request::Connect;
use futures::future::{join_all, FutureExt};
pub async fn get_states(game_ids: &Vec<(String, u64)>, manager: &game::Manager) -> Result<Vec<GameState>, String> {
    let mut states = Vec::new();
    let gss = join_all(game_ids.iter().cloned().map(|(name, id)| manager.get_state(id).map(move |f| (f, name)))).await;

    for (gs, name) in gss {
        if let Some(state) = gs {
            states.push(
                GameState {
                    name,
                    turns: None,
                    players: state.iter().map(|conn| match conn {
                        Connect::Waiting(_, key) => format!("Waiting {}", key),
                        _ => String::from("Some connected player"),
                    }).collect(),
                    finished: false,
                }
            )
        } else {
            states.push(
                GameState {
                    name,
                    turns: None,
                    players: Vec::new(),
                    finished: true,
                }
            )
        }
    }

    Ok(states)
}

use std::sync::{Arc, Mutex};

pub struct Games {
    inner: Arc<Mutex<Vec<(String, u64)>>>,
}

impl Games {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Vec::new()))
        }
    }

    pub fn add_game(&self, name: String, id: u64) {
        self.inner.lock().unwrap().push((name, id));
    }

    pub fn get_games(&self) -> Vec<(String, u64)> {
        self.inner.lock().unwrap().clone()
    }
}
