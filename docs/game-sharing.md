# Generic online game sharing

The game-sharing layer publishes a versioned game payload behind a password-protected student link. Word Sudoku is the first registered game.

## Flow

1. A generator calls `window.TeacherGameShare.openPublisher(...)` from `/shared/game-sharing.js`.
2. `POST /api/game-shares` looks up the registered `gameType@version`, validates and normalizes its payload, hashes the password, and stores a manifest.
3. Students open `/play/:shareId`, enter the password, and receive the game-specific player only after a signed authorization cookie is set.
4. Links expire after 90 days. A publish response also includes a delete token for future teacher-side link management.

Local development stores manifests under `src/teachingTools/tmp/game-share-storage`. Production uses the private Azure Blob Storage container `game-shares` when `AZURE_STORAGE_CONNECTION_STRING` is configured.

Production must also set a strong, private `COOKIE_SECRET`. The app creates the Blob container on first publish when the configured storage identity has permission. Configure an Azure lifecycle rule to remove blobs older than the product retention period; opening an expired link also removes that share on demand.

## Adding another online game

Create an adapter under `services/games/` that exports:

```js
module.exports = {
  type: 'new-game',
  version: 1,
  view: 'game-share/new-game-player',
  sanitize: function (payload) {
    // Reject invalid/untrusted fields and return only the normalized data
    // that the student player needs.
    return normalizedPayload;
  }
};
```

Register it in `services/gameShareRegistry.js`, add its EJS player plus browser assets, and include `/shared/game-sharing.js` in the generator. The generator then calls:

```js
TeacherGameShare.openPublisher({
  gameType: 'new-game',
  version: 1,
  title: () => currentTitle,
  getData: () => buildSerializableGamePayload()
});
```

Do not accept an arbitrary player URL or executable code in a payload. The server-side registry is the security boundary that keeps a shared link limited to known players and validated data.

## Current student data behavior

Word Sudoku progress is stored only in that student's browser using `localStorage`. The server does not collect student names, answers, scores, or completion records. Adding teacher-visible results should be a separate feature with explicit student identity and retention decisions.
