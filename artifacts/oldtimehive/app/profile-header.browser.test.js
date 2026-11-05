import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright-core";
import { createServer } from "vite";

// Isolated owner/visitor profile header layout fixture. Fake local data only; every /api request is blocked.
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shotDir = resolve(tmpdir(), "oldtime-profile-header");
const chromiumPath = [process.env.CHROMIUM_PATH, "/repl/tools/bin/chromium", "/usr/bin/chromium"].filter(Boolean).find(existsSync);

const person = (id, extra = {}) => ({
  id, username: id.replace(/-/g, ""), name: id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" "),
  avatar: "/app/avatar.svg", private: false, followers: [], following: [], friends: [], closeFriends: [],
  interests: [], profileVisibility: { city: true, interests: true }, ...extra,
});
const fixture = {
  session: "fixture-owner",
  settings: { readReceipts: true, lastSeen: "everyone" },
  users: [
    person("fixture-owner", { name: "Fixture Owner With A Longer Display Name", city: "Philadelphia, US",
      interests: ["basketball", "music", "photography"], followers: ["fan-one", "fan-two", "fan-three", "fan-four"],
      following: ["fan-one", "fan-two", "fan-three"], bio: "Fixture bio for layout checks.",
      stats: { followerCount: 1284, followingCount: 317, viewCount: 9 } }),
    person("visitor-target", { city: "Lisbon", interests: ["travel"], followers: [], following: ["fixture-owner"],
      stats: { followerCount: 0, followingCount: 1, viewCount: 0 } }),
    person("fan-one"), person("fan-two"), person("fan-three"), person("fan-four"),
  ],
  posts: Array.from({ length: 6 }, (_, index) => ({
    id: `fixture-owner-post-${index}`, author: "fixture-owner", kind: "image",
    media: ["/app/avatar.svg"], caption: `Profile grid item ${index + 1}`,
    destination: "main", visibility: "public", likes: [], comments: [], reposts: [], saves: [], views: index + 1,
    created: 1_700_000_000_000 + index,
  })),
  stories: [], chats: [], requests: [], friendRequests: [], notifications: [],
};

test("profile header owner and visitor layouts at phone, tablet, and desktop widths", { skip: !chromiumPath && "Chromium unavailable", timeout: 240_000 }, async () => {
  process.env.PORT ||= "5173"; process.env.BASE_PATH ||= "/";
  const server = await createServer({ configFile: resolve(packageRoot, "vite.config.ts"), logLevel: "silent", server: { host: "127.0.0.1", port: 0, strictPort: false } });
  let browser;
  try {
    await server.listen();
    const { port } = server.httpServer.address();
    browser = await chromium.launch({ executablePath: chromiumPath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    mkdirSync(shotDir, { recursive: true });
    const writes = [];
    for (const width of [320, 390, 768, 1280]) {
      const context = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: 844 } });
      await context.route("**/api/**", route => {
        if (route.request().method() !== "GET") writes.push(route.request().url());
        const stats = { fixtureowner: ["fixture-owner", 1284, 317], visitortarget: ["visitor-target", 0, 1] };
        const profilePath = new URL(route.request().url()).pathname;
        const hit = Object.entries(stats).find(([name]) => profilePath.endsWith(`/api/profiles/${name}`));
        if (hit && route.request().method() === "GET") {
          const [, [id, followerCount, followingCount]] = hit;
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
            profile: { id, username: hit[0] }, stats: { followerCount, followingCount, viewCount: 9 },
            posts: fixture.posts.filter(post => post.author === id),
          }) });
        }
        return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"blocked in fixture"}' });
      });
      await context.addInitScript(state => {
        if (!localStorage.getItem("oldtime-v1")) localStorage.setItem("oldtime-v1", JSON.stringify(state));
        sessionStorage.clear();
        sessionStorage.setItem("oldtime-cloud-session-v1", JSON.stringify({ account: { id: state.session }, accessToken: "a".repeat(43), expiresAt: Date.now() + 600_000 }));
      }, fixture);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}/`);
      await page.waitForFunction(() => typeof window.__oldtimeOpenProfilePreview === "function", null, { timeout: 60_000 });
      for (const [label, id] of [["owner", "fixture-owner"], ["visitor", "visitor-target"]]) {
        await page.evaluate(target => window.__oldtimeOpenProfilePreview(target), id);
        await page.locator(".profile-screen .profile-stats").waitFor({ state: "visible" });
        await page.waitForTimeout(1200); // let entrance motion and stats refresh settle
        if (label === "owner") {
          await page.evaluate(() => {
            const panel = document.querySelector("#profile-content-grid");
            let grid = panel?.querySelector(".profile-post-grid");
            if (!panel || grid?.querySelector(".profile-post-card")) return;
            if (!grid) {
              grid = document.createElement("div");
              grid.className = "profile-post-grid";
              panel.append(grid);
            }
            for (let index = 0; index < 6; index += 1) {
              const card = document.createElement("article");
              card.className = "profile-post-card";
              card.innerHTML = `<button type="button" class="profile-post-media" aria-label="Layout fixture tile ${index + 1}"><img src="/app/avatar.svg" alt=""></button><div class="profile-post-detail"><p class="profile-post-caption">Layout fixture tile ${index + 1}</p></div>`;
              grid.append(card);
            }
            panel.querySelectorAll(".empty,#profile-posts-retry").forEach(element => element.remove());
            panel.prepend(grid);
          });
        }
        const m = await page.evaluate(() => {
          const r = s => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
          return {
            vw: document.documentElement.clientWidth, docW: document.documentElement.scrollWidth,
            cards: [...document.querySelectorAll(".profile-count-card")].map(c => { const b = c.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height, faces: c.querySelectorAll(".profile-count-faces img").length, text: c.innerText }; }),
            stats: document.querySelector(".profile-stats").innerText,
            intro: r(".profile-intro"), overview: r(".profile-overview-row"), statsRow: r(".profile-stats"),
            meta: r(".profile-meta-row"), actions: r(".profile-primary-actions"), name: r(".profile-name"), avatar: r(".profile-avatar"),
            edit: r("#edit"), follow: r("#pfollow"), msg: r("#pmsg"), cover: r(".profile-cover"),
            grid: (() => { const el = document.querySelector(".profile-post-grid"); return el ? { columns: getComputedStyle(el).gridTemplateColumns.split(" ").length, count: el.querySelectorAll(".profile-post-card").length, media: [...el.querySelectorAll(".profile-post-media")].map(media => { const b = media.getBoundingClientRect(); return { w: b.width, h: b.height }; }) } : null; })(),
            overflow: [...document.querySelectorAll(".profile-intro *")].filter(el => { const b = el.getBoundingClientRect(); return b.width && (b.right > innerWidth + 1 || b.left < -1); }).map(el => el.className || el.tagName).slice(0, 5),
          };
        });
        await page.screenshot({ path: resolve(shotDir, `${label}-${width}.png`) });
        assert.equal(m.cards.length, 2, `${label}@${width}: two count cards`);
        assert.match(m.stats, /followers[\s\S]*following/i);
        assert.ok(Math.abs(m.cards[0].w - m.cards[1].w) < 1.5 && Math.abs(m.cards[0].t - m.cards[1].t) < 1, `${label}@${width}: equal cards side by side`);
        assert.ok(m.cards[1].r <= m.vw + 0.5 && m.docW <= m.vw, `${label}@${width}: no horizontal overflow`);
        assert.ok(m.avatar.r <= m.name.l, `${label}@${width}: avatar sits beside the identity`);
        assert.ok(m.statsRow.t >= m.overview.b, `${label}@${width}: social cards follow the identity row`);
        assert.deepEqual(m.overflow, [], `${label}@${width}: no header element escapes the viewport`);
        assert.ok(m.cards.every(c => c.h >= 68), `${label}@${width}: reference-sized social cards`);
        if (label === "owner") {
          assert.deepEqual(m.cards.map(c => c.faces), [0, 3], "follower card is count-only and following shows three real fixture relations");
          assert.ok(m.edit && m.edit.w >= m.actions.w - 1, "Edit profile fills its action row");
          assert.ok(m.cover.b >= m.edit.b - 1, "cover/fade continues beneath Edit profile");
          assert.equal(m.grid?.columns, 3, `${label}@${width}: profile media returns as a three-column grid`);
          assert.equal(m.grid?.count, 6, `${label}@${width}: all fixture media tiles render`);
          assert.ok(m.grid.media.every(item => Math.abs(item.w - item.h) < 1), `${label}@${width}: grid media tiles remain square`);
        } else {
          assert.deepEqual(m.cards.map(c => c.faces), [0, 1], "visitor: no followers -> count-only; one known following shows one real avatar");
          assert.ok(m.follow && m.msg && m.follow.t === m.msg.t, "Follow and Message sit on one row");
          assert.ok(m.actions.t >= m.name.b, `${label}@${width}: visitor actions sit below the identity`);
        }
        assert.ok(m.meta && m.meta.t > m.cards[0].b, `${label}@${width}: meta row below counts`);
      }
      assert.deepEqual(errors, [], "no page errors");
      await context.close();
    }
    // Every non-GET was intercepted with 503 (nothing reached a server). Analytics collection and realtime tickets are expected.
    assert.deepEqual([...new Set(writes.map(u => new URL(u).pathname))]
      .filter(path => !["/api/realtime/ticket", "/api/analytics/resources"].includes(path)), [], "no profile/relationship writes attempted");
  } finally {
    await browser?.close();
    await server.close();
  }
});
