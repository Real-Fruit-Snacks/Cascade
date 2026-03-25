use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::tungstenite::Message;

#[derive(Debug, Clone)]
pub struct ClientInfo {
    pub connected_at: u128,
}

pub struct VaultAuth {
    pub password_hash: String,
}

impl VaultAuth {
    pub fn new(password: &str) -> Result<Self, String> {
        if password.len() < 8 {
            return Err("Password must be at least 8 characters".to_string());
        }
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| format!("Failed to hash password: {}", e))?
            .to_string();
        Ok(VaultAuth {
            password_hash: hash,
        })
    }

    pub fn verify(&self, password: &str) -> bool {
        let parsed = match PasswordHash::new(&self.password_hash) {
            Ok(h) => h,
            Err(_) => return false,
        };
        Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok()
    }
}

pub struct RelayServer {
    pub auth: VaultAuth,
    pub clients: Arc<RwLock<HashMap<SocketAddr, ClientInfo>>>,
    pub tx: broadcast::Sender<(SocketAddr, Message)>,
    pub shutdown: tokio::sync::watch::Sender<bool>,
}

impl RelayServer {
    pub async fn start(password: String, app_handle: AppHandle) -> Result<(Arc<Self>, u16), String> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| format!("Failed to bind listener: {}", e))?;

        let port = listener
            .local_addr()
            .map_err(|e| format!("Failed to get local addr: {}", e))?
            .port();

        let (tx, _) = broadcast::channel(1024);
        let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);

        let server = Arc::new(RelayServer {
            auth: VaultAuth::new(&password)?,
            clients: Arc::new(RwLock::new(HashMap::new())),
            tx,
            shutdown: shutdown_tx,
        });

        let server_clone = Arc::clone(&server);
        tokio::spawn(async move {
            Self::accept_loop(listener, server_clone, shutdown_rx, app_handle).await;
        });

        Ok((server, port))
    }

    async fn accept_loop(
        listener: TcpListener,
        server: Arc<Self>,
        mut shutdown_rx: tokio::sync::watch::Receiver<bool>,
        app_handle: AppHandle,
    ) {
        loop {
            tokio::select! {
                result = listener.accept() => {
                    match result {
                        Ok((stream, addr)) => {
                            let server_clone = Arc::clone(&server);
                            let app_clone = app_handle.clone();
                            tokio::spawn(async move {
                                Self::handle_connection(stream, addr, server_clone, app_clone).await;
                            });
                        }
                        Err(e) => {
                            eprintln!("[collab] Accept error: {}", e);
                        }
                    }
                }
                _ = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() {
                        break;
                    }
                }
            }
        }
    }

    async fn handle_connection(
        stream: TcpStream,
        addr: SocketAddr,
        server: Arc<Self>,
        app_handle: AppHandle,
    ) {
        let ws_stream = match tokio_tungstenite::accept_async(stream).await {
            Ok(ws) => ws,
            Err(e) => {
                eprintln!("[collab] WebSocket handshake failed for {}: {}", addr, e);
                return;
            }
        };

        let (mut sink, mut stream) = ws_stream.split();

        // First message must be the password
        let auth_msg = match stream.next().await {
            Some(Ok(msg)) => msg,
            _ => {
                eprintln!("[collab] No auth message from {}", addr);
                return;
            }
        };

        let password = match auth_msg {
            Message::Text(ref text) => text.to_string(),
            _ => {
                eprintln!("[collab] Auth message not text from {}", addr);
                let _ = sink.send(Message::Text("AUTH_FAILED".to_string().into())).await;
                return;
            }
        };

        if !server.auth.verify(&password) {
            eprintln!("[collab] Auth failed for {}", addr);
            let _ = sink.send(Message::Text("AUTH_FAILED".to_string().into())).await;
            return;
        }

        let _ = sink.send(Message::Text("AUTH_OK".to_string().into())).await;

        // Register client
        {
            let mut clients = server.clients.write().await;
            clients.insert(
                addr,
                ClientInfo {
                    connected_at: crate::collab::presence::now_ms(),
                },
            );
            let count = clients.len();
            drop(clients);
            let _ = app_handle.emit("collab://status", serde_json::json!({ "connectedClients": count }));
        }

        let mut rx = server.tx.subscribe();
        let server_clone = Arc::clone(&server);
        let app_clone = app_handle.clone();

        // Spawn relay task: broadcast -> this client's sink
        let mut shutdown_rx = server.shutdown.subscribe();
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    result = rx.recv() => {
                        match result {
                            Ok((sender_addr, msg)) => {
                                if sender_addr != addr {
                                    if sink.send(msg).await.is_err() {
                                        break;
                                    }
                                }
                            }
                            Err(broadcast::error::RecvError::Lagged(n)) => {
                                eprintln!("collab: client {addr} lagged {n} msgs, forcing reconnect for resync");
                                break; // Disconnect — client will reconnect and resync via Yjs protocol
                            }
                            Err(broadcast::error::RecvError::Closed) => break,
                        }
                    }
                    _ = shutdown_rx.changed() => {
                        if *shutdown_rx.borrow() {
                            break;
                        }
                    }
                }
            }
        });

        // Read loop: stream -> broadcast
        let mut shutdown_rx2 = server_clone.shutdown.subscribe();
        loop {
            tokio::select! {
                msg = stream.next() => {
                    match msg {
                        Some(Ok(Message::Binary(data))) => {
                            let _ = server_clone.tx.send((addr, Message::Binary(data)));
                        }
                        Some(Ok(Message::Text(text))) => {
                            let _ = server_clone.tx.send((addr, Message::Text(text)));
                        }
                        Some(Ok(Message::Close(_))) | None => break,
                        Some(Err(e)) => {
                            eprintln!("[collab] Stream error from {}: {}", addr, e);
                            break;
                        }
                        _ => {}
                    }
                }
                _ = shutdown_rx2.changed() => {
                    if *shutdown_rx2.borrow() {
                        break;
                    }
                }
            }
        }

        // Deregister client
        {
            let mut clients = server_clone.clients.write().await;
            clients.remove(&addr);
            let count = clients.len();
            drop(clients);
            let _ = app_clone.emit("collab://status", serde_json::json!({ "connectedClients": count }));
        }
    }

    pub async fn client_count(&self) -> usize {
        self.clients.read().await.len()
    }

    pub fn stop(&self) {
        let _ = self.shutdown.send(true);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vault_auth_roundtrip() {
        let auth = VaultAuth::new("correct-horse-battery-staple").unwrap();
        assert!(auth.verify("correct-horse-battery-staple"));
        assert!(!auth.verify("wrong-password"));
        assert!(!auth.verify(""));
    }

    #[test]
    fn test_vault_auth_rejects_short_password() {
        assert!(VaultAuth::new("").is_err());
        assert!(VaultAuth::new("short").is_err());
        assert!(VaultAuth::new("1234567").is_err());
        assert!(VaultAuth::new("12345678").is_ok());
    }

    #[test]
    fn test_vault_auth_bad_hash() {
        let auth = VaultAuth {
            password_hash: "not-a-valid-hash".to_string(),
        };
        // Should return false, not panic
        assert!(!auth.verify("anything"));
    }
}
