import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encodeSharedCoordinates, parseSharedCoordinates } from "./chat-location.js";

const read = name => readFileSync(new URL(name, import.meta.url), "utf8");

test("one-time shared coordinates are bounded, rounded and normalized", () => {
  assert.equal(encodeSharedCoordinates(37.4219999, -122.0840575), "37.422,-122.08406");
  assert.equal(encodeSharedCoordinates(-0.000001, 0), "0,0");
  assert.throws(() => encodeSharedCoordinates(90.01, 0), /coordinates are invalid/i);
  assert.throws(() => encodeSharedCoordinates(0, Number.NaN), /coordinates are invalid/i);
});

test("shared coordinates render as validated map links only", () => {
  assert.deepEqual(parseSharedCoordinates("37.422,-122.08406"), {
    latitude: 37.422,
    longitude: -122.08406,
    mapsUrl: "https://maps.google.com/?q=37.422,-122.08406",
  });
  for (const invalid of ["", "Home", "91,0", "0,181", "0,0<script>", "1.123456,2"]) {
    assert.equal(parseSharedCoordinates(invalid), null, invalid);
  }
});

test("chat location requires device permission and explicit confirmation before sending", () => {
  const chat = read("chat.js");
  assert.match(chat, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(chat, /enableHighAccuracy: true, maximumAge: 0, timeout: 15000/);
  assert.match(chat, /Your location is only sent after you confirm\. Oldtime won’t track you\./);
  assert.match(chat, /class="chat-location-confirm"/);
  assert.match(chat, /pushMsg\(id, \{ kind: "location", body: encodedCoordinates \}\)/);
  assert.match(chat, /class="chat-location-card" href="\$\{ctxEsc\(location\.mapsUrl\)\}"/);
});

test("attachment sheet omits GIF, poll and sticker actions but retains core sharing", () => {
  const chat = read("chat.js");
  const choices = chat.slice(chat.indexOf("function openAttachmentSheet"), chat.indexOf("function openLocationShareSheet"));
  for (const choice of ["Photos & videos", "Document", "Location", "Contact", "View once"]) {
    assert.ok(choices.includes(choice), `Missing attachment choice: ${choice}`);
  }
  assert.doesNotMatch(choices, />GIF</i);
  assert.doesNotMatch(choices, />Poll</i);
  assert.doesNotMatch(choices, />Sticker</i);
  assert.doesNotMatch(choices, /data-mode="stickers"|chat-emoji-modebar/);
});
