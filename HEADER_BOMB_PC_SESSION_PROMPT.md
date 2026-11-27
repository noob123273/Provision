# HEADER BOMB — PC Session Starter Prompt

> **How to use:** On your PC, open Roblox Studio (your place open, Studio MCP on, Assistant → Settings → MCP Permissions → **game-pass:write** ON). Open the Claude desktop app → **Code** → start a **local** session (not cloud) in `C:\Users\user\Documents\InfinityTagAssets\`. Paste **everything below the line**.

---

## STEP 0 — SESSION SETUP (do this before anything else, no permission needed)

1. **Check the machine.** Run and report versions of: `git`, `python`, `ffmpeg`, `yt-dlp`, `blender` (5.2+), `rojo`, `node`. Install anything missing **without admin/sudo**:
   - yt-dlp: `python -m pip install --user -U yt-dlp`
   - ffmpeg: `winget install --id Gyan.FFmpeg -e` (or extract the static build into `C:\Users\user\Documents\InfinityTagAssets\tools\ffmpeg` and add it to PATH for this session)
   - Rojo: `aftman`/`rokit` or the GitHub release binary into `...\InfinityTagAssets\tools\`
   - Blender: if `blender` isn't on PATH, find it under `C:\Program Files\Blender Foundation\` and use the full path to `blender.exe`.
2. **Install the skills:**
   ```
   /plugin marketplace add bradautomates/claude-video
   /plugin install watch@claude-video

   /plugin marketplace add EL4CTEO/blender-skills
   /plugin install blender-agent-skills@blender-agent-skills
   ```
   - If `watch@claude-video` fails, install **watch-video** (Anthropic Directory) instead; for transcripts also try **TubeAlfred YouTube**. If no video skill works, do it by hand: `yt-dlp -f "bv*+ba/b" -o references/raw/video_N.%(ext)s <url>` + `ffmpeg -i video_N.mp4 -vsync 0 references/frames/video_N/%06d.png` (native fps) + `yt-dlp --write-auto-subs --skip-download`.
   - Run `/reload-plugins` (or restart the session) and **confirm both skills load** by listing them.
3. **Confirm the Roblox Studio MCP is connected:** list its tools, read the place's current hierarchy (Workspace, ReplicatedStorage, ServerScriptService, StarterPlayer, StarterGui) and write a short inventory to `HeaderBomb/EXISTING_PLACE.md` so nothing existing gets overwritten or duplicated.
4. **Set up the project folder** `C:\Users\user\Documents\InfinityTagAssets\HeaderBomb\` with:
   ```
   HeaderBomb\
     PROGRESS.md            <- update after every phase
     references\            <- video_N_notes.md, STYLE_BIBLE.md, frames\, raw\
     blender\               <- .blend sources
     exports\               <- .fbx/.glb Roblox-preset exports
     textures\              <- flipbooks, sparks, smoke, rings, UI PNGs
     audio\                 <- synthesized / CC0 sounds + LICENSES.md
     game\                  <- Rojo project (default.project.json, src\shared, src\server, src\client)
   ```
   - A skeleton already exists on GitHub: repo `noob123273/Provision`, branch `claude/new-session-sn6tma`, folder `HeaderBomb/` (`default.project.json` + `src/shared/Config.luau`). Pull those two files in as a starting point if useful; otherwise start fresh. The Provision repo itself is unrelated — don't modify it.
   - Initialise git in `HeaderBomb\game\` so code changes are tracked locally.
5. **Resume rule:** if `HeaderBomb\PROGRESS.md` already exists, read it first and continue from where it stopped. Never redo finished phases.

## STEP 0b — EXTRA RULES LEARNED SO FAR

- Big frame counts: don't stop at keyframes. Extract **every frame at native fps**, review in sequential batches (e.g. 300 frames per batch, contact sheets of 5×6 thumbnails are fine for review, plus full-size frames for key moments), and keep a running counter in `PROGRESS.md` like `Video 4: frames 1201–1500 / 5400`.
- Delete raw video files and frame PNGs only after that video's notes are written (disk space); keep the contact sheets and key-moment frames.
- Sync code into Studio with the Studio MCP (create/edit scripts directly) **or** Rojo (`rojo serve` + Rojo Studio plugin). Pick one and stick to it, never both, so there are no duplicate scripts.
- Sounds: only Creator Store free audio, CC0, or audio you synthesize (e.g. Python + numpy/scipy, sox or ffmpeg filters). Log every sound's source and licence in `audio\LICENSES.md`.
- Upload assets (meshes, textures, decals, audio, animations) with **Open Cloud under group 33143184**. If no Open Cloud API key is available, tell me once which permissions the key needs (Assets read/write for the group) and keep going with other work.
- Take Studio screenshots after each major step and link them in `PROGRESS.md`.

---

## 0. WHO YOU ARE & HOW YOU WORK

You are a Senior Roblox Game Architect, Principal Luau Engineer, and Technical Artist (Blender → Roblox pipeline). You are building **HEADER BOMB**, an explosive 4–8 player elimination football (soccer) game inspired by *Volley Bomb*, *Blade Ball* and *Blue Lock* anime style. It must look and feel like a top modern Roblox game, not cheap or old-Roblox.

### My working rules (follow every time)
- **Don't ask me for permission. I'm often AFK.** Do the work, then tell me what you did. Only stop for something that can't be undone.
- **Never destroy my existing project.** Change scripts carefully instead of rebuilding them. Check other scripts and UI before editing anything shared.
- **No duplicate scripts or remotes. Don't break DataStore saves.**
- **The server decides** coins, eliminations, wins, purchases, spins and codes. Never trust the client.
- **Game passes and cosmetics give no gameplay advantage.**
- **Everything must work on mobile.**
- **Playtest your changes**, check the Output console, fix bugs, and take screenshots when you can. **Save the place** after big changes that work. **Do not publish.**
- **Good free sounds, not default Roblox sounds. Good music.** Only use sounds/music I'm allowed to use (Roblox Creator Store free audio, CC0, or sounds you synthesize). No copyrighted songs.
- I like **Evade** and **Huss Valley** style games. That includes **bots that fill empty servers using my friends' names and avatars**, and they **only appear in matches, not the lobby**.
- All game passes and uploaded assets go in my Roblox group **"Dealt damage" (group id 33143184)**.
- Asset files go in my approved upload folder `C:\Users\user\Documents\InfinityTagAssets\HeaderBomb\` (make the `HeaderBomb` subfolder), then get uploaded with **Open Cloud under the group**.
- Creating game passes needs the **game-pass:write** permission in Studio: Assistant → Settings → MCP Permissions. If it's off, tell me once.
- **Figma trick for UI images:** Figma's `get_screenshot` saves PNGs with a grey background. Render each UI piece on a black background AND a white background, work out the transparency from the two, then upload as decals and 9-slice them in Roblox.

---

## 1. INSTALL THESE TWO SKILLS FIRST

Run these, then confirm both skills load:

```
/plugin marketplace add bradautomates/claude-video
/plugin install watch@claude-video

/plugin marketplace add EL4CTEO/blender-skills
/plugin install blender-agent-skills@blender-agent-skills
```

- **watch** (claude-video): downloads videos with yt-dlp, extracts frames with ffmpeg, pulls transcripts. Run its setup check and install any missing binaries (yt-dlp, ffmpeg) without sudo.
- **blender-agent-skills**: 28 Blender skills (modeling, UV, texturing, rigging, animation, game optimization, **Roblox export preset**, asset QA, stylized/NPR, environment kits, lighting). Start every Blender task from `blender-core`, run `blender-asset-qa` before export, and export with `blender-export-pipelines` using the `roblox` preset.

If a skill fails to install or run, tell me exactly what's missing, then continue with everything else.

---

## 2. PHASE 1 — WATCH ALL 9 REFERENCE VIDEOS (EVERY FRAME, NO SKIPPING)

Use the **watch** skill on every one of these:

1. https://www.youtube.com/watch?v=k-gZzN-hHgQ
2. https://www.youtube.com/watch?v=QGFvQdzakUU
3. https://www.youtube.com/shorts/dCRrNDM-yg0
4. https://www.youtube.com/watch?v=hwHLIUGYyhs
5. https://www.youtube.com/watch?v=jsWDHQ6X098
6. https://www.youtube.com/watch?v=WH82tQ9ywZM
7. https://www.youtube.com/shorts/1DJJalUZgwg
8. https://www.youtube.com/shorts/AfV1kgCyVpI
9. https://www.youtube.com/watch?v=_Zy1Cmp7T-g

**Rules for watching:**
- Watch **all 9**. Do not skip any video and **do not skip frames**. Extract frames at the video's native frame rate (use the watch skill's maximum density setting, or run ffmpeg directly at native fps if the skill caps it).
- Long videos have thousands of frames: go through them **in sequential batches** until every frame of every video has been reviewed. Keep a progress counter (e.g. "Video 4: frames 1201–1500 of 5400 reviewed").
- Also read the transcript/captions for each video.
- For each video, write `references/video_N_notes.md` containing:
  - **Ball:** shape, panel pattern, colors, size vs character, fuse/bomb details, glow, trail, how it changes as the fuse burns.
  - **Court/arena:** square layout, sizes, boundary lines, materials, colors, what's around the court.
  - **Lobby:** layout, props, leaderboards, shops, spawn, lighting.
  - **UI:** every screen and HUD element, colors, fonts, button style, animations, layout on mobile vs PC.
  - **VFX:** hit effects, spike effects, dive effects, explosion (frame-by-frame timing: flash, fireball, smoke, shockwave, debris, scorch), ability effects, elimination effects, camera shake/FOV/hit-stop.
  - **SFX & music:** what each action sounds like, when sounds trigger, music mood/tempo.
  - **Animations:** bump, spike, dive, idle, run, jump, ability poses, victory, elimination/ragdoll — key poses and timing in frames.
  - **Timestamps** for the best reference moments.
- Then write `references/STYLE_BIBLE.md` that combines all 9 into one clear art, VFX, SFX, UI and animation direction for HEADER BOMB. **Adapt everything from volleyball to football (soccer)**: bump → juggle/header, spike → power volley/bicycle kick, dive → goalie dive/slide.
- **Be original:** use the videos for feel, layout, timing and quality bar only. Don't copy another game's logos, exact UI art, characters or assets.

---

## 3. PHASE 2 — BLENDER: MODELS, ANIMATIONS, VFX MESHES

Use the Blender skills (`blender-core` first). Match the quality and detail in `STYLE_BIBLE.md`. Keep every mesh Roblox-ready: **≤ 10k triangles per MeshPart** (hard limit 20k), real-world scale (Roblox character ≈ 5 studs), named parts, applied transforms, clean normals, UVs and baked textures (`blender-texture-baking`) where materials need detail, exported with the **roblox** preset. Save `.blend` sources and exports into `C:\Users\user\Documents\InfinityTagAssets\HeaderBomb\`.

(I already have a starter pack of simple low-poly .glb blockouts — bomb football, practice ball, 2x2/3x3 arena, stadium, glass sky-lounge, leaderboard pillar, ability spin pedestal, AFK pad, practice juggle zone. If you find `HeaderBomb_Models.zip` in my Downloads, use it for scale/layout reference only and build much more detailed versions.)

### 3a. Models
1. **Bomb Football** (hero asset): proper stitched football panels with seams, metal fuse cap with bolts, braided fuse, spark tip, emissive "fuse glow" ring/cracks that can be driven from script (separate part named `FuseGlow`). Also a **Bomb Volleyball-style variant** skin.
2. **Practice Ball** (non-explosive).
3. **Ball skins** (cosmetic only): at least 6 (e.g. Classic, Neon Cyber, Lava Core, Ice Crystal, Galaxy, Gold Legend).
4. **Arena grid**: modular turf square (24×24 studs) with chalk lines, hazard edge, per-square name/number plate; glowing laser boundary rails with pylons at intersections; builds into **2×2** and **3×3** layouts. Each square named `Square_<row>_<col>`.
5. **Futuristic neon stadium bowl** around the arena: tiered seats, aisles, LED ad ring, floodlight rigs, roof canopy, tunnels, hanging jumbotron.
6. **Glass Sky-Lounge** lobby above the arena: frosted glass floor panels (players see the live match beneath their feet), glass railings, neon rim lighting, support pillars, spawn pad, seating, bar/lounge props, plants, canopy.
7. **Lobby props:** 3 **Global Leaderboard Pillars** (Top Wins, Top Eliminations, Top Win Streak) with a `BoardFace` part for the SurfaceGui and gold/silver/bronze trophy tops; **AFK toggle pad**; **Practice Juggle Zone**; **Ability Spin Pedestal** with a rotating gacha wheel (rarity segments Common/Rare/Epic/Legendary) and a floating crystal.
8. **Explosion VFX meshes:** shockwave ring, fireball shell, crater/scorch, debris chunks, landing-shadow marker for the ball's predicted landing spot.

### 3b. Animations (R15, for Roblox)
Rig with `blender-character-rigging` using the **Roblox R15** skeleton, animate with `blender-animation`, export per the Roblox preset, then import to Studio with the Animation Editor/Importer and upload to the group. One clip per action, named clearly, correct priority (Action for attacks, Movement for runs):

- Juggle / Set (knee or foot pop-up), Header, Chest Trap
- Power Volley (grounded), **Bicycle Kick** (airborne, big anime wind-up)
- Goalie Dive (left/right), Slide Tackle
- Ability casts: Knuckleball, Mag-Cleats, Time Trap, Meteor Header (teleport up + slam)
- Idle (sporty bounce), Ready stance, Victory dance ×3, Eliminated (blast reaction before ragdoll), Lobby emotes ×3

Use anticipation, smears/overshoot and hold frames so hits feel heavy (anime style). Keep timing snappy: hit frame within 0.12–0.2 s of input.

---

## 4. PHASE 3 — VFX & SFX

### VFX (Roblox ParticleEmitters, Beams, Trails, Attachments, Highlight, mesh FX)
Build a `VFXLibrary` ModuleScript in ReplicatedStorage with presets: ball trail (speeds up and reddens with fuse intensity), hit spark burst, juggle pop ring, power volley shockwave + speed lines, bicycle kick anime aura, dive dust/grass kick-up, landing-shadow marker that shrinks as the ball approaches, fuse sparks, **detonation** (white flash → fireball flipbook → smoke → shockwave ring → debris → scorch decal → light flash), elimination ragdoll knockback, ability effects (Knuckleball curve trail, Mag-Cleats magnetic pull lines, Time Trap freeze sphere + clock ring, Meteor Header fire trail + crater), win confetti, coin pop. Make textures (flipbooks, sparks, smoke, rings) in Blender or procedurally, upload to the group.

Game feel is mandatory: **hit-stop frames, FOV kicks, camera shake, screen flash, anime aura trails, explosive ragdolls.**

### SFX & music
Juggle tap, header thud, power volley whack + whoosh, bicycle kick swing, dive cloth swoosh + thump, ball bounce, fuse hiss loop (pitch rises with intensity), ticking that speeds up, detonation boom + debris, elimination sting, countdown beeps, round start horn, win fanfare, UI click/hover, coin, crate/spin ticks + reveal per rarity, ability sounds ×4, crowd ambience + cheers on big plays. Lobby music and match music (energetic, free-to-use). Use free Creator Store audio or synthesize originals; never default Roblox sounds.

---

## 5. PHASE 4 — THE ROBLOX GAME (Luau, `--!strict`)

Build in Studio (use the Studio MCP tools). Structure for Rojo/standard Studio: `ReplicatedStorage`, `ServerScriptService`, `StarterPlayerScripts`. **No `-- TODO`s, no empty functions, every script complete and working.**

### Core loop
- Arena: 2×2 (4 players) or 3×3 (up to 8–9). Each square owned by one active player, separated by glowing laser boundary lines.
- A glowing, ticking **Bomb Football** is launched in. If it touches your square's turf, goes out of bounds off your touch, or you exceed **2 consecutive touches** without passing to another square, it **detonates**: you're ragdolled and eliminated. Last player standing wins.
- Rounds last 30–60 s. Every hit increases ball speed and fuse intensity.
- **Bots** fill empty slots in matches only (friends' names + avatars via `Players:GetFriendsAsync` / `GetHumanoidDescriptionFromUserId`), with believable reaction delays and occasional mistakes.

### Physics
Server-authoritative custom ball (no default Roblox physics): deterministic parabolic trajectory + raycast steps on `RunService.Heartbeat`, square detection, boundary detection, elimination explosions. Client-side interpolation and visual trails so hits feel instant on PC and mobile. Show a **landing-shadow marker** and a **touch counter (0/2)**.
- Touch 1 pops the ball up inside your own square (juggle/set). Touch 2 (or jumping on touch 1) launches it to the opponent square you're aiming/looking at, with generous soft-lock aim assist.

### Controls (`ContextActionService`, PC / Mobile / Console)
1. Juggle / Set: Left Click / Mobile Button 1 / R2
2. Power Volley / Bicycle Kick: Jump + Left Click / Mobile Button 2 (bicycle kick + heavy shake if airborne)
3. Goalie Dive / Slide: E / Mobile Button 3 / R1 (expanded hitbox to save low balls)
4. Active Ability: Q / Mobile Button 4 / L2

Mobile buttons appear automatically when `UserInputService.TouchEnabled` is true; big, thumb-friendly, never overlapping the jump button.

### Abilities (gacha spin / coin shop)
1. Knuckleball (Common): curves the ball sharply into the corner of the target square.
2. Mag-Cleats (Rare): pulls a nearby ball toward your feet.
3. Time Trap (Epic): freezes the ball mid-air in your square for 1.2 s before you launch it.
4. Meteor Header (Legendary): teleports above the ball and slams it down at 2× speed with a fiery crater.
All cooldowns and effects validated on the server.

### Data & leaderboards
`ProfileService` (or DataStoreService with session locking + retries) saving: `Coins`, `Wins`, `Eliminations`, `WinStreak`, `BestStreak`, `OwnedAbilities`, `EquippedAbility`, `OwnedBallSkins`, `OwnedExplosionVFX`, `DailyQuestProgress`. `OrderedDataStore` sync every 60 s to the 3D lobby leaderboards (Top 50 Wins, Eliminations, Win Streak) with avatar headshots and gold/silver/bronze badges.

### Lobby
Glass Sky-Lounge above the live arena, 3 leaderboard pillars, AFK pad, Practice Juggle Zone (non-explosive ball), Ability Spin Pedestal.

### UI
**Style decision:** my rules ask for chunky **"stud UI"** (square simulator-style buttons and panels with studs, designed in Figma) and the original brief asked for frosted **glassmorphism**. Use **stud-style chunky buttons and panels as the main style**, with frosted-glass (dark translucent, `UICorner`, cyan `UIStroke`) for HUD overlays like the timer and kill-feed. *(Edit this line if I want pure stud or pure glass.)*
- HUD: top-center round timer + alive count; bottom-center hotbar (Juggle, Power Volley, Dive, Ability with radial cooldown); left icon buttons (Abilities/Spin, Shop/Crates, Inventory, Quests, Leaderboards); right kill-feed; touch counter; fuse intensity meter.
- Menus: Spin/gacha with rarity reveal animation, Shop (ball skins, explosion VFX: cosmetic only), Inventory/equip, Daily Quests, Leaderboards.
- Scale cleanly with `UIAspectRatioConstraint` and `UISizeConstraint`; test on phone, tablet and PC resolutions in the device emulator.

### Monetization (cosmetic only, in group 33143184)
Game passes such as VIP chat tag + cosmetic trail, 2× Coins, extra ball skin slots. No gameplay advantage.

### Security
Validate every hit distance, timing, cooldown, square ownership, ability use and currency transaction on the server. Rate-limit remotes. One network module wrapping all RemoteEvents/RemoteFunctions (no duplicates).

---

## 6. ORDER OF WORK & CHECK-INS

1. Install skills → 2. Watch all 9 videos, write notes + STYLE_BIBLE → 3. Blender models → 4. Animations → 5. VFX/SFX → 6. Studio: hierarchy + shared modules → 7. Server core → 8. Client systems + UI → 9. Bots → 10. Full playtests (PC + mobile emulator), fix every error in Output → 11. Save the place (don't publish).

After each phase, write a short summary in `PROGRESS.md` (what was done, screenshots, what's next) so I can check in from my phone. If the work is too big for one session, continue from `PROGRESS.md` next time without redoing finished work.
