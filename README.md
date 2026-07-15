# 🦞 ぱっと通話 (webrtc-call)

同じ部屋名を開いた人どうしが、そのまま音声通話できる**静的Webページ**。
WebRTC の P2P 音声 ＋ [Trystero](https://github.com/dmotz/trystero)（サーバレスなシグナリング）で、**バックエンド不要・HTML1枚**。

## 使い方
1. ページを開く → 部屋名を入れて「参加する」→ マイクを許可
2. 同じ部屋名（or 共有リンク `...#部屋名`）を別の人が開くと、自動で繋がって通話開始

## ローカルで試す
`getUserMedia`（マイク取得）は **https:// か localhost** でしか動かない（`file://` は不可）。

```bash
python3 -m http.server 8000
# → http://localhost:8000 を開く
```

## GitHub Pages で公開（推奨）
1. このフォルダを GitHub リポジトリに push
2. リポジトリ **Settings → Pages → Deploy from a branch → `main` / `/(root)`**
3. 数分後 `https://<user>.github.io/<repo>/` で公開
   → **Pages は自動 HTTPS** なので、マイク許可がそのまま通る

## 注意 / 仕様
- **メッシュ方式**（全員が全員に接続）なので快適なのは **〜4〜6人**。大人数は SFU（LiveKit 等）が必要。
- 企業ネット/対称NAT下では直P2Pが失敗することがある → **TURN** を足すと安定（公開 STUN は既定で利用）。
- 音声メディアは**ブラウザ間 E2E**（サーバに音は残らない）。シグナリングは Nostr 公開リレー経由。

## カスタム
- **シグナリング戦略**：`trystero/nostr` を `torrent` / `mqtt` / `firebase` などに変更可（自前運用にもできる）
- **TURN 追加**：`joinRoom({appId, rtcConfig:{iceServers:[{urls:'turn:...',username,credential}]}}, room)`
