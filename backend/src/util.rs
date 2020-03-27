use async_std::prelude::*;
use async_std::fs;

static NAV: [(&'static str, &'static str); 4] = [("/", "Home"), ("/lobby", "Lobby"), ("/mapbuilder", "Map Builder"), ("/visualizer", "Visualizer")];

#[derive(Serialize)]
pub struct Map {
    name: String,
    url: String,
}

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
#[serde(rename_all = "camelCase")]
pub enum ContextT {
    Maps(Vec<Map>),
    Games(Vec<GameOption>),
}

#[derive(Serialize)]
pub struct Context {
    pub name: String,
    nav: Vec<Link>,

    #[serde(flatten)]
    pub inner: Option<ContextT>,
}

impl Context {
    pub fn new_with(active: &str, inner: ContextT) -> Self {
        let nav = NAV.iter().map(|(href, name)| Link { name: name.to_string(), href: href.to_string(), active: *name == active }).collect();

        Context {
            nav, name: String::from(""), inner: Some(inner)
        }
    }

    pub fn new(active: &str) -> Self {
        let nav = NAV.iter().map(|(href, name)| Link { name: name.to_string(), href: href.to_string(), active: *name == active }).collect();

        Context {
            nav, name: String::from(""), inner: None,
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

    let content = fs::read_to_string("games.ini").await.map_err(|_| "IO error".to_string())?;

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
