import type { SongInput } from "@/types/song";

export const blankSong: SongInput = {
  title: "",
  artist: "",
  lyrics: "",
  originalKey: "C",
  defaultKey: "C",
  bpm: "",
  timeSignature: "",
  capo: "",
  notes: "",
  chordDiagramType: "guitar",
  fontSize: 14,
  showChords: true,
  orientation: "portrait",
};

// Original demonstration text, included to show the editor without saving a song.
export const exampleSong: SongInput = {
  ...blankSong,
  title: "A song for the morning",
  artist: "Worshiply · example song",
  bpm: "72",
  timeSignature: "4/4",
  lyrics:
    "[Intro]\n[C] [G] [Am7] [F]\n\n[Verse 1]\n[C]Here in the quiet, [G]here as we are\n[Am7]Bringing our voices, [F]bringing our hearts\n[C]Light through the window, [G]hope for the day\n[F]Gather us closer, [G]show us the way\n\n[Chorus]\n[C]Let every [F]heart sing\n[Am7]Let every [G]voice rise\n[C/E]Grace in the [F]morning\n[G]Peace in our [C]lives\n\n[Bridge]\n[Am7]One song, [F]one heart\n[C]Together, [G]we start",
};
