# Clay Pigeon Shooting Competition

A browser game by Hewmorist. Each round has 24 clays, released at ten-second intervals, with one shot per clay.

## Playing

Press **Start** to begin. Drag the display with a mouse or use the **Aim Track Pad** to move the crosshair. Press **Fire** or the spacebar to shoot.

**Interceptor** is on by default for a visible blue interceptor that approaches from behind the viewpoint. Turn it off for a fast ballistic shot. In both modes, the crosshair must be inside the clay’s outline when fired to lock onto its centre; otherwise the shot misses.

**Voice** controls the spoken announcements independently of the gun and clay-breakup sounds. The round button changes between Start, Stop, Resume and Next.

## Deployment

This branch contains the complete static deployment package at its root. No build step or dependency installation is required. Serve the files over HTTP or HTTPS; opening index.html directly from a file browser is not supported.

For GitHub Pages, select the **clay-pigeon-game** branch and the **/ (root)** folder in the repository’s Pages settings. The .nojekyll file keeps the deployment as static files.

The browser needs WebGL2 and WebAssembly. Audio starts after the player interacts with the game. Speech recordings are included as MP3 files. The inherited SoundCloud player can contact SoundCloud.

## Release

Game revision **clay-pigeon-game-33**. Development notes, tests, source-generation files and build dependencies are excluded from this package.

Copyright © 2026 Peter Hew (Hewmorist). No license is granted by publication of this repository.
