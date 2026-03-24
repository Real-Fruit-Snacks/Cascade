pub mod commands;
pub mod presence;
pub mod server;

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CollabRole {
    Host,
    Client,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollabStatus {
    pub active: bool,
    pub role: Option<CollabRole>,
    pub connected_clients: usize,
    pub server_port: Option<u16>,
    pub host_address: Option<String>,
}

pub struct CollabServerState(pub TokioMutex<Option<Arc<server::RelayServer>>>);

pub struct CollabConfig(pub std::sync::Mutex<CollabConfigInner>);

#[derive(Debug, Clone, Default)]
pub struct CollabConfigInner {
    pub role: Option<CollabRole>,
    pub server_port: Option<u16>,
    pub host_address: Option<String>,
}

pub struct HeartbeatHandle(pub TokioMutex<Option<tokio::task::JoinHandle<()>>>);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_collab_role_serialization() {
        let host = CollabRole::Host;
        let json = serde_json::to_string(&host).unwrap();
        assert_eq!(json, "\"host\"");

        let client = CollabRole::Client;
        let json = serde_json::to_string(&client).unwrap();
        assert_eq!(json, "\"client\"");
    }

    #[test]
    fn test_collab_role_deserialization() {
        let host: CollabRole = serde_json::from_str("\"host\"").unwrap();
        assert_eq!(host, CollabRole::Host);

        let client: CollabRole = serde_json::from_str("\"client\"").unwrap();
        assert_eq!(client, CollabRole::Client);
    }

    #[test]
    fn test_collab_status_serialization() {
        let status = CollabStatus {
            active: true,
            role: Some(CollabRole::Host),
            connected_clients: 2,
            server_port: Some(8080),
            host_address: Some("192.168.1.1".to_string()),
        };
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"active\":true"));
        assert!(json.contains("\"role\":\"host\""));
        assert!(json.contains("\"connectedClients\":2"));
        assert!(json.contains("\"serverPort\":8080"));
        assert!(json.contains("\"hostAddress\":\"192.168.1.1\""));
    }
}
