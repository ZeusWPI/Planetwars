use async_std::prelude::*;
use async_std::fs;

static NAV: [(&'static str, &'static str); 3] = [("/", "Home"), ("/lobby", "Lobby"), ("/mapbuilder", "Map Builder")];

#[derive(Serialize)]
pub struct Map {
    name: String,
    url: String,
}

#[derive(Serialize)]
struct Link {
    name: String,
    href: String,
    active: bool,
}

#[derive(Serialize)]
pub struct Context {
    pub name: String,
    nav: Vec<Link>,
    pub maps: Option<Vec<Map>>,
}

impl Context {
    pub fn new(active: &str, maps: Option<Vec<Map>>) -> Self {
        let nav = NAV.iter().map(|(href, name)| Link { name: name.to_string(), href: href.to_string(), active: *name == active }).collect();

        Context {
            nav, name: String::from(""), maps
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
