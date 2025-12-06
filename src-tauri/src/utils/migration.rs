use crate::logger;
use crate::profiles;
use crate::session;
use serde_json;
use std::fs;
use std::io::Read;
use std::path::PathBuf;

/// Get the old data directory (before profiles)
fn old_data_dir() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        dir
    }
    #[cfg(not(target_os = "android"))]
    {
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        dir
    }
}

/// Migrate existing files to profile-based structure
pub fn migrate_to_profiles_system() -> Result<(), String> {
    // Check if migration already completed
    if profiles::ProfileManager::is_migration_completed() {
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::DEBUG,
                "migration",
                "migrate_to_profiles_system",
                "Migration already completed, skipping",
                serde_json::json!({}),
            );
        }
        return Ok(());
    }

    if let Some(logger) = logger::get_logger() {
        let _ = logger.log(
            logger::LogLevel::INFO,
            "migration",
            "migrate_to_profiles_system",
            "Starting migration to profiles system",
            serde_json::json!({}),
        );
    }

    let old_dir = old_data_dir();
    
    // Try to load existing session from old location directly (before profile system)
    // For migration, we'll prioritize session.json (simpler to load)
    // If only session.enc exists, we'll create a placeholder profile and user will need to login again
    let old_session_json = old_dir.join("session.json");
    let old_session_enc = old_dir.join("session.enc");
    
    let existing_session = if old_session_json.exists() {
        // Try to load plain JSON session
        if let Ok(mut file) = fs::File::open(&old_session_json) {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                serde_json::from_str::<session::Session>(&contents).ok()
            } else {
                None
            }
        } else {
            None
        }
    } else if old_session_enc.exists() {
        // Encrypted session exists but we can't easily decrypt it during migration
        // Create a placeholder session - user will need to login again
        // But we can still migrate other files
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::INFO,
                "migration",
                "migrate_to_profiles_system",
                "Encrypted session found but cannot decrypt during migration - user will need to login again",
                serde_json::json!({}),
            );
        }
        None
    } else {
        None
    };
    
    // If we have a valid session, create a profile for it
    // Otherwise, we'll migrate files without creating a profile (user will login again)
    let profile_dir_opt = if let Some(sess) = existing_session {
        if !sess.base_url.is_empty() && !sess.jsessionid.is_empty() {
            // Create profile from existing session
            // Use placeholder user_id - will be updated on next login
            let user_id = 0;
            let display_name = None;
            
            match profiles::ProfileManager::get_or_create_profile(
                sess.base_url.clone(),
                user_id,
                display_name,
            ) {
                Ok(profile) => {
                    let profile_dir = profiles::get_profile_dir(&profile.id);
                    // Set as current profile
                    let _ = profiles::ProfileManager::set_current_profile(profile.id.clone());
                    Some(profile_dir)
                }
                Err(e) => {
                    if let Some(logger) = logger::get_logger() {
                        let _ = logger.log(
                            logger::LogLevel::WARN,
                            "migration",
                            "migrate_to_profiles_system",
                            &format!("Failed to create profile: {}", e),
                            serde_json::json!({}),
                        );
                    }
                    None
                }
            }
        } else {
            None
        }
    } else {
        // No session or encrypted session - skip profile creation
        // Files will be migrated to a default location if needed
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::INFO,
                "migration",
                "migrate_to_profiles_system",
                "No valid session found - files will be migrated but user will need to login again",
                serde_json::json!({}),
            );
        }
        None
    };
    
    // If no profile was created, we'll still migrate files but they'll go to a default location
    // The user will login and create a proper profile, then files can be moved
    let profile_dir = if let Some(dir) = profile_dir_opt {
        dir
    } else {
        // Use default profile directory for migration
        profiles::get_profile_dir("default")
    };

    // List of files to migrate
    let files_to_migrate = vec![
        ("settings.json", "settings.json"),
        ("session.json", "session.json"),
        ("session.enc", "session.enc"),
        ("seqtaConfig.json", "seqtaConfig.json"),
        ("analytics.json", "analytics.json"),
        ("global_search.json", "global_search.json"),
        ("cloud_token.json", "cloud_token.json"),
        ("desqta.db", "desqta.db"),
    ];

    // Migrate each file
    for (old_filename, new_filename) in files_to_migrate {
        let old_path = old_dir.join(old_filename);
        let new_path = profile_dir.join(new_filename);

        if old_path.exists() {
            // Only migrate if destination doesn't exist (don't overwrite)
            if !new_path.exists() {
                if let Err(e) = fs::copy(&old_path, &new_path) {
                    if let Some(logger) = logger::get_logger() {
                        let _ = logger.log(
                            logger::LogLevel::WARN,
                            "migration",
                            "migrate_to_profiles_system",
                            &format!("Failed to copy {}: {}", old_filename, e),
                            serde_json::json!({"file": old_filename}),
                        );
                    }
                    // Continue with other files
                    continue;
                }

                if let Some(logger) = logger::get_logger() {
                    let _ = logger.log(
                        logger::LogLevel::INFO,
                        "migration",
                        "migrate_to_profiles_system",
                        &format!("Migrated {}", old_filename),
                        serde_json::json!({"file": old_filename}),
                    );
                }

                // Create backup by renaming old file
                let backup_path = old_dir.join(format!("{}.old", old_filename));
                if let Err(e) = fs::rename(&old_path, &backup_path) {
                    if let Some(logger) = logger::get_logger() {
                        let _ = logger.log(
                            logger::LogLevel::WARN,
                            "migration",
                            "migrate_to_profiles_system",
                            &format!("Failed to backup {}: {}", old_filename, e),
                            serde_json::json!({"file": old_filename}),
                        );
                    }
                }
            } else {
                // Destination exists, just backup old file
                let backup_path = old_dir.join(format!("{}.old", old_filename));
                if old_path.exists() && !backup_path.exists() {
                    if let Err(e) = fs::rename(&old_path, &backup_path) {
                        if let Some(logger) = logger::get_logger() {
                            let _ = logger.log(
                                logger::LogLevel::WARN,
                                "migration",
                                "migrate_to_profiles_system",
                                &format!("Failed to backup {}: {}", old_filename, e),
                                serde_json::json!({"file": old_filename}),
                            );
                        }
                    }
                }
            }
        }
    }

    // Mark migration as completed
    profiles::ProfileManager::mark_migration_completed()?;

    if let Some(logger) = logger::get_logger() {
        let mut log_data = serde_json::json!({});
        if let Some(current_profile) = profiles::ProfileManager::get_current_profile() {
            log_data["profile_id"] = serde_json::json!(current_profile.id);
        }
        let _ = logger.log(
            logger::LogLevel::INFO,
            "migration",
            "migrate_to_profiles_system",
            "Migration completed successfully",
            log_data,
        );
    }

    Ok(())
}

