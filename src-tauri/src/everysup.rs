use once_cell::sync::OnceCell;
use serde::Serialize;
use std::{
    path::Path,
    process::Command,
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
    sync::mpsc::channel,
    sync::Arc,
    time::Instant,
    collections::HashSet,
    fs,
    thread,
    time::Duration,
};
use tauri::{command, AppHandle, Emitter};
use walkdir::{DirEntry, WalkDir};

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
    pub fullname: String,
    pub target_size: u64,
    pub errors: u64,
}

#[derive(Serialize, Clone)]
pub struct ProgressInfo {
    pub root: String,
    pub current: u64,
    pub total: u64,
    pub ignored: u64,
}

#[derive(Serialize, Clone, Debug)]
pub struct ScanResult {
    pub projects: Vec<ProjectTarget>,
    pub ignored_paths: Vec<String>,
}

#[cfg(windows)]
const IGNORED_DIRS: &[&str] = &[
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
    "C:\\vcpkg",
];

#[cfg(not(windows))]
const IGNORED_DIRS: &[&str] = &[
    "/proc",
    "/sys",
    "/dev",
    "/run",
    "/tmp",
    "/var/tmp",
    "/var/cache",
    "/var/log",
    "/snap",
    "/mnt",
    "/media",
    "/lost+found",
];

const IGNORED_NAMES: &[&str] = &[
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
    "ports",
];

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
pub async fn find_targets_with_cargo_multi_progress(
    app: AppHandle,
    paths: Vec<String>,
) -> ScanResult {
    let ignored_dirs = IGNORED_DIRS;
    let ignored_names = IGNORED_NAMES;
    let cancel_flag = CANCEL_FLAG
        .get_or_init(|| Arc::new(AtomicBool::new(false)))
        .clone();
    cancel_flag.store(false, Ordering::SeqCst);

    let (tx, rx) = channel();
    let paths_for_done = paths.clone();
    for root in paths {
        let tx = tx.clone();
        let app = app.clone();
        let cancel_flag = cancel_flag.clone();
        thread::spawn(move || {
            let mut local_results = Vec::with_capacity(50);
            let mut local_ignored = Vec::new();
            let current = Arc::new(AtomicU64::new(0));
            let total = Arc::new(AtomicU64::new(0));
            let ignored = Arc::new(AtomicU64::new(0));
            fast_scan_emit(
                Path::new(&root),
                &mut local_results,
                ignored_dirs,
                ignored_names,
                &current,
                &total,
                &app,
                &root,
                &cancel_flag,
                &ignored,
                &mut local_ignored,
            );
            let _ = tx.send((local_results, local_ignored));
        });
    }
    drop(tx);

    let mut all_results = Vec::new();
    let mut all_ignored = Vec::new();
    let mut seen_targets = HashSet::new();
    for (results, ignored) in rx.iter() {
        for project in results {
            if seen_targets.insert(project.target_path.clone()) {
                all_results.push(project);
            }
        }
        all_ignored.extend(ignored);
    }

    let _ = app.emit("cargo_scan_done", &paths_for_done);
    ScanResult {
        projects: all_results,
        ignored_paths: all_ignored,
    }
}

fn fast_scan_emit(
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
    ignored_list: &mut Vec<String>,
) {
    let mut dirs_processed = 0;
    let mut last_progress = Instant::now();
    let mut first_emit = true;
    let is_ignored_dir = |entry: &DirEntry| {
        if let Some(path_str) = entry.path().to_str() {
            for ignored_dir in ignored_dirs {
                if path_str.eq_ignore_ascii_case(ignored_dir) || path_str.starts_with(ignored_dir) {
                    return true;
                }
            }
        }
        false
    };
    let is_ignored_name = |entry: &DirEntry| {
        if let Some(name) = entry.file_name().to_str() {
            ignored_names.iter().any(|&n| n.eq_ignore_ascii_case(name))
        } else {
            false
        }
    };
    let walker = WalkDir::new(dir)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            if entry.depth() == 0 {
                return true;
            }
            if entry.file_type().is_dir() && (is_ignored_dir(entry) || is_ignored_name(entry)) {
                return false;
            }
            true
        });
    let mut found = 0;
    let mut progress_info = ProgressInfo {
        root: root.to_string(),
        current: 0,
        total: 0,
        ignored: 0,
    };
    for entry in walker.filter_map(|e| e.ok()) {
        if cancel_flag.load(Ordering::SeqCst) {
            return;
        }
        dirs_processed += 1;
        let c = current.fetch_add(1, Ordering::SeqCst) + 1;
        let t = total.fetch_add(1, Ordering::SeqCst) + 1;
        let i = ignored.load(Ordering::SeqCst);
        if first_emit {
            progress_info.current = c;
            progress_info.total = t;
            progress_info.ignored = i;
            let _ = app.emit("cargo_scan_progress", &progress_info);
            first_emit = false;
        } else if last_progress.elapsed() > Duration::from_millis(500) {
            progress_info.current = c;
            progress_info.total = t;
            progress_info.ignored = i;
            let _ = app.emit("cargo_scan_progress", &progress_info);
            last_progress = Instant::now();
        }
        if entry.depth() == 0 {
            continue;
        }
        if is_ignored_dir(&entry) || is_ignored_name(&entry) {
            ignored.fetch_add(1, Ordering::SeqCst);
            total.fetch_add(1, Ordering::SeqCst);
            ignored_list.push(entry.path().display().to_string());
            continue;   
        }
        if entry.file_type().is_file() && entry.file_name().to_str() == Some("Cargo.toml") {
            if let Some(parent) = entry.path().parent() {
                let target = parent.join("target");
                if target.exists() && target.is_dir() {
                    let project_name = parent
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();
                    let fullname = if let Some(parent_name) = parent.parent().and_then(|p| p.file_name()).and_then(|n| n.to_str()) {
                        format!("{}{}{}", parent_name, std::path::MAIN_SEPARATOR, project_name)
                    } else {
                        project_name.clone()
                    };
                    let target_size = get_dir_size_walkdir(&target);
                    let project = ProjectTarget {
                        project_path: parent.display().to_string(),
                        target_path: target.display().to_string(),
                        project_name,
                        fullname,
                        target_size,
                        errors: 0,
                    };
                    results.push(project.clone());
                    let _ = app.emit("cargo_project_found", &project);
                    found += 1;
                }
            }
        }
    }
    println!("[STATS] Dossiers traités: {} | Projets trouvés: {}", dirs_processed, found);
}

fn get_dir_size_walkdir(path: &Path) -> u64 {
    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .map(|e| e.metadata().map(|m| m.len()).unwrap_or(0))
        .sum()
}

#[command]
pub fn cancel_scan() {
    if let Some(flag) = CANCEL_FLAG.get() {
        flag.store(true, Ordering::SeqCst);
    }
}

#[command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Non supporté sur cette plateforme".to_string())
    }
}

#[command]
pub fn delete_targets(app: AppHandle, paths: Vec<String>) -> Result<(), String> {
    thread::spawn(move || {
        let total_size: u64 = paths.iter()
            .map(|path| get_dir_size_walkdir(Path::new(path)))
            .sum();

        let mut deleted = 0u64;
        let _ = app.emit("delete-progress", (0.0, 0, total_size));

        for path in paths {
            let p = Path::new(&path);
            let size = get_dir_size_walkdir(p);
            let _ = fs::remove_dir_all(p);

            if p.exists() {
                let _ = app.emit("delete-pending", path.clone());
                wait_until_deleted(p);
            }

            deleted += size;
            let progress = (deleted as f64 / total_size as f64) * 100.0;
            let _ = app.emit("delete-progress", (progress, deleted, total_size));
            thread::sleep(Duration::from_millis(100));
        }

        let _ = app.emit("delete-progress", (100.0, total_size, total_size));
        let _ = app.emit("delete-finished", ());
    });

    Ok(())
}

fn wait_until_deleted(path: &Path) {
    while path.exists() {
        thread::sleep(Duration::from_millis(200));
    }
}