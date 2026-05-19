use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

#[derive(Default)]
struct RuntimeState {
    child: Mutex<Option<Child>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeStartResult {
    control_ui_url: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct DesktopConfig {
    mode: Option<String>,
    cloud_endpoint: Option<String>,
}

fn package_root(app: &AppHandle) -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    let exe_dir = exe
        .parent()
        .ok_or_else(|| "unable to resolve executable directory".to_string())?;
    let direct = exe_dir.join("..").join("..").join("..").join("..");
    let direct_runtime = direct.join("scripts").join("start-local-runtime.mjs");
    if direct_runtime.exists() {
        return direct.canonicalize().map_err(|error| error.to_string());
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?;
    let packaged = resource_dir.join("local-runtime");
    let packaged_runtime = packaged.join("scripts").join("start-local-runtime.mjs");
    if packaged_runtime.exists() {
        let app_data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
        let writable_runtime = app_data_dir.join("local-runtime");
        fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
        sync_packaged_runtime(&packaged, &writable_runtime).map_err(|error| error.to_string())?;
        return writable_runtime
            .canonicalize()
            .map_err(|error| error.to_string());
    }

    let app_data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    let writable_runtime = app_data_dir.join("local-runtime");
    let writable_runtime_launcher = writable_runtime
        .join("scripts")
        .join("start-local-runtime.mjs");
    if writable_runtime_launcher.exists() {
        return writable_runtime
            .canonicalize()
            .map_err(|error| error.to_string());
    }
    Err("local runtime package was not found beside the desktop shell".to_string())
}

fn sync_packaged_runtime(source: &Path, target: &Path) -> std::io::Result<()> {
    let replace_dirs = ["runtime", "scripts"];
    for name in replace_dirs {
        let next_source = source.join(name);
        let next_target = target.join(name);
        if next_target.exists() {
            fs::remove_dir_all(&next_target)?;
        }
        if next_source.exists() {
            copy_dir_all(&next_source, &next_target)?;
        }
    }
    copy_if_exists(
        &source.join("openclaw.local.example.json5"),
        &target.join("openclaw.local.example.json5"),
        true,
    )?;
    copy_if_exists(&source.join("runtime.env"), &target.join("runtime.env"), false)?;
    if !target.join("data").exists() {
        copy_dir_all(&source.join("data"), &target.join("data"))?;
    }
    Ok(())
}

fn copy_if_exists(source: &Path, target: &Path, overwrite: bool) -> std::io::Result<()> {
    if !source.exists() || (!overwrite && target.exists()) {
        return Ok(());
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, target)?;
    Ok(())
}

fn copy_dir_all(source: &Path, target: &Path) -> std::io::Result<()> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let next_target = target.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_all(&entry.path(), &next_target)?;
        } else if file_type.is_file() {
            if let Some(parent) = next_target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(entry.path(), next_target)?;
        }
    }
    Ok(())
}

fn read_runtime_env_value(root: &PathBuf, key: &str, fallback: &str) -> String {
    let env_path = root.join("runtime.env");
    let Ok(text) = std::fs::read_to_string(env_path) else {
        return fallback.to_string();
    };
    let prefix = format!("{}=", key);
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(&prefix) {
            return trimmed
                .trim_start_matches(&prefix)
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string();
        }
    }
    fallback.to_string()
}

fn request_ok(port: &str, path: &str) -> bool {
    let Ok(mut stream) = TcpStream::connect(format!("127.0.0.1:{}", port)) else {
        return false;
    };
    let request = format!(
        "GET {} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
        path, port
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }
    response.starts_with("HTTP/1.1 2")
        || response.starts_with("HTTP/1.0 2")
        || response.starts_with("HTTP/1.1 3")
        || response.starts_with("HTTP/1.0 3")
        || response.starts_with("HTTP/1.1 4")
        || response.starts_with("HTTP/1.0 4")
}

fn wait_for_runtime(gateway_port: &str, tenant_port: &str, timeout: Duration) -> Result<(), String> {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if request_ok(gateway_port, "/healthz")
            && request_ok(tenant_port, "/tenant-platform-api/v1/healthz")
        {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(500));
    }
    Err(format!(
        "timed out waiting for OpenClaw runtime on ports {} and {}",
        gateway_port, tenant_port
    ))
}

#[tauri::command]
fn start_openclaw_runtime(
    app: AppHandle,
    state: tauri::State<'_, RuntimeState>,
) -> Result<RuntimeStartResult, String> {
    let root = package_root(&app)?;
    let gateway_port = read_runtime_env_value(&root, "OPENCLAW_GATEWAY_PORT", "18789");
    let tenant_port = read_runtime_env_value(&root, "OPENCLAW_TENANT_PLATFORM_PORT", "18801");
    let control_ui_url = format!("http://127.0.0.1:{}", gateway_port);

    if wait_for_runtime(&gateway_port, &tenant_port, Duration::from_millis(800)).is_ok() {
        return Ok(RuntimeStartResult { control_ui_url });
    }

    let mut child_guard = state.child.lock().map_err(|error| error.to_string())?;
    if child_guard.is_none() {
        let script = root.join("scripts").join("start-local-runtime.mjs");
        let child = Command::new("node")
            .arg(script)
            .current_dir(&root)
            .stdin(Stdio::null())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|error| error.to_string())?;
        *child_guard = Some(child);
    }
    drop(child_guard);

    wait_for_runtime(&gateway_port, &tenant_port, Duration::from_secs(60))?;
    Ok(RuntimeStartResult { control_ui_url })
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    Ok(app_data_dir.join("desktop-config.json"))
}

#[tauri::command]
fn get_desktop_config(app: AppHandle) -> Result<DesktopConfig, String> {
    let path = config_path(&app)?;
    if !path.exists() {
        return Ok(DesktopConfig::default());
    }
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_desktop_config(app: AppHandle, config: DesktopConfig) -> Result<(), String> {
    let path = config_path(&app)?;
    let text = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_runtime_env_mode(app: AppHandle, cloud_endpoint: Option<String>) -> Result<(), String> {
    let root = package_root(&app)?;
    let env_path = root.join("runtime.env");
    let mut lines: Vec<String> = if env_path.exists() {
        fs::read_to_string(&env_path)
            .map_err(|e| e.to_string())?
            .lines()
            .map(|l| l.to_string())
            .collect()
    } else {
        Vec::new()
    };
    let key = "OPENCLAW_MODEL_PROXY_ENDPOINT";
    lines.retain(|l| !l.trim().starts_with(key) && !l.trim().starts_with(&format!("# {}", key)));
    if let Some(endpoint) = cloud_endpoint {
        lines.push(format!("{}={}", key, endpoint));
    }
    fs::write(&env_path, lines.join("\n") + "\n").map_err(|e| e.to_string())
}

#[tauri::command]
fn navigate_to(app: AppHandle, url: String) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let parsed: tauri::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    window.navigate(parsed).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .manage(RuntimeState::default())
        .invoke_handler(tauri::generate_handler![
            start_openclaw_runtime,
            get_desktop_config,
            set_desktop_config,
            write_runtime_env_mode,
            navigate_to,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<RuntimeState>();
                let mut child_guard = state.child.lock().unwrap();
                if let Some(child) = child_guard.as_mut() {
                    let _ = child.kill();
                }
                *child_guard = None;
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running OpenClaw desktop shell");
}
