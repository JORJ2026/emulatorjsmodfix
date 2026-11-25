# Third-party notices

EmulatorJS local edition is built from other people's open-source work. This file lists the main parts and their licences.
It is a good-faith summary, **not legal advice**: licences are quoted as the upstream projects publish them, and a few are marked "verify".
Check the upstream project before you redistribute a core in a product you sell.

## The site and player

| Part | Licence |
|---|---|
| EmulatorJS 4.3 (`data/src/`) | GNU GPL v3 (see `LICENSE`) |
| This edition's added pages and scripts (`assets/`, `engines/`, `tools/`) | GNU GPL v3 |
| Homebrew games in `homebrew/` | Each game's own licence, shown on its page and in `homebrew/index.json` |
| Desktop app shell | [Electron](https://www.electronjs.org) (MIT) and Chromium (BSD-style and other licences, see the app's `LICENSES.chromium.html`) |
| Phone app shell | [Capacitor](https://capacitorjs.com) (MIT) |
| Core decompression | 7-Zip-based WebAssembly (LGPL) |

## Emulator cores

The cores are builds of the RetroArch / libretro emulators, compiled to WebAssembly by the EmulatorJS project
(<https://github.com/EmulatorJS/cores>, where the corresponding source and build scripts are available).

| Core | Used for | Licence |
|---|---|---|
| `81` | ZX81 (EightyOne) | GPL-3.0 |
| `a5200` | Atari 5200 | GPL-2.0 |
| `beetle_vb` | Virtual Boy | GPL-2.0 |
| `cap32` | Amstrad CPC | GPL-2.0 |
| `crocods` | Amstrad CPC | GPL-2.0 (verify) |
| `desmume` | Nintendo DS | GPL-2.0 |
| `desmume2015` | Nintendo DS | GPL-2.0 |
| `dosbox_pure` | DOS | GPL-2.0 |
| `fbalpha2012_cps1` | Capcom CPS1 | Non-commercial (FBA licence) |
| `fbalpha2012_cps2` | Capcom CPS2 | Non-commercial (FBA licence) |
| `fbneo` | Arcade | Non-commercial (FBNeo licence) |
| `fceumm` | NES | GPL-2.0 |
| `fuse` | ZX Spectrum | GPL-3.0 |
| `gambatte` | Game Boy / Color | GPL-2.0 |
| `gearcoleco` | ColecoVision | GPL-3.0 |
| `genesis_plus_gx` | Mega Drive, Master System, Game Gear | Non-commercial (Genesis Plus GX licence) |
| `handy` | Atari Lynx | zlib-style (Handy licence) |
| `mame2003` | Arcade | Non-commercial (MAME legacy licence) |
| `mame2003_plus` | Arcade | Non-commercial (MAME legacy licence) |
| `mednafen_ngp` | Neo Geo Pocket | GPL-2.0 |
| `mednafen_pce` | PC Engine | GPL-2.0 |
| `mednafen_pcfx` | PC-FX | GPL-2.0 |
| `mednafen_psx_hw` | PlayStation | GPL-2.0 |
| `mednafen_wswan` | WonderSwan | GPL-2.0 |
| `melonds` | Nintendo DS | GPL-3.0 |
| `mgba` | Game Boy Advance | MPL-2.0 |
| `mupen64plus_next` | Nintendo 64 | GPL-3.0 |
| `nestopia` | NES | GPL-2.0 |
| `opera` | 3DO | verify upstream (LGPL-style) |
| `parallel_n64` | Nintendo 64 | GPL-2.0 |
| `pcsx_rearmed` | PlayStation | GPL-2.0 |
| `picodrive` | Mega Drive, 32X, Sega CD | Non-commercial (PicoDrive licence) |
| `ppsspp` | PSP | GPL-2.0 |
| `prboom` | Doom | GPL-2.0 |
| `prosystem` | Atari 7800 | GPL-2.0 |
| `puae` | Amiga | GPL-2.0 |
| `same_cdi` | Philips CD-i | GPL-2.0 / BSD-3-Clause (MAME) |
| `smsplus` | Master System, Game Gear | GPL-2.0 |
| `snes9x` | Super Nintendo | Non-commercial (Snes9x licence) |
| `stella2014` | Atari 2600 | GPL-2.0 |
| `vice_x128` | Commodore 128 | GPL-2.0 |
| `vice_x64` | Commodore 64 | GPL-2.0 |
| `vice_x64sc` | Commodore 64 | GPL-2.0 |
| `vice_xpet` | Commodore PET | GPL-2.0 |
| `vice_xplus4` | Commodore Plus/4 | GPL-2.0 |
| `vice_xvic` | Commodore VIC-20 | GPL-2.0 |
| `virtualjaguar` | Atari Jaguar | GPL-3.0 |
| `yabause` | Sega Saturn | GPL-2.0 |

### What the "non-commercial" cores mean
The cores marked *Non-commercial* (Snes9x, Genesis Plus GX, PicoDrive, FBNeo, FBAlpha 2012, MAME 2003 and similar) may be shared for free
but **not sold or bundled in a paid product**. If you plan to sell or monetise a build, remove those cores from `data/cores/` first.

## Games and trademarks
The site ships no commercial games. Console names, game names and logos belong to their owners; this project is not affiliated with or endorsed by them.

## Offer of source
You may get the full source of the site and player from this repository. Source for the cores is at the EmulatorJS cores repository above and in each upstream project.
