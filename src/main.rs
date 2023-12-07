use std::sync::Arc;

use axum::{
    body::{self, Body, Full},
    extract::{DefaultBodyLimit, Query, State},
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

#[derive(Serialize, Deserialize)]
struct File {
    id: u64,
    name: String,
    size: u64,
}

#[derive(Serialize, Deserialize)]
struct List {
    files: Vec<File>,
    running_id: u64,
}

impl List {
    fn new() -> Self {
        Self {
            files: vec![],
            running_id: 0,
        }
    }

    fn load(path: &str) -> Result<Self> {
        let result = serde_json::from_str(&std::fs::read_to_string(path)?)?;
        Ok(result)
    }

    fn add(&mut self, file: File) {
        self.files.push(file);
    }

    async fn remove(&mut self, id: u64) {
        async_fs::remove_file(format!("files/{}", self.files[id as usize].name))
            .await
            .unwrap();
        self.files.retain(|f| f.id != id);
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = std::env::args().collect::<Vec<String>>();
    let ip = if args.len() == 2 {
        args[1].parse::<String>()?
    } else {
        println!("Usage: {} <ip:port>", args[0]);
        return Ok(());
    };

    if !std::path::Path::new("list.json").exists() {
        std::fs::write("list.json", serde_json::to_string(&List::new())?)?;
    }
    let state = Arc::new(Mutex::new(List::load("list.json")?));
    if !std::path::Path::new("files").exists() {
        async_fs::create_dir("files").await?;
    }

    let routes = Router::new()
        .route("/", get(index))
        .route("/list", get(list))
        .route("/index.js", get(index_js))
        .route("/index.css", get(index_css))
        .route("/favicon.png", get(favicon))
        .route("/upload", post(upload))
        .route("/remove", post(remove))
        .route("/file", get(file))
        .layer(CorsLayer::permissive())
        .layer(DefaultBodyLimit::max(1024 * 1024 * 1024));
    let router_service = routes.with_state(state).into_make_service();
    axum::Server::bind(&ip.parse()?)
        .serve(router_service)
        .await?;
    Ok(())
}

async fn index() -> Html<String> {
    let file = include_str!("../static/index.html");
    Html(file.to_string())
}

async fn list(State(state): State<Arc<Mutex<List>>>) -> impl IntoResponse {
    let state = state.try_lock();
    if state.is_err() {
        return Response::builder()
            .status(StatusCode::SERVICE_UNAVAILABLE)
            .body(Body::empty())
            .unwrap();
    }
    let state = state.unwrap();
    let list = serde_json::to_string(&*state).unwrap();
    Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            header::HeaderValue::from_str("application/json").unwrap(),
        )
        .body(Body::from(list))
        .unwrap()
}

#[derive(Serialize, Deserialize)]
struct Upload {
    name: String,
    data: String,
}

#[axum_macros::debug_handler]
async fn upload(State(state): State<Arc<Mutex<List>>>, body: Json<Upload>) -> impl IntoResponse {
    let data = &body.data;
    let data = data.split(',').nth(1).unwrap();
    // Decode Base64 data
    use base64::{engine::general_purpose, Engine as _};

    let bytes = general_purpose::STANDARD.decode(data).unwrap();
    let length = bytes.len();
    let state: Arc<Mutex<List>> = Arc::clone(&state);
    let handle = tokio::spawn(async move {
        let state = state.try_lock();
        if state.is_err() {
            Response::builder()
                .status(StatusCode::SERVICE_UNAVAILABLE)
                .body(Body::empty())
                .unwrap();
        }
        let mut state = state.unwrap();
        async_fs::write(format!("files/{}", body.name), bytes)
            .await
            .unwrap();
        let id = state.running_id;
        state.add(File {
            id,
            name: body.name.clone(),
            size: length as u64,
        });
        state.running_id += 1;
        std::fs::write("list.json", serde_json::to_string(&*state).unwrap()).unwrap();
    });

    handle.await.unwrap();
    Response::builder()
        .status(StatusCode::OK)
        .body(Body::empty())
        .unwrap()
}

#[derive(Deserialize)]
struct FileQuery {
    id: u64,
}

#[axum_macros::debug_handler]
async fn remove(
    State(state): State<Arc<Mutex<List>>>,
    query: Query<FileQuery>,
) -> impl IntoResponse {
    let state: Arc<Mutex<List>> = Arc::clone(&state);
    let handle = tokio::spawn(async move {
        let state = state.try_lock();
        if state.is_err() {
            Response::builder()
                .status(StatusCode::SERVICE_UNAVAILABLE)
                .body(Body::empty())
                .unwrap();
        }
        let mut state = state.unwrap();
        state.remove(query.id).await;
        std::fs::write("list.json", serde_json::to_string(&*state).unwrap()).unwrap();
    });

    handle.await.unwrap();
    Response::builder()
        .status(StatusCode::OK)
        .body(Body::empty())
        .unwrap()
}

async fn file(State(state): State<Arc<Mutex<List>>>, query: Query<FileQuery>) -> impl IntoResponse {
    let state = state.try_lock();
    if state.is_err() {
        return Response::builder()
            .status(StatusCode::SERVICE_UNAVAILABLE)
            .body(Body::empty())
            .unwrap();
    }
    let state = state.unwrap();
    let file = state.files.iter().find(|f| f.id == query.id);
    if file.is_none() {
        return Response::builder()
            .status(StatusCode::NOT_FOUND)
            .body(Body::empty())
            .unwrap();
    }
    let file = file.unwrap();
    let path = format!("files/{}", file.name);
    match async_fs::read(path).await {
        Ok(file_data) => {
            let content_length = file_data.len().to_string();
            let response = Response::builder()
                .status(StatusCode::OK)
                .header(
                    header::CONTENT_TYPE,
                    header::HeaderValue::from_str("application/octet-stream").unwrap(),
                )
                .header(
                    header::CONTENT_LENGTH,
                    header::HeaderValue::from_str(&content_length).unwrap(),
                )
                .body(Body::from(file_data))
                .unwrap();

            println!("File downloaded successfully. Size: {}", content_length);
            response
        }
        Err(err) => {
            eprintln!("Error reading file: {:?}", err);
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::empty())
                .unwrap()
        }
    }
}

async fn index_js() -> impl IntoResponse {
    let m = "text/javascript";
    let content = include_str!("../static/index.js");
    let mut result = String::new();
    result.push_str("let global_ip = \"");
    result.push_str(&std::env::args().collect::<Vec<String>>()[1]);
    result.push_str("\";");
    result.push_str(content);
    Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            header::HeaderValue::from_str(m).unwrap(),
        )
        .body(result)
        .unwrap()
}

async fn index_css() -> impl IntoResponse {
    let m = "text/css";
    let content = include_str!("../static/index.css");
    Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            header::HeaderValue::from_str(m).unwrap(),
        )
        .body(content.to_string())
        .unwrap()
}

async fn favicon() -> impl IntoResponse {
    let m = "image/x-icon";
    let body = include_bytes!("../static/favicon.png").to_vec();
    Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            header::HeaderValue::from_str(m).unwrap(),
        )
        .body(body::boxed(Full::from(body)))
        .unwrap()
}
