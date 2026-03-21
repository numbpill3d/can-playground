
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

struct CaptureState {
    child: Option<Child>,
}

#[tauri::command]
fn start_capture(
    iface: String,
    app: AppHandle,
    state: State<'_, Mutex<CaptureState>>,
) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    if s.child.is_some() {
        return Err("capture already running".into());
    }

    let mut child = Command::new("candump")
        .arg(&iface)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("failed to start candump: {e}"))?;

    let stdout = child.stdout.take().ok_or("no stdout")?;
    s.child = Some(child);
    drop(s); // release lock before spawning thread

    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(l) if !l.trim().is_empty() => {
                    let _ = app.emit("can_frame", l.trim().to_string());
                }
                _ => break,
            }
        }
        let _ = app.emit("capture_stopped", ());
    });

    Ok(())
}

#[tauri::command]
fn stop_capture(state: State<'_, Mutex<CaptureState>>) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = s.child.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}

// Detect available CAN interfaces by reading /sys/class/net and checking ARPHRD_CAN = 280
#[tauri::command]
fn get_can_interfaces() -> Vec<String> {
    let Ok(entries) = std::fs::read_dir("/sys/class/net") else {
        return vec![];
    };
    let mut ifaces: Vec<String> = entries
        .filter_map(|e| {
            let entry = e.ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            let type_path = format!("/sys/class/net/{}/type", name);
            let type_val = std::fs::read_to_string(type_path).ok()?;
            if type_val.trim() == "280" { Some(name) } else { None }
        })
        .collect();
    ifaces.sort();
    // Always include "any" (captures from all interfaces)
    ifaces.insert(0, "any".to_string());
    ifaces
}

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(CaptureState { child: None }))
        .invoke_handler(tauri::generate_handler![
            start_capture,
            stop_capture,
            get_can_interfaces
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
