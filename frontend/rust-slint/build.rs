// Compile `ui/app.slint` to a strongly-typed Rust module. The result
// is included from `src/main.rs` via `slint::include_modules!()`.
fn main() {
    slint_build::compile("ui/app.slint").expect("slint compile");
}
