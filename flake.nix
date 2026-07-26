{
  description = "Substrate — Aevum personal site platform";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };

        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rust-analyzer" "rustfmt" "clippy" ];
          targets = [ "wasm32-unknown-unknown" "wasm32-wasip1" ];
        };

        nodejs = pkgs.nodejs_22;
        pnpm = pkgs.nodePackages.pnpm;
        bun = pkgs.bun;

      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            rustToolchain
            nodejs
            pnpm
            bun
            pkgs.wasm-pack
            pkgs.cargo-watch
            pkgs.cargo-deny
            pkgs.cargo-audit
            pkgs.postgresql_17
            pkgs.pkg-config
            pkgs.openssl
          ];

          shellHook = ''
            echo "🜂 Substrate devshell — Aevum"
            echo "  Node:  $(node --version)"
            echo "  pnpm:  $(pnpm --version)"
            echo "  Bun:   $(bun --version)"
            echo "  Rust:  $(rustc --version)"
            echo "  WASM:  wasm-pack $(wasm-pack --version)"
          '';
        };

        packages.dockerImage = pkgs.dockerTools.buildImage {
          name = "substrate";
          tag = "latest";
          config = {
            Cmd = [ "${nodejs}/bin/node" "--version" ];
          };
        };
      };
}
