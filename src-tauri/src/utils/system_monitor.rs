use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use sysinfo::{System, Disks, Networks};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemMetrics {
    pub timestamp: u64,
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub gpu: GpuMetrics,
    pub disk: DiskMetrics,
    pub network: NetworkMetrics,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CpuMetrics {
    pub usage_percent: f32,
    pub cores: Vec<f32>, // Per-core CPU usage
    pub frequency_mhz: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryMetrics {
    pub used_bytes: u64,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f32,
    pub swap_used_bytes: u64,
    pub swap_total_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GpuMetrics {
    pub usage_percent: Option<f32>,
    pub memory_used_bytes: Option<u64>,
    pub memory_total_bytes: Option<u64>,
    pub temperature_celsius: Option<f32>,
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiskMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkMetrics {
    pub received_bytes: u64,
    pub transmitted_bytes: u64,
    pub received_packets: u64,
    pub transmitted_packets: u64,
}

// Global system instance (thread-safe)
lazy_static::lazy_static! {
    static ref SYSTEM: Arc<Mutex<System>> = Arc::new(Mutex::new(System::new_all()));
    static ref DISKS: Arc<Mutex<Disks>> = Arc::new(Mutex::new(Disks::new_with_refreshed_list()));
    static ref NETWORKS: Arc<Mutex<Networks>> = Arc::new(Mutex::new(Networks::new_with_refreshed_list()));
    static ref LAST_UPDATE: Arc<Mutex<Instant>> = Arc::new(Mutex::new(Instant::now()));
}

#[tauri::command]
pub fn get_system_metrics() -> Result<SystemMetrics, String> {
    let mut system = SYSTEM.lock().map_err(|e| format!("Failed to lock system: {}", e))?;
    let mut last_update = LAST_UPDATE.lock().map_err(|e| format!("Failed to lock last_update: {}", e))?;
    
    // Refresh system info (need to wait a bit for accurate CPU usage)
    let elapsed = last_update.elapsed();
    if elapsed < Duration::from_millis(100) {
        // Wait a bit more for accurate CPU readings
        std::thread::sleep(Duration::from_millis(100 - elapsed.as_millis() as u64));
    }
    
    system.refresh_cpu_all();
    system.refresh_memory();
    *last_update = Instant::now();
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    // CPU Metrics
    let cpu_usage = system.global_cpu_usage();
    let cpu_frequency = system.cpus().first().map(|c| c.frequency()).unwrap_or(0);
    let cpu_cores: Vec<f32> = system.cpus().iter().map(|cpu| cpu.cpu_usage()).collect();
    
    // Memory Metrics
    let total_memory = system.total_memory();
    let used_memory = system.used_memory();
    let available_memory = system.available_memory();
    let memory_usage_percent = if total_memory > 0 {
        (used_memory as f32 / total_memory as f32) * 100.0
    } else {
        0.0
    };
    
    let swap_total = system.total_swap();
    let swap_used = system.used_swap();
    
    // Disk Metrics (use first disk or root)
    let mut disks = DISKS.lock().map_err(|e| format!("Failed to lock disks: {}", e))?;
    disks.refresh();
    let disk = disks.iter().next();
    let (disk_total, disk_used, disk_available) = if let Some(disk) = disk {
        let total = disk.total_space();
        let available = disk.available_space();
        let used = total.saturating_sub(available);
        (total, used, available)
    } else {
        (0, 0, 0)
    };
    let disk_usage_percent = if disk_total > 0 {
        (disk_used as f32 / disk_total as f32) * 100.0
    } else {
        0.0
    };
    
    // Network Metrics (aggregate all interfaces)
    let mut networks = NETWORKS.lock().map_err(|e| format!("Failed to lock networks: {}", e))?;
    networks.refresh();
    let mut received_bytes = 0u64;
    let mut transmitted_bytes = 0u64;
    let mut received_packets = 0u64;
    let mut transmitted_packets = 0u64;
    
    for (_interface_name, network) in networks.iter() {
        received_bytes += network.received();
        transmitted_bytes += network.transmitted();
        received_packets += network.packets_received();
        transmitted_packets += network.packets_transmitted();
    }
    
    // GPU Metrics (basic - sysinfo doesn't have GPU support, so we'll use None for now)
    // For actual GPU monitoring, we'd need platform-specific libraries
    let gpu_metrics = GpuMetrics {
        usage_percent: None,
        memory_used_bytes: None,
        memory_total_bytes: None,
        temperature_celsius: None,
        name: None,
    };
    
    Ok(SystemMetrics {
        timestamp,
        cpu: CpuMetrics {
            usage_percent: cpu_usage,
            cores: cpu_cores,
            frequency_mhz: cpu_frequency,
        },
        memory: MemoryMetrics {
            used_bytes: used_memory,
            total_bytes: total_memory,
            available_bytes: available_memory,
            usage_percent: memory_usage_percent,
            swap_used_bytes: swap_used,
            swap_total_bytes: swap_total,
        },
        gpu: gpu_metrics,
        disk: DiskMetrics {
            total_bytes: disk_total,
            used_bytes: disk_used,
            available_bytes: disk_available,
            usage_percent: disk_usage_percent,
        },
        network: NetworkMetrics {
            received_bytes,
            transmitted_bytes,
            received_packets,
            transmitted_packets,
        },
    })
}

#[tauri::command]
pub fn get_detailed_system_info() -> Result<SystemInfo, String> {
    let system = SYSTEM.lock().map_err(|e| format!("Failed to lock system: {}", e))?;
    
    Ok(SystemInfo {
        hostname: System::host_name().unwrap_or_else(|| "Unknown".to_string()),
        os_name: System::name().unwrap_or_else(|| "Unknown".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".to_string()),
        kernel_version: System::kernel_version().unwrap_or_else(|| "Unknown".to_string()),
        cpu_count: system.cpus().len(),
        cpu_brand: system.cpus().first().map(|c| c.brand().to_string()).unwrap_or_else(|| "Unknown".to_string()),
        total_memory: system.total_memory(),
        uptime_seconds: System::boot_time(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub hostname: String,
    pub os_name: String,
    pub os_version: String,
    pub kernel_version: String,
    pub cpu_count: usize,
    pub cpu_brand: String,
    pub total_memory: u64,
    pub uptime_seconds: u64,
}

#[tauri::command]
pub fn start_system_monitoring() -> Result<(), String> {
    // Initialize system monitoring
    let mut system = SYSTEM.lock().map_err(|e| format!("Failed to lock system: {}", e))?;
    system.refresh_all();
    *LAST_UPDATE.lock().unwrap() = Instant::now();
    Ok(())
}

