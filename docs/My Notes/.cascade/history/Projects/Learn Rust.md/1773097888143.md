---
status: in-progress
priority: medium
started: 2026-02-01
tags: [project, coding, learning]
---

# Learn Rust

#project #coding #learning

## Why Rust

After spending time in TypeScript and reading [[The Pragmatic Programmer]], I kept hitting walls with runtime errors that a stricter type system would have caught at compile time. Rust's ownership model forces you to think about memory and correctness upfront — painful at first, genuinely liberating after. Also directly applicable: Cascade is built on Tauri, which is Rust under the hood, so understanding the backend makes me a better contributor.

Related: [[Build a Personal Website]] | [[Career Development]] | [[The Pragmatic Programmer]]

---

## Learning Path

1. **The Book** — [The Rust Programming Language](https://doc.rust-lang.org/book/) (free online)
2. **Rustlings** — small exercises that follow The Book chapter by chapter
3. **Exercism Rust track** — 100 practice problems, community mentorship
4. **Zero To Production in Rust** — production-grade web service, Actix-web
5. **Contribute to Cascade backend** — real-world Tauri commands and error handling

---

## Progress

| Resource | Status | Notes |
|----------|--------|-------|
| The Book Ch. 1–6 | Done | Ownership clicked in Ch. 4 |
| The Book Ch. 7–12 | Done | Modules, error handling, iterators |
| The Book Ch. 13–20 | In progress | On Ch. 15 — smart pointers |
| Rustlings | Done | 94/94 exercises |
| Exercism (first 20) | Done | |
| Exercism (21–50) | In progress | |
| Zero To Production | Not started | Scheduled for April |

---

## Key Concepts

### Ownership and Borrowing

The central idea: every value has a single owner; ownership can be transferred (moved) or temporarily lent (borrowed). This eliminates a whole class of bugs without a garbage collector.

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1; // s1 is MOVED — no longer valid

    // println!("{}", s1); // compile error: value used after move
    println!("{}", s2); // fine

    let s3 = String::from("world");
    let len = calculate_length(&s3); // borrow, not move
    println!("'{}' has {} characters", s3, len); // s3 still valid
}

fn calculate_length(s: &String) -> usize {
    s.len()
} // s goes out of scope but doesn't drop — it's a borrow
```

### Error Handling with Result

Rust has no exceptions. Functions that can fail return `Result<T, E>`, forcing callers to handle both paths explicitly.

```rust
use std::fs;
use std::io;

fn read_config(path: &str) -> Result<String, io::Error> {
    let content = fs::read_to_string(path)?; // ? propagates error up
    Ok(content)
}

fn main() {
    match read_config("config.toml") {
        Ok(data) => println!("Config loaded: {} bytes", data.len()),
        Err(e) => eprintln!("Failed to load config: {}", e),
    }
}
```

### Lifetimes (conceptual note)

Lifetimes annotate how long references are valid. The compiler infers most of them; explicit annotations (`'a`) appear when the compiler can't. Still wrapping my head around this — see Ch. 10 notes.

---

## Resources

- [[The Pragmatic Programmer]] — general programming wisdom that pairs well
- [[Build a Personal Website]] — motivation to ship something with this knowledge
- [[Career Development]] — Rust is increasingly valued in systems and backend roles
- [The Rust Book (online)](https://doc.rust-lang.org/book/)
- [Rustlings](https://github.com/rust-lang/rustlings)
- [Exercism Rust Track](https://exercism.org/tracks/rust)
- [Rust By Example](https://doc.rust-lang.org/rust-by-example/)
