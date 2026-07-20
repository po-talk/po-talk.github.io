# 🦞 ぽっと通話 (po-call)

同じ部屋名（URL）を開いた人どうしが、そのまま音声通話できる実験的な**静的Webページ**。
サーバ不要・**HTML1枚**（WebRTC の P2P 音声 ＋ [Trystero](https://github.com/dmotz/trystero) / Nostr）。

**👉 使ってみる： https://qramo.github.io/po_call/**

> 実験用プロジェクトです。利用で生じた不具合・不利益・損害は自己責任で。一般的なモラルを守ってお使いください。

このREADMEは2部構成です：
- **使いたい人へ** … アプリを開いて通話するだけ
- **自分で立てたい人へ** … クローンして自前で動かす／公開する（技術者向け）

---

## 👥 使いたい人へ

**[▶ アプリを開く](https://qramo.github.io/po_call/)** → 名前とアバターを決めて、部屋名を入れて「参加する」。
同じ部屋名（＝共有リンク／QRコード）を相手に渡すか、「通話中の部屋」からタップして入室。

**できること**
- 🧑 名前＋絵文字アバター（ブラウザに保存、次回も引き継ぐ）
- 🗣 話している人の絵文字が声に合わせて跳ねる
- 🔇 参加者のミュート状態を表示
- 🟢 通話中の部屋を一覧、タップでそのまま入室
- 🌱 使うほど自分の絵文字が育つ（おまけ）

**つかう前に**
- **マイクの許可**が必要。**Safari / Chrome** で開く（アプリ内ブラウザは不可）
- iPhoneでは「音声を有効化」ボタンが出ることがある
- 快適なのは **4〜6人** くらいまで
- 実験版なので切断・不具合が起きることがあります
- くわしくはアプリ内の「これはなに？」を参照

---

## 🛠 自分で立てたい人へ

### 構成
- **`index.html` 1枚**。ビルド無し・`node_modules` 無し・バックエンド無し。
- 依存は [Trystero](https://github.com/dmotz/trystero) 1つだけを、実行時に `esm.sh` から動的 `import`。
- 相手発見／シグナリングは公開 **Nostrリレー**、音声は **WebRTC P2P（ブラウザ間 E2E）**。NAT越えは **Cloudflare TURN**（後述）。
- 「ロビー（通話中の部屋一覧）」も固定の隠し部屋 `__lobby__` に全員が入り、通話中の人が在室を定期発信して集約する仕組み。**サーバは足していません。**

### ローカルで動かす
`getUserMedia`（マイク）は **https:// か localhost** でしか動かない（`file://` 不可）。

```bash
python3 -m http.server 8000
# → http://localhost:8000 を開く
```

ビルド・lint・test は無し。**2タブ／2端末**で同じ部屋名を開いて繋がればOK。

### 自分の GitHub Pages で公開
1. リポジトリに push
2. **Settings → Pages → Deploy from a branch → `main` / `/(root)`**
3. 数分後 `https://<user>.github.io/<repo>/` で公開（Pages は自動 HTTPS ＝ マイク許可が通る）

### ⚠️ フォークしたら差し替えるもの
そのままデプロイすると**あなたの環境では一部が動きません**。`index.html` 内の以下を自分のものに：

| 項目 | 何が起きる／どうする |
|---|---|
| **TURN Worker URL**（`TURN_WORKER_URL`） | 既定は作者の Cloudflare TURN 資格情報発行 Worker で、**CORS で作者のオリジンに限定**。別オリジンからは弾かれ、**TURN が効かず別ネットワーク間で繋がらない**（STUN のみ＝直結できるペアだけ繋がる）。自分の Worker を用意して URL を差し替え、Worker 側の CORS 許可に自分のオリジンを追加する（下記）。 |
| **`appId`**（`kuramo-webrtc-call`） | 同じ `appId` だと**本家と部屋の名前空間・ロビーを共有**します。独立させたいなら変更。 |
| **Cloudflare Analytics トークン** | `<head>` のビーコンは作者のもの。自分のに差し替えるか、まるごと削除。 |
| アイコン / `manifest.webmanifest` / フォローカード画像 | 好みで差し替え。 |

### Cloudflare TURN（安定させたい人向け）
別ネットワーク間（対称NAT・セルラー）は直 P2P が失敗し **TURN 中継**が要ります。無料の公開 TURN は不安定なので、**Cloudflare Realtime TURN ＋ 短命の資格情報を発行する小さな Worker**を推奨（Worker は "合鍵を渡すだけ" で通話は通らない）。

- Cloudflare ダッシュボード → Realtime → **TURN Server** で TURN キー（Key ID / API Token）を作成
- Worker が `POST https://rtc.live.cloudflare.com/v1/turn/keys/$KEY_ID/credentials/generate-ice-servers`（`Authorization: Bearer $API_TOKEN`）を叩いて `iceServers` を返す。CORS で自分のオリジンだけ許可
- ページは起動時にその Worker から `iceServers` を取得し、`rtcConfig.iceServers` として Trystero に渡す

### Trystero 0.25 系メモ
ネット上の情報の多くは旧 API なので注意：

- **コールバックは代入**：`room.onPeerJoin = id => {}`（`onPeerJoin(fn)` の呼び出し形は廃止）
- **サブパス import は例外**：`trystero/torrent` 等は不可。素の `trystero` は **nostr** 戦略（本アプリはこれ）
- **リレー指定**：`relayConfig:{ urls:['wss://...'], redundancy:N }`。平坦な `relayUrls` / `relayRedundancy` は**無視**される
- **ICE 指定**：丸ごと差し替えるなら `rtcConfig:{ iceServers:[...] }`。`turnConfig:[{urls,username,credential}]` は既定 STUN に**追加**

### スケール / 注意
- **フルメッシュ**（全員が全員に接続）＝快適なのは **〜4〜6人**。大人数は SFU（LiveKit 等）が必要。
- ロビーも**閲覧者全員**のデータメッシュ。効くのは通話人数ではなく同時閲覧者数で、**数十人規模で頭打ち**（伸ばすなら Nostr 直 publish 等のサーバレスな方式へ）。
- 音声は **E2E**（サーバに残らない）。シグナリングは Nostr 公開リレー経由。

---

🙏 テストに協力してくれたみんな、ありがとう！

制作 ♨️🦈 qramo(ｸﾗﾓ) on POPOPO ／ 開発は [Claude Code](https://claude.com/claude-code) と一緒に。
