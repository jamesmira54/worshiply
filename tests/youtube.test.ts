import test from "node:test";
import assert from "node:assert/strict";
import { canonicalVideoUrl, embedVideoUrl, youTubeId } from "../lib/youtube";

const ID = "dQw4w9WgXcQ";

test("accepted YouTube link forms all give the video ID", () => {
  for (const link of [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s&list=PL123`,
    `http://m.youtube.com/watch?feature=share&v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc&t=10`,
    `https://youtu.be/${ID}/`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}?feature=share`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `  https://WWW.YouTube.com/watch?v=${ID}  `,
  ])
    assert.equal(youTubeId(link), ID, link);
});

test("look-alike hosts, other schemes and non-video links are rejected", () => {
  for (const link of [
    `https://youtube.com.evil.example/watch?v=${ID}`,
    `https://evil.example/youtube.com/watch?v=${ID}`,
    `https://notyoutube.com/watch?v=${ID}`,
    `https://evil.example/?u=https://youtu.be/${ID}`,
    `https://user:pass@www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com:8443/watch?v=${ID}`,
    `javascript:alert(1)//https://youtu.be/${ID}`,
    `data:text/html,https://youtu.be/${ID}`,
    `ftp://youtu.be/${ID}`,
    "hello",
    "",
    `https://youtu.be/${ID.slice(1)}`,
    `https://youtu.be/${ID}x`,
    `https://www.youtube.com/watch?v=${ID}!`,
    "https://www.youtube.com/@somechannel",
    "https://www.youtube.com/playlist?list=PL1234567890",
    `https://www.youtube.com/watch/${ID}`,
    `https://youtu.be/a/${ID}`,
    null,
    42,
  ])
    assert.equal(youTubeId(link), null, String(link));
});

test("canonical and embed URLs are rebuilt from the ID", () => {
  assert.equal(canonicalVideoUrl(ID), `https://www.youtube.com/watch?v=${ID}`);
  assert.equal(
    embedVideoUrl(ID),
    `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0`,
  );
});
