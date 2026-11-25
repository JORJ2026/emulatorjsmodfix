# Contributing

Thanks for helping. This project is a static site: no build step is needed to work on it.

* Run it: `python3 serve.py 8000`, then open <http://localhost:8000>.
* Before sending a change: `node tools/preflight.mjs`.
* Adding a homebrew game: `npm run homebrew:new`, fill in `game.json`, then `node tools/generate-homebrew-index.mjs --strict`. Only games released for sharing (homebrew, public domain or licensed to the project) can be added. **Never add commercial ROMs.**
* Keep new code in plain JavaScript modules; no tracking, no external requests at run time.
* New files used offline must be added to `SHELL_FILES` in `sw.js` (preflight checks this).

By contributing you agree your work is released under the project's GPL-3.0 licence.
