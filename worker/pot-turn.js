// pot-turn ── TURN 資格情報を発行する Cloudflare Worker
//
// **これは運営が動かす唯一のコード**。ここが止まると TURN が取れなくなり、全員が直結
// （STUN のみ）にフォールバックする＝相手に IP アドレスが見えるようになり、ロビーの
// メッシュも張りにくくなって部屋の取りこぼしが増える。**しかもエラーは表に出ない。**
//
// ## 法的 posture 上の位置づけ（CLAUDE.md 参照・重要）
// このWorkerは **「合鍵を渡すだけ」＝資格情報の発行機であって、通信の経路ではない**。
// 音声・シグナリング・在室のいずれもここを通らない（TURN サーバ自体は Cloudflare のもの）。
// だから運営は「他人の通信を媒介する」側に回らず、電気通信事業者にならない。
// **運営が書くコードは、この形（認証・調整だけで、通信そのものを運ばない）に留めること。**
// 通信内容や在室を自前で受け取る・保存する・中継するようにした瞬間、この分析は崩れる。
//
// ## デプロイ
//   Cloudflare Workers に配置。シークレットは環境変数で渡す（コードには書かない）。
//     TURN_KEY_ID         … Cloudflare Realtime の TURN キーID
//     TURN_KEY_API_TOKEN  … 同 APIトークン
//   公開URL: https://pot-turn.itsuma-kuramoto.workers.dev/
//   本体からは index.html の TURN_WORKER_URL が指している。
//
// ## 判断の記録
// - **`ttl: 1800`（30分）** … 2026-08-01 のレビューで 86400（24時間）から短縮。
//   アプリ側は5分ごとに資格情報を入れ替え（`refreshIce`）、キャッシュTTLは10分なので、
//   使っているものは常に10分以内＝有効期限まで20分以上の余裕がある。
//   **これ以上短くするなら、アプリの `ICE_REFRESH_MS` と `ICE_TTL_MS` も見直すこと。**
// - **Origin の許可リスト** … 完全一致（前方一致にしないこと）。`Vary: Origin` は必須
//   （CDN が origin ごとに応答を分けないと、他人向けの応答が混ざる）。
//   `!ok` の 403 は**上流を叩く前**に置く＝弾く相手のぶんの資格情報を発行しない。
//   移設中は新旧＋org の github.io を並べておく（旧サイトを誘導ページにしたら外せる）。
// - **レート制限は意図して入れていない** … 残る経路は Origin を詐称するスクリプトのみで、
//   得られるのは30分の利用権。**その代わりの前提条件が「Cloudflare ダッシュボードで
//   TURN 利用量を監視すること（アラートか月イチの目視）」。これを怠ると保留の根拠が消える。**
// - `Cache-Control: no-store` … 短命の資格情報をブラウザにキャッシュさせない。
// - 上流の応答は `iceServers` だけ取り出して返す（余計なフィールドを漏らさない）。
//   エラーも上流の文面を返さず 'turn unavailable' に丸める。

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const allowed = ['https://potalk.app', 'https://po-talk.github.io', 'https://qramo.github.io', 'http://localhost:8000']
    const ok = allowed.includes(origin)
    const cors = {
      'Access-Control-Allow-Origin': ok ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (request.method !== 'GET')
      return new Response(null, { status: 405, headers: cors })
    // ブラウザは cross-origin fetch で必ず Origin を送るので、正規アプリはここを通る。
    // curl は偽装できるため完封ではない＝一段目のフィルタ（二段目はレート制限）
    if (!ok) return new Response(null, { status: 403, headers: cors })
    try {
      const r = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
        { method: 'POST',
          headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ttl: 1800 }) }   // アプリの取り直し10分 < 30分
      )
      if (!r.ok) throw 0
      const data = await r.json()
      if (!data.iceServers) throw 0
      return new Response(JSON.stringify({ iceServers: data.iceServers }),
        { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
    } catch {
      return new Response(JSON.stringify({ error: 'turn unavailable' }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
  }
}
