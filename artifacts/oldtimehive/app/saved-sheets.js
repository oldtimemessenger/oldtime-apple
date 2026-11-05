import { isDefaultAvatarMediaReference } from "./story-media.js";

const fallbackEsc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function safeUrl(url) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (/^(https?:|blob:)/i.test(u)) return u;
  if (/^data:image\//i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith("//")) return "";
  return u;
}

const isLocalMediaReference = value => {
  const reference = String(value ?? "").trim();
  return reference.startsWith("oldtime-media:") && reference.length > "oldtime-media:".length && !/[\s"'<>]/.test(reference);
};

function mediaAttributes(url, ownerId, e) {
  const reference = String(url ?? "").trim();
  if (isLocalMediaReference(reference)) {
    return `data-local-media="${e(reference)}"${ownerId ? ` data-local-media-owner="${e(ownerId)}"` : ""}`;
  }
  const safe = safeUrl(reference);
  return safe ? `src="${e(safe)}"` : "";
}

function postOwnerId(post = {}) {
  const author = post.author;
  return String((author && typeof author === "object" ? author.id : "") || post.authorId || (typeof author === "string" ? author : ""));
}

function postImage(post) {
  const p = post || {};
  const m = Array.isArray(p.media) ? p.media[0] : null;
  const image = p.thumbnail || p.poster || p.image || p.cover || p.url ||
    (m && (m.poster || m.thumbnail || m.url || m.src)) || (typeof m === "string" ? m : "");
  const reference = String(image ?? "").trim();
  return isDefaultAvatarMediaReference(reference) || (!isLocalMediaReference(reference) && !safeUrl(reference)) ? "" : reference;
}

function thumb(url, e, cls = "", ownerId = "") {
  const attributes = mediaAttributes(url, ownerId, e);
  return attributes ? `<img class="ss-thumb ${cls}" ${attributes} alt="" loading="lazy" decoding="async">` : `<span class="ss-thumb ${cls}" aria-hidden="true"></span>`;
}

export function renderSavedSheet({ post = {}, author = {}, saved = false, esc = fallbackEsc, icons = {} } = {}) {
  const e = esc || fallbackEsc;
  const id = e(post.id ?? "");
  return `<section class="panel saved-social-panel" role="dialog" aria-modal="true" aria-labelledby="saved-sheet-title" data-post-id="${id}">
    <div class="ss-grab" aria-hidden="true"></div>
    <header class="ss-head">
      ${thumb(postImage(post), e, "", postOwnerId(post))}
      <span class="ss-text"><b id="saved-sheet-title">Saved</b><small>Private</small></span>
      <button type="button" class="ss-save${saved ? " on" : ""}" data-saved-toggle aria-pressed="${!!saved}" aria-label="${saved ? "Remove from saved" : "Save"}">${saved ? (icons.mediaBookmarkOn || icons.bookmarkOn || "") : (icons.mediaBookmark || icons.bookmark || "")}</button>
      <button type="button" class="ss-close" data-social-sheet-close aria-label="Close">${icons.close || ""}</button>
    </header>
    <div class="ss-body">
      <p class="ss-description">Saved privately to your account.</p>
    </div>
  </section>`;
}

export function renderSharePeople({friends=[],selectedFriends=[],loading=false,failed=false,busy=false,esc=fallbackEsc,icons={}}={}) {
  const e=esc||fallbackEsc;
  const recipientList = friends.map(friend => {
    const unavailable = friend.unavailable === true;
    const name = String(friend.name || friend.username || "Friend");
    const username = String(friend.username || name);
    const selected = selectedFriends.map(String).includes(String(friend.id));
    const searchValue = `${name} ${username}`.toLowerCase();
    const avatar=mediaAttributes(isDefaultAvatarMediaReference(friend.avatar) ? "" : friend.avatar, friend.id, e);
    const face = `<span class="srp-avatar srp-initial" aria-hidden="true">${e(name.slice(0,1).toUpperCase())}</span>${avatar?`<img class="srp-avatar" ${avatar} alt="" width="64" height="64" loading="lazy" decoding="async">`:""}`;
    return `<li class="srp-cell" data-share-cell data-search="${e(searchValue)}">
      <label class="srp-friend ${unavailable ? "srp-off" : ""}">
        <input type="checkbox" data-share-friend value="${e(friend.id)}" aria-label="Share with @${e(username)}" ${selected ? "checked" : ""} ${unavailable||busy ? "disabled" : ""}>
        <span class="srp-face">${face}<span class="srp-badge">${icons.check || ""}</span></span>
        <span class="srp-name">${e(name)}</span>
      </label>
      ${unavailable ? `<small class="srp-reason">Can’t view this post</small>` : ""}
    </li>`;
  }).join("");
  const skeleton=loading&&!friends.length?Array.from({length:4},()=>`<li class="srp-placeholder" aria-hidden="true"><span></span><i></i></li>`).join(""):"";
  return `<ul class="srp-grid" aria-label="People to share with">${recipientList}${skeleton}</ul>
    <div class="srp-empty" ${friends.length||loading||failed?"hidden":""}><b>No contacts yet</b><span>Start a conversation to see people here.</span></div>
    <p class="srp-empty" data-share-no-matches hidden>No matching contacts.</p>
    ${failed?`<p class="srp-contacts-retry" role="status">${friends.length?"Some contacts couldn’t refresh.":"Couldn’t load contacts."}<button type="button" data-share-refresh>Try again</button></p>`:""}`;
}

export function renderShareSheet({
  post = {}, author = {}, comment = null, friends = [], friendsMode = false,
  selectedFriends = [], friendSearch = "", friendMessage="", saved = false, reposted = false,
  canRepost = false, canStory=false, canCopy=false, canExternal=false,
  peopleLoading=false,peopleError=false,sending=false,esc = fallbackEsc, icons = {}
} = {}) {
  const e=esc||fallbackEsc,id=e(post.id??"");
  const c=comment&&typeof comment==="object"?comment:null;
  const image=post.kind==="video"&&!post.poster&&!post.thumbnail?"":postImage(post);
  const caption = String(post.caption || post.text || "").trim();
  const preview=c
    ? `<div class="srp-preview srp-quote">${c.attachment?.url?thumb(c.attachment.url,e,"srp-thumb",c.author):""}<span class="srp-ptext"><small>${e(c.body||"Shared comment")}</small></span></div>`
    : image || caption
      ? `<div class="srp-preview">${image?thumb(image,e,"srp-thumb",postOwnerId(post)):""}${caption?`<span class="srp-ptext"><small>${e(caption)}</small></span>`:""}</div>`
      : "";
  return `<section class="panel share-recipient-panel" role="dialog" aria-modal="true" aria-labelledby="share-sheet-title" data-post-id="${id}">
    <div class="srp-grab" aria-hidden="true"></div>
    <header class="srp-head">
      <button type="button" class="srp-search-trigger" data-share-friends aria-label="Search people" aria-expanded="${friendsMode}">${icons.search||""}</button>
      <h2 id="share-sheet-title">Share</h2>
      <button type="button" class="srp-close" data-social-sheet-close aria-label="Close">${icons.close||""}</button>
    </header>
    <div class="srp-body">
      <h3 class="srp-section-label">Send via chat</h3>
      <label class="srp-search" ${friendsMode?"":"hidden"}>
        <span class="srp-searchic" aria-hidden="true">${icons.search||""}</span>
        <input type="search" data-share-search placeholder="Search people" autocomplete="off" value="${e(friendSearch)}" aria-label="Search people">
      </label>
      <div class="srp-people" data-share-people aria-busy="${peopleLoading}">
        ${renderSharePeople({friends,selectedFriends,loading:peopleLoading,failed:peopleError,busy:sending,esc:e,icons})}
      </div>
      <p class="srp-error" data-sheet-error role="alert"></p>
        <div class="srp-actions">
          ${canRepost?`<button type="button" class="srp-act" data-share-repost aria-pressed="${reposted}" aria-label="${reposted?"Remove repost":"Repost"}">
            <span class="srp-actic" aria-hidden="true">${icons.repost || ""}</span><span class="srp-actlbl">${reposted ? "Remove repost" : "Repost"}</span>
          </button>`:""}
          ${canStory?`<button type="button" class="srp-act" data-share-story>
            <span class="srp-actic" aria-hidden="true">${icons.camera||""}</span><span class="srp-actlbl">Add to your Story</span>
          </button>`:""}
          ${canExternal?`<button type="button" class="srp-act" data-share-external>
            <span class="srp-actic" aria-hidden="true">${icons.share||""}</span><span class="srp-actlbl">Share via…</span>
          </button>`:""}
          ${canCopy?`<button type="button" class="srp-act" data-share-copylink>
            <span class="srp-actic" aria-hidden="true"><svg class="navic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m9 15 6-6M7.5 10.5l-2 2a4.2 4.2 0 0 0 6 6l2-2M10.5 7.5l2-2a4.2 4.2 0 0 1 6 6l-2 2"/></svg></span>
            <span class="srp-actlbl">${c ? "Copy link to comment" : "Copy link to post"}</span>
          </button>`:""}
        </div>
      ${preview}
    </div>
    <div class="srp-compose" ${selectedFriends.length?"":"hidden"}>
      <textarea data-share-message rows="1" maxlength="500" placeholder="Add a message (optional)" aria-label="Optional message">${e(friendMessage)}</textarea>
      <button type="button" class="srp-send" data-share-submit ${!selectedFriends.length||sending?"disabled":""}>
        <span class="srp-send-icon" aria-hidden="true">${icons.send||""}</span>
        <span data-share-submit-label>${sending?"Sending…":selectedFriends.length?`Send via chat (${selectedFriends.length})`:"Send via chat"}</span>
      </button>
    </div>
  </section>`;
}
