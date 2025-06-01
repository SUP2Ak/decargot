use once_cell::sync::OnceCell;
use serde::Serialize;
use std::collections::HashMap;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::command;
use tauri::{AppHandle, Emitter};

static CANCEL_FLAG: OnceCell<Arc<AtomicBool>> = OnceCell::new();

#[derive(Serialize)]
pub struct FileEntry {
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub modified: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct ProjectTarget {
    pub project_path: String,
    pub target_path: String,
    pub project_name: String,
    pub target_size: u64,
}

#[derive(Serialize, Clone)]
pub struct ProgressInfo {
    pub root: String,
    pub current: u64,
    pub total: u64,
    pub ignored: u64,
}

#[command]
pub fn get_drives() -> Vec<String> {
    #[cfg(windows)]
    {
        (b'A'..=b'Z')
            .filter_map(|c| {
                let drive = format!("{}:\\", c as char);
                Path::new(&drive)
                    .metadata()
                    .ok()
                    .filter(|m| m.is_dir())
                    .map(|_| drive)
            })
            .collect()
    }
    #[cfg(not(windows))]
    {
        vec!["/".to_string()]
    }
}

#[command]
pub fn list_dir(path: String) -> Vec<FileEntry> {
    let mut entries = vec![];
    if let Ok(read_dir) = std::fs::read_dir(&path) {
        for entry in read_dir.flatten() {
            let path_buf = entry.path();
            let meta = entry.metadata().ok();
            let size = meta
                .as_ref()
                .and_then(|m| if m.is_file() { Some(m.len()) } else { None });
            let modified = meta.as_ref().and_then(|m| m.modified().ok()).map(|t| {
                use chrono::{DateTime, Local};
                let dt: DateTime<Local> = t.into();
                dt.format("%Y-%m-%d %H:%M").to_string()
            });
            entries.push(FileEntry {
                path: path_buf.display().to_string(),
                is_dir: meta.as_ref().map(|m| m.is_dir()).unwrap_or(false),
                size,
                modified,
            });
        }
    }
    entries
}

#[command]
pub fn search_files(path: String, pattern: String) -> Result<(), String> {
    tauri::async_runtime::spawn(async move {
        let results = do_search_files(path, pattern);
        // Émettre un événement Tauri avec les résultats
        // (à adapter selon ton front)
        // app_handle.emit("search_results", results).unwrap();
    });
    Ok(())
}

fn do_search_files(path: String, pattern: String) -> Vec<FileEntry> {
    let mut results = vec![];
    fn search_dir(dir: &Path, pattern: &str, results: &mut Vec<FileEntry>) {
        // Liste des noms de dossiers à ignorer partout
        let ignored_names = [
            "node_modules",
            ".git",
            "target",
            "venv",
            "__pycache__",
            "dist",
            "build",
            "out",
            "bin",
            "obj",
            // Ajoute d'autres noms si besoin
        ];
        if let Ok(read_dir) = std::fs::read_dir(dir) {
            for entry in read_dir.flatten() {
                let path_buf = entry.path();
                let meta = entry.metadata().ok();
                let is_dir = meta.as_ref().map(|m| m.is_dir()).unwrap_or(false);
                let size = meta
                    .as_ref()
                    .and_then(|m| if m.is_file() { Some(m.len()) } else { None });
                let modified = meta.as_ref().and_then(|m| m.modified().ok()).map(|t| {
                    use chrono::{DateTime, Local};
                    let dt: DateTime<Local> = t.into();
                    dt.format("%Y-%m-%d %H:%M").to_string()
                });
                let name = path_buf.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if name.contains(pattern) {
                    results.push(FileEntry {
                        path: path_buf.display().to_string(),
                        is_dir,
                        size,
                        modified,
                    });
                }
                if is_dir {
                    search_dir(&path_buf, pattern, results);
                }
            }
        }
    }
    search_dir(Path::new(&path), &pattern, &mut results);
    results
}

#[tauri::command]
pub async fn find_targets_with_cargo(path: String) -> Vec<ProjectTarget> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut results = vec![];
        search_dir(Path::new(&path), &mut results);
        results
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub async fn find_targets_with_cargo_multi(paths: Vec<String>) -> Vec<ProjectTarget> {
    let ignored_dirs = vec![
        "C:\\Windows",
        "C:\\Program Files",
        "C:\\Program Files (x86)",
        "C:\\$Recycle.Bin",
        "C:\\Users\\All Users",
        "C:\\ProgramData",
        "C:\\System Volume Information",
        "C:\\Recovery",
        "C:\\PerfLogs",
        "C:\\MSOCache",
        "C:\\Documents and Settings",
        "C:\\msys64",
    ];
    let handles: Vec<_> = paths
        .into_iter()
        .map(|root| {
            let ignored_dirs = ignored_dirs.clone();
            std::thread::spawn(move || {
                let mut local_results = Vec::new();
                search_dir_multi(Path::new(&root), &mut local_results, &ignored_dirs);
                local_results
            })
        })
        .collect();

    let mut all_results = Vec::new();
    for h in handles {
        if let Ok(res) = h.join() {
            all_results.extend(res);
        }
    }
    all_results
}

fn search_dir(dir: &Path, results: &mut Vec<ProjectTarget>) {
    println!("Exploration de : {}", dir.display());
    // Liste des dossiers à ignorer (Windows)
    let ignored_dirs = [
        "C:\\Windows",
        "C:\\Program Files",
        "C:\\Program Files (x86)",
        "C:\\$Recycle.Bin",
        "C:\\Users\\All Users",
        "C:\\ProgramData",
        "C:\\System Volume Information",
        "C:\\Recovery",
        "C:\\PerfLogs",
        "C:\\MSOCache",
        "C:\\Documents and Settings",
        "C:\\msys64",
    ];
    // Si le dossier courant est à ignorer, on arrête
    if let Some(dir_str) = dir.to_str() {
        for ignored in &ignored_dirs {
            if dir_str.eq_ignore_ascii_case(ignored) {
                println!("Ignoré : {}", dir.display());
                return;
            }
        }
    }
    println!("Début de l'analyse pour la racine : {}", dir.display());
    std::io::stdout().flush().unwrap();
    if let Ok(read_dir) = std::fs::read_dir(dir) {
        let mut has_cargo = false;
        let mut target_path = None;
        for entry in read_dir.flatten() {
            let path = entry.path();
            if path.is_file() && path.file_name().map(|n| n == "Cargo.toml").unwrap_or(false) {
                has_cargo = true;
            }
            if path.is_dir() && path.file_name().map(|n| n == "target").unwrap_or(false) {
                target_path = Some(path.clone());
            }
        }
        if has_cargo {
            if let Some(target) = target_path {
                results.push(ProjectTarget {
                    project_path: dir.display().to_string(),
                    target_path: target.display().to_string(),
                    project_name: dir
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string(),
                    target_size: get_dir_size(&target),
                });
            }
            // On ne descend pas plus loin dans ce dossier
            return;
        }
        // Sinon, on continue la recherche récursive
        for entry in std::fs::read_dir(dir).unwrap().flatten() {
            let path = entry.path();
            if path.is_dir() {
                search_dir(&path, results);
            }
        }
    }
}

fn search_dir_multi(dir: &Path, results: &mut Vec<ProjectTarget>, ignored_dirs: &[&str]) {
    let ignored_names = [
        "node_modules",
        ".git",
        "venv",
        "__pycache__",
        "dist",
        "build",
        "out",
        "bin",
        "obj",
        "pkgs",
        "pkg",
        "src",
    ];
    if let Some(dir_str) = dir.to_str() {
        for ignored in ignored_dirs {
            if dir_str.eq_ignore_ascii_case(ignored) {
                return;
            }
        }
    }
    if let Ok(read_dir) = std::fs::read_dir(dir) {
        let mut has_cargo = false;
        let mut target_path = None;
        for entry in read_dir.flatten() {
            let path = entry.path();
            if path.is_file() && path.file_name().map(|n| n == "Cargo.toml").unwrap_or(false) {
                has_cargo = true;
            }
            if path.is_dir() && path.file_name().map(|n| n == "target").unwrap_or(false) {
                target_path = Some(path.clone());
            }
        }
        if has_cargo {
            if let Some(target) = target_path {
                let project_name = dir
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let target_size = get_dir_size(&target);
                results.push(ProjectTarget {
                    project_path: dir.display().to_string(),
                    target_path: target.display().to_string(),
                    project_name,
                    target_size,
                });
            }
            return;
        }
        for entry in std::fs::read_dir(dir).unwrap().flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if ignored_names.iter().any(|&n| n.eq_ignore_ascii_case(name)) {
                        continue;
                    }
                }
                search_dir_multi(&path, results, ignored_dirs);
            }
        }
    }
}

#[tauri::command]
pub async fn find_targets_with_cargo_multi_progress(
    app: AppHandle,
    paths: Vec<String>,
) -> Vec<ProjectTarget> {
    let results = Arc::new(Mutex::new(Vec::new()));
    let ignored_dirs = vec![
        "C:\\Windows",
        "C:\\Program Files",
        "C:\\Program Files (x86)",
        "C:\\$Recycle.Bin",
        "C:\\Users\\All Users",
        "C:\\ProgramData",
        "C:\\System Volume Information",
        "C:\\Recovery",
        "C:\\PerfLogs",
        "C:\\MSOCache",
        "C:\\Documents and Settings",
        "C:\\msys64",
    ];
    let ignored_names = [
        "node_modules",
        ".git",
        "venv",
        "__pycache__",
        "dist",
        "build",
        "out",
        "bin",
        "obj",
        "pkgs",
        "pkg",
        "src",
        ".cache",
        ".vscode",
    ];
    let cancel_flag = CANCEL_FLAG
        .get_or_init(|| Arc::new(AtomicBool::new(false)))
        .clone();
    cancel_flag.store(false, Ordering::SeqCst);
    let handles: Vec<_> = paths
        .iter()
        .map(|root| {
            let root = root.clone();
            let app = app.clone();
            let results = Arc::clone(&results);
            let ignored_dirs = ignored_dirs.clone();
            let ignored_names = ignored_names.clone();
            let cancel_flag = cancel_flag.clone();
            std::thread::spawn(move || {
                let current = Arc::new(AtomicU64::new(0));
                let total = Arc::new(AtomicU64::new(0));
                let ignored = Arc::new(AtomicU64::new(0));
                let mut local_results = Vec::new();
                search_dir_streaming(
                    Path::new(&root),
                    &mut local_results,
                    &ignored_dirs,
                    &ignored_names,
                    &current,
                    &total,
                    &app,
                    &root,
                    &cancel_flag,
                    &ignored,
                );
                results.lock().unwrap().extend(local_results);
            })
        })
        .collect();
    for h in handles {
        let _ = h.join();
    }
    Arc::try_unwrap(results).unwrap().into_inner().unwrap()
}

fn search_dir_streaming(
    dir: &Path,
    results: &mut Vec<ProjectTarget>,
    ignored_dirs: &[&str],
    ignored_names: &[&str],
    current: &Arc<AtomicU64>,
    total: &Arc<AtomicU64>,
    app: &AppHandle,
    root: &str,
    cancel_flag: &Arc<AtomicBool>,
    ignored: &Arc<AtomicU64>,
) {
    if cancel_flag.load(Ordering::SeqCst) {
        return;
    }
    let is_root = dir.to_str().map(|s| s == root).unwrap_or(false);
    if let Some(dir_str) = dir.to_str() {
        for ignored_dir in ignored_dirs {
            if dir_str.eq_ignore_ascii_case(ignored_dir) {
                ignored.fetch_add(1, Ordering::SeqCst);
                total.fetch_add(1, Ordering::SeqCst);
                return;
            }
        }
    }
    if let Some(name) = dir.file_name().and_then(|n| n.to_str()) {
        if ignored_names.iter().any(|&n| n.eq_ignore_ascii_case(name)) {
            ignored.fetch_add(1, Ordering::SeqCst);
            total.fetch_add(1, Ordering::SeqCst);
            return;
        }
    }
    let c = current.fetch_add(1, Ordering::SeqCst) + 1;
    let t = total.fetch_add(1, Ordering::SeqCst) + 1;
    let i = ignored.load(Ordering::SeqCst);
    let _ = app.emit(
        "cargo_scan_progress",
        ProgressInfo {
            root: root.to_string(),
            current: c,
            total: t,
            ignored: i,
        },
    );
    std::thread::sleep(std::time::Duration::from_millis(1));
    if let Ok(read_dir) = std::fs::read_dir(dir) {
        let mut has_cargo = false;
        let mut target_path = None;
        for entry in read_dir.flatten() {
            if cancel_flag.load(Ordering::SeqCst) {
                return;
            }
            let path = entry.path();
            if path.is_file() && path.file_name().map(|n| n == "Cargo.toml").unwrap_or(false) {
                has_cargo = true;
            }
            if path.is_dir() && path.file_name().map(|n| n == "target").unwrap_or(false) {
                target_path = Some(path.clone());
            }
        }
        if has_cargo {
            if let Some(target) = target_path {
                let project_name = dir
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let target_size = get_dir_size(&target);
                let project = ProjectTarget {
                    project_path: dir.display().to_string(),
                    target_path: target.display().to_string(),
                    project_name,
                    target_size,
                };
                results.push(project.clone());
                let _ = app.emit("cargo_project_found", &project);
            }
            if is_root {
                let _ = app.emit("cargo_scan_done", root);
            }
            return;
        }
        for entry in std::fs::read_dir(dir).unwrap().flatten() {
            if cancel_flag.load(Ordering::SeqCst) {
                return;
            }
            let path = entry.path();
            if path.is_dir() {
                search_dir_streaming(
                    &path,
                    results,
                    ignored_dirs,
                    ignored_names,
                    current,
                    total,
                    app,
                    root,
                    cancel_flag,
                    ignored,
                );
            }
        }
    }
    if is_root {
        let _ = app.emit("cargo_scan_done", root);
    }
}

fn get_dir_size(path: &Path) -> u64 {
    let mut size = 0;
    if let Ok(read_dir) = std::fs::read_dir(path) {
        for entry in read_dir.flatten() {
            let path = entry.path();
            if path.is_dir() {
                size += get_dir_size(&path);
            } else if let Ok(metadata) = path.metadata() {
                size += metadata.len();
            }
        }
    }
    size
}

#[tauri::command]
pub fn cancel_scan() {
    if let Some(flag) = CANCEL_FLAG.get() {
        flag.store(true, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Non supporté sur cette plateforme".to_string())
    }
}
