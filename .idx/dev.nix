{ pkgs, ... }: {
  channel = "stable-23.11";
  
  packages = [ 
    pkgs.nodejs_20  # Use underscore and a version available
  ];

  idx.extensions = [ "svelte.svelte-vscode" "vue.volar" ];

  idx.previews = {
    enable = true; # Required to activate the preview panel
    previews = {
      web = {
        command = [ "npm" "run" "dev" "--" "--port" "$PORT" "--host" "0.0.0.0" ];
        manager = "web";
      };
    };
  };
}