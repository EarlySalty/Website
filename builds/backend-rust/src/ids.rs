use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::RngCore;

pub fn token_urlsafe(bytes: usize) -> String {
    let mut raw = vec![0_u8; bytes];
    rand::thread_rng().fill_bytes(&mut raw);
    URL_SAFE_NO_PAD.encode(raw)
}

pub fn id16() -> String {
    token_urlsafe(16)
}

pub fn id12() -> String {
    token_urlsafe(12)
}
