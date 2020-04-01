use async_std::prelude::*;
use async_std::fs;

static NAV: [(&'static str, &'static str); 5] = [("/", "Home"), ("/lobby", "Lobby"), ("/mapbuilder", "Map Builder"), ("/visualizer", "Visualizer"), ("/debug", "Debug Station")];

#[derive(Serialize)]
pub struct Map {
    name: String,
    url: String,
}

#[derive(Serialize, Eq, PartialEq)]
pub struct PlayerStatus {
    waiting: bool,
    connected: bool,
    reconnecting: bool,
    value: String,
}
impl From<Connect> for PlayerStatus {
    fn from(value: Connect) -> Self {
        match value {
            Connect::Connected(_, name) => PlayerStatus { waiting: false, connected: true, reconnecting: false, value: name },
            Connect::Reconnecting(_, name) => PlayerStatus { waiting: false, connected: true, reconnecting: true, value: name },
            Connect::Waiting(_, key) => PlayerStatus { waiting: true, connected: false, reconnecting: false, value: format!("Key: {}", key) },
            _ => panic!("No playerstatus possible from Connect::Request"),
        }
    }
}

#[derive(Serialize, Eq, PartialEq)]
#[serde(tag = "type")]
pub enum GameState {
    Finished {
        name: String,
        map: String,
        players: Vec<(String, bool)>,
        turns: u64,
    },
    Playing {
        name: String,
        map: String,
        players: Vec<PlayerStatus>,
        connected: usize,
        total: usize,
    }
}

use std::cmp::Ordering;

impl PartialOrd for GameState {
    fn partial_cmp(&self, other: &GameState) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for GameState {
    fn cmp(&self, other: &GameState) -> Ordering {
        match self {
            GameState::Finished { name, .. } => {
                match other {
                    GameState::Finished { name: _name, .. } => name.cmp(_name),
                    _ => Ordering::Greater,
                }
            },
            GameState::Playing { name, .. } => {
                match other {
                    GameState::Playing { name: _name, .. } => name.cmp(_name),
                    _ => Ordering::Less,
                }
            }
        }
    }
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

use crate::planetwars::FinishedState;

use mozaic::modules::game;
use mozaic::util::request::Connect;
use futures::future::{join_all, FutureExt};
pub async fn get_states(game_ids: &Vec<(String, u64)>, manager: &game::Manager) -> Result<Vec<GameState>, String> {
    let mut states = Vec::new();
    let gss = join_all(game_ids.iter().cloned().map(|(name, id)| manager.get_state(id).map(move |f| (f, name)))).await;

    for (gs, name) in gss {
        if let Some(state) = gs {
            match state {
                Ok(conns) => {
                    let players: Vec<PlayerStatus> = conns.iter().cloned().map(|x| x.into()).collect();
                    let connected = players.iter().filter(|x| x.connected).count();
                    states.push(
                        GameState::Playing { name: name, total: players.len(), players, connected, map: String::new(), }
                    );
                },
                Err(value) => {
                    let state: FinishedState = serde_json::from_value(value).expect("Shit failed");
                    states.push(
                        GameState::Finished {
                            map: String::new(),
                            players: state.players.iter().map(|(id, name)| (name.clone(), state.winners.contains(&id))).collect(),
                            name: state.name,
                            turns: state.turns,
                        }
                    );
                }
            }
        }
    }

    states.sort();
    println!(
        "{}", serde_json::to_string_pretty(&states).unwrap(),
    );

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
