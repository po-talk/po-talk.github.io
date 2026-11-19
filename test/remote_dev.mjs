// リモコン機器の代わり（T88 用・git 追跡）。ペアリングコードから機器と同じ鍵を導き、公開 Nostr リレーへ
// 機器→ブラウザ のイベントを流し、ブラウザ→機器 の状態を標準出力に 1 行ずつ出す。
//   node test/remote_dev.mjs <コード> <toggle|hello|replay> [待つ秒数]
//   出力: "sent <action>" / "state <json>"（復号した状態）/ "bad <理由>"
// 鍵の導き方・kind・タグ・暗号化は docs/PROTOCOL.md §10.1 と同じ（firmware の main.cpp と対）
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const here = path.dirname(fileURLToPath(import.meta.url))
const nt = await import(path.join(here, '..', 'vendor', 'nostr-tools-2.10.4.mjs'))
const code = (process.argv[2] || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
const action = process.argv[3] || 'toggle'
const waitSec = Number(process.argv[4] || 10)
if (code.length !== 16) { console.error('code must be 16 chars'); process.exit(2) }
const sha = s => new Uint8Array(createHash('sha256').update(s).digest())
const sk = sha('potalk-remote-v1/key:' + code), ck = sha('potalk-remote-v1/ck:' + code), pk = nt.getPublicKey(sk)
const RELAYS = ['wss://relay.primal.net', 'wss://yabu.me/v2', 'wss://relay.notoshi.win', 'wss://purplerelay.com']
const pool = new nt.SimplePool()
pool.subscribeMany(RELAYS, [{ kinds: [20101], authors: [pk], '#r': ['app'], since: Math.floor(Date.now() / 1000) - 60 }], {
  onevent: ev => { try { console.log('state ' + nt.nip44.v2.decrypt(ev.content, ck)) } catch (e) { console.log('bad ' + e.message) } }
})
await new Promise(r => setTimeout(r, 1500))
const send = async evt => { await Promise.allSettled(pool.publish(RELAYS, evt)) }
const make = a => { const t = Math.floor(Date.now() / 1000); return nt.finalizeEvent({ kind: 20101, created_at: t, tags: [['r', 'dev']], content: nt.nip44.v2.encrypt(JSON.stringify({ a, t }), ck) }, sk) }
if (action === 'replay') {   // 同じ署名済みイベントを 2 回流す＝効くのは 1 回だけのはず
  const evt = make('toggle'); await send(evt); console.log('sent toggle'); await new Promise(r => setTimeout(r, 2500)); await send(evt); console.log('sent toggle(replay)')
} else { await send(make(action)); console.log('sent ' + action) }
setTimeout(() => process.exit(0), waitSec * 1000)
