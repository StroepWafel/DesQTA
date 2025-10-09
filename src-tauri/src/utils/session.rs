use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{self, Read, Write},
    path::PathBuf,
};
use crate::logger;
use ring::{
    aead::{Aad, BoundKey, Nonce, NonceSequence, OpeningKey, SealingKey, UnboundKey, AES_256_GCM},
    error::Unspecified,
    rand::{SecureRandom, SystemRandom},
};
use zeroize::Zeroize;

/// Custom nonce sequence for AES-GCM
struct CounterNonceSequence(u32);

impl NonceSequence for CounterNonceSequence {
    fn advance(&mut self) -> Result<Nonce, Unspecified> {
        let mut nonce_bytes = [0u8; 12];
        let counter_bytes = self.0.to_le_bytes();
        nonce_bytes[..4].copy_from_slice(&counter_bytes);
        self.0 += 1;
        Nonce::try_assume_unique_for_key(&nonce_bytes)
    }
}

/// Encryption utilities for session data
struct SessionEncryption;

impl SessionEncryption {
    /// Get encryption key from OS keychain or generate new one
    fn get_or_create_key() -> Result<Vec<u8>, String> {
        let entry = keyring::Entry::new("DesQTA", "session_encryption_key")
            .map_err(|e| format!("Failed to access keyring: {}", e))?;

        // Try to get existing key
        match entry.get_password() {
            Ok(key_b64) => {
                // Decode from base64
                base64::decode(&key_b64)
                    .map_err(|e| format!("Failed to decode encryption key: {}", e))
            }
            Err(_) => {
                // Generate new key
                let rng = SystemRandom::new();
                let mut key = vec![0u8; 32]; // 256 bits
                rng.fill(&mut key)
                    .map_err(|e| format!("Failed to generate encryption key: {:?}", e))?;

                // Store in keychain
                let key_b64 = base64::encode(&key);
                entry
                    .set_password(&key_b64)
                    .map_err(|e| format!("Failed to store encryption key: {}", e))?;

                Ok(key)
            }
        }
    }

    /// Encrypt data using AES-256-GCM
    fn encrypt(data: &[u8]) -> Result<Vec<u8>, String> {
        let mut key_bytes = Self::get_or_create_key()?;

        let unbound_key = UnboundKey::new(&AES_256_GCM, &key_bytes)
            .map_err(|e| format!("Failed to create encryption key: {:?}", e))?;

        let nonce_sequence = CounterNonceSequence(0);
        let mut sealing_key = SealingKey::new(unbound_key, nonce_sequence);

        let mut in_out = data.to_vec();
        sealing_key
            .seal_in_place_append_tag(Aad::empty(), &mut in_out)
            .map_err(|e| format!("Failed to encrypt data: {:?}", e))?;

        // Clear sensitive key from memory
        key_bytes.zeroize();

        Ok(in_out)
    }

    /// Decrypt data using AES-256-GCM
    fn decrypt(encrypted_data: &[u8]) -> Result<Vec<u8>, String> {
        let mut key_bytes = Self::get_or_create_key()?;

        let unbound_key = UnboundKey::new(&AES_256_GCM, &key_bytes)
            .map_err(|e| format!("Failed to create decryption key: {:?}", e))?;

        let nonce_sequence = CounterNonceSequence(0);
        let mut opening_key = OpeningKey::new(unbound_key, nonce_sequence);

        let mut in_out = encrypted_data.to_vec();
        let decrypted = opening_key
            .open_in_place(Aad::empty(), &mut in_out)
            .map_err(|e| format!("Failed to decrypt data: {:?}", e))?;

        // Clear sensitive key from memory
        key_bytes.zeroize();

        Ok(decrypted.to_vec())
    }

    /// Clear encryption key from keychain
    fn clear_key() -> Result<(), String> {
        let entry = keyring::Entry::new("DesQTA", "session_encryption_key")
            .map_err(|e| format!("Failed to access keyring: {}", e))?;

        entry
            .delete_password()
            .map_err(|e| format!("Failed to delete encryption key: {}", e))
    }
}

/// Location: `$DATA_DIR/DesQTA/session.enc`
#[allow(dead_code)]
pub fn session_file() -> PathBuf {
    #[cfg(target_os = "android")]
    {
        // On Android, use the app's internal storage directory
        let mut dir = PathBuf::from("/data/data/com.desqta.app/files");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("session.enc"); // Changed to .enc extension
        dir
    }
    #[cfg(not(target_os = "android"))]
    {
        // e.g. %APPDATA%/DesQTA on Windows, ~/.local/share/DesQTA on Linux/macOS
        let mut dir = dirs_next::data_dir().expect("Unable to determine data dir");
        dir.push("DesQTA");
        if !dir.exists() {
            fs::create_dir_all(&dir).expect("Unable to create data dir");
        }
        dir.push("session.enc"); // Changed to .enc extension
        dir
    }
}

/// Saved session state.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Session {
    pub base_url: String,
    pub jsessionid: String,
    pub additional_cookies: Vec<Cookie>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Cookie {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
}

#[allow(dead_code)]
impl Session {
    /// Load from disk with decryption; returns empty/default if none.
    pub fn load() -> Self {
        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::DEBUG,
                "session",
                "load",
                "Loading encrypted session from disk",
                serde_json::json!({})
            );
        }

        let path = session_file();
        
        // First try encrypted file
        if path.exists() {
            if let Ok(encrypted_data) = fs::read(&path) {
                if let Ok(decrypted_data) = SessionEncryption::decrypt(&encrypted_data) {
                    if let Ok(mut json_str) = String::from_utf8(decrypted_data) {
                        if let Ok(sess) = serde_json::from_str::<Session>(&json_str) {
                            // Clear sensitive data from memory
                            json_str.zeroize();
                            
                            if let Some(logger) = logger::get_logger() {
                                let _ = logger.log(
                                    logger::LogLevel::DEBUG,
                                    "session",
                                    "load",
                                    "Encrypted session loaded successfully",
                                    serde_json::json!({"has_base_url": !sess.base_url.is_empty()})
                                );
                            }
                            return sess;
                        }
                    }
                }
            }
        }

        // Fallback: try to load old unencrypted session.json and migrate
        let old_path = {
            let mut p = path.clone();
            p.set_file_name("session.json");
            p
        };

        if old_path.exists() {
            if let Ok(mut file) = fs::File::open(&old_path) {
                let mut contents = String::new();
                if file.read_to_string(&mut contents).is_ok() {
                    if let Ok(sess) = serde_json::from_str::<Session>(&contents) {
                        if let Some(logger) = logger::get_logger() {
                            let _ = logger.log(
                                logger::LogLevel::INFO,
                                "session",
                                "load",
                                "Migrating old unencrypted session to encrypted format",
                                serde_json::json!({})
                            );
                        }

                        // Save in encrypted format
                        let _ = sess.save();

                        // Remove old unencrypted file
                        let _ = fs::remove_file(&old_path);

                        // Clear sensitive data from memory
                        contents.zeroize();

                        return sess;
                    }
                }
            }
        }

        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::DEBUG,
                "session",
                "load",
                "No existing session found, creating default",
                serde_json::json!({})
            );
        }

        Session {
            base_url: String::new(),
            jsessionid: String::new(),
            additional_cookies: Vec::new(),
        }
    }

    /// Persist to disk with encryption.
    pub fn save(&self) -> io::Result<()> {
        let path = session_file();
        
        // Serialize to JSON
        let mut json_data = serde_json::to_string(self)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

        // Encrypt the data
        let encrypted_data = SessionEncryption::encrypt(json_data.as_bytes())
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;

        // Clear sensitive data from memory
        json_data.zeroize();

        // Write encrypted data to file
        let mut file = fs::File::create(path)?;
        file.write_all(&encrypted_data)?;

        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::DEBUG,
                "session",
                "save",
                "Session saved with encryption",
                serde_json::json!({})
            );
        }

        Ok(())
    }

    /// True if both URL and cookie are present.
    pub fn exists() -> bool {
        let s = Self::load();
        !(s.base_url.is_empty() || s.jsessionid.is_empty())
    }

    /// Clear the session data, remove the file, and clear encryption key
    pub fn clear_file() -> io::Result<()> {
        // Remove encrypted session file
        let path = session_file();
        if path.exists() {
            fs::remove_file(&path)?;
        }

        // Also remove old unencrypted file if it exists
        let old_path = {
            let mut p = path.clone();
            p.set_file_name("session.json");
            p
        };
        if old_path.exists() {
            fs::remove_file(&old_path)?;
        }

        // Clear encryption key from keychain
        if let Err(e) = SessionEncryption::clear_key() {
            if let Some(logger) = logger::get_logger() {
                let _ = logger.log(
                    logger::LogLevel::WARN,
                    "session",
                    "clear_file",
                    "Failed to clear encryption key from keychain",
                    serde_json::json!({"error": e})
                );
            }
        }

        if let Some(logger) = logger::get_logger() {
            let _ = logger.log(
                logger::LogLevel::INFO,
                "session",
                "clear_file",
                "Session cleared and encryption key removed",
                serde_json::json!({})
            );
        }

        Ok(())
    }
}
