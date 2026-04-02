import type { Song } from '../utils/chords';

export const mockSongs: Song[] = [
  {
    id: 'hallelujah-he',
    title: 'הללויה',
    artist: 'גלי עטרי',
    language: 'he',
    chordsData: [
      { type: 'section', content: 'בית 1' },
      {
        type: 'line',
        lyrics: 'מול חלון קטן בשקיעת חמה',
        chords: [
          { chord: 'C', position: 0 },
          { chord: 'Am', position: 10 },
          { chord: 'F', position: 18 },
        ],
      },
      {
        type: 'line',
        lyrics: 'ילדה קטנה גבת עיניים',
        chords: [
          { chord: 'G', position: 0 },
          { chord: 'C', position: 11 },
        ],
      },
      {
        type: 'line',
        lyrics: 'שיר ערש ישן לבובה ישנה',
        chords: [
          { chord: 'C', position: 0 },
          { chord: 'Am', position: 10 },
          { chord: 'F', position: 18 },
        ],
      },
      {
        type: 'line',
        lyrics: 'ומעיניה מציצים חלומות',
        chords: [
          { chord: 'G', position: 0 },
          { chord: 'C', position: 12 },
        ],
      },
      { type: 'section', content: 'פזמון' },
      {
        type: 'line',
        lyrics: 'הללויה על העולם',
        chords: [
          { chord: 'F', position: 0 },
          { chord: 'G', position: 8 },
        ],
      },
      {
        type: 'line',
        lyrics: 'הללויה ישיר הכל',
        chords: [
          { chord: 'C', position: 0 },
          { chord: 'Am', position: 8 },
        ],
      },
      {
        type: 'line',
        lyrics: 'הללויה על העולם',
        chords: [
          { chord: 'F', position: 0 },
          { chord: 'G', position: 8 },
        ],
      },
      {
        type: 'line',
        lyrics: 'הללויה ישיר הכל',
        chords: [
          { chord: 'C', position: 0 },
          { chord: 'Am', position: 8 },
        ],
      },
      { type: 'section', content: 'בית 2' },
      {
        type: 'line',
        lyrics: 'בחצר ישנה עץ לבלוב עומד',
        chords: [
          { chord: 'C', position: 0 },
          { chord: 'Am', position: 10 },
          { chord: 'F', position: 19 },
        ],
      },
      {
        type: 'line',
        lyrics: 'ומעליו שמיים נפרשים',
        chords: [
          { chord: 'G', position: 0 },
          { chord: 'C', position: 11 },
        ],
      },
      {
        type: 'line',
        lyrics: 'ומשם ציפור ברוח חופשית',
        chords: [
          { chord: 'C', position: 0 },
          { chord: 'Am', position: 10 },
          { chord: 'F', position: 18 },
        ],
      },
      {
        type: 'line',
        lyrics: 'פורשת כנף לעננים',
        chords: [
          { chord: 'G', position: 0 },
          { chord: 'C', position: 10 },
        ],
      },
    ],
  },
  {
    id: 'erev-shel-shoshanim',
    title: 'ערב של שושנים',
    artist: 'משה דץ',
    language: 'he',
    chordsData: [
      { type: 'section', content: 'בית 1' },
      {
        type: 'line',
        lyrics: 'ערב של שושנים',
        chords: [
          { chord: 'Dm', position: 0 },
          { chord: 'Gm', position: 7 },
        ],
      },
      {
        type: 'line',
        lyrics: 'נצא נא אל הבוסתן',
        chords: [
          { chord: 'A7', position: 0 },
          { chord: 'Dm', position: 9 },
        ],
      },
      {
        type: 'line',
        lyrics: 'מור בשמים ולבונה',
        chords: [
          { chord: 'Dm', position: 0 },
          { chord: 'Gm', position: 9 },
        ],
      },
      {
        type: 'line',
        lyrics: 'לרגלך מפתן',
        chords: [
          { chord: 'A7', position: 0 },
          { chord: 'Dm', position: 7 },
        ],
      },
      { type: 'section', content: 'פזמון' },
      {
        type: 'line',
        lyrics: 'לילה יורד לאט',
        chords: [
          { chord: 'F', position: 0 },
          { chord: 'C', position: 8 },
        ],
      },
      {
        type: 'line',
        lyrics: 'ורוח שושן נושבת',
        chords: [
          { chord: 'Dm', position: 0 },
          { chord: 'Bb', position: 9 },
        ],
      },
      {
        type: 'line',
        lyrics: 'הבה אלחש לך שיר בלאט',
        chords: [
          { chord: 'Gm', position: 0 },
          { chord: 'A7', position: 10 },
          { chord: 'Dm', position: 18 },
        ],
      },
    ],
  },
  {
    id: 'lu-yehi',
    title: 'לו יהי',
    artist: 'נעמי שמר',
    language: 'he',
    chordsData: [
      { type: 'section', content: 'בית 1' },
      {
        type: 'line',
        lyrics: 'עוד יש מפרש לבן באופק',
        chords: [
          { chord: 'G', position: 0 },
          { chord: 'C', position: 8 },
          { chord: 'G', position: 16 },
        ],
      },
      {
        type: 'line',
        lyrics: 'מול ענן שחור כבד',
        chords: [
          { chord: 'Em', position: 0 },
          { chord: 'C', position: 8 },
          { chord: 'D', position: 14 },
        ],
      },
      {
        type: 'line',
        lyrics: 'כל שנבקש לו יהי',
        chords: [
          { chord: 'G', position: 0 },
          { chord: 'C', position: 8 },
          { chord: 'D', position: 12 },
        ],
      },
      { type: 'section', content: 'פזמון' },
      {
        type: 'line',
        lyrics: 'לו יהי לו יהי',
        chords: [
          { chord: 'G', position: 0 },
          { chord: 'D', position: 7 },
        ],
      },
      {
        type: 'line',
        lyrics: 'אנא לו יהי',
        chords: [
          { chord: 'Em', position: 0 },
          { chord: 'C', position: 5 },
        ],
      },
      {
        type: 'line',
        lyrics: 'כל שנבקש לו יהי',
        chords: [
          { chord: 'G', position: 0 },
          { chord: 'C', position: 8 },
          { chord: 'D', position: 12 },
          { chord: 'G', position: 16 },
        ],
      },
    ],
  },
  {
    id: 'wonderwall',
    title: 'Wonderwall',
    artist: 'Oasis',
    language: 'en',
    chordsData: [
      { type: 'section', content: 'Verse 1' },
      {
        type: 'line',
        lyrics: 'Today is gonna be the day',
        chords: [
          { chord: 'Em7', position: 0 },
          { chord: 'G', position: 13 },
        ],
      },
      {
        type: 'line',
        lyrics: "That they're gonna throw it back to you",
        chords: [
          { chord: 'Dsus4', position: 0 },
          { chord: 'A7sus4', position: 20 },
        ],
      },
      {
        type: 'line',
        lyrics: "By now you should've somehow",
        chords: [
          { chord: 'Em7', position: 0 },
          { chord: 'G', position: 15 },
        ],
      },
      {
        type: 'line',
        lyrics: 'Realized what you gotta do',
        chords: [
          { chord: 'Dsus4', position: 0 },
          { chord: 'A7sus4', position: 13 },
        ],
      },
      { type: 'section', content: 'Chorus' },
      {
        type: 'line',
        lyrics: "Because maybe you're gonna be the one that saves me",
        chords: [
          { chord: 'C', position: 0 },
          { chord: 'D', position: 8 },
          { chord: 'Em', position: 35 },
        ],
      },
      {
        type: 'line',
        lyrics: "And after all you're my wonderwall",
        chords: [
          { chord: 'C', position: 0 },
          { chord: 'D', position: 10 },
          { chord: 'Em', position: 22 },
        ],
      },
    ],
  },
  {
    id: 'hotel-california',
    title: 'Hotel California',
    artist: 'Eagles',
    language: 'en',
    chordsData: [
      { type: 'section', content: 'Verse 1' },
      {
        type: 'line',
        lyrics: 'On a dark desert highway, cool wind in my hair',
        chords: [
          { chord: 'Am', position: 0 },
          { chord: 'E7', position: 25 },
        ],
      },
      {
        type: 'line',
        lyrics: 'Warm smell of colitas rising up through the air',
        chords: [
          { chord: 'G', position: 0 },
          { chord: 'D', position: 22 },
        ],
      },
      {
        type: 'line',
        lyrics: 'Up ahead in the distance, I saw a shimmering light',
        chords: [
          { chord: 'F', position: 0 },
          { chord: 'C', position: 26 },
        ],
      },
      {
        type: 'line',
        lyrics: 'My head grew heavy and my sight grew dim',
        chords: [
          { chord: 'Dm', position: 0 },
          { chord: 'E7', position: 20 },
        ],
      },
      {
        type: 'line',
        lyrics: 'I had to stop for the night',
        chords: [
          { chord: 'Am', position: 0 },
        ],
      },
      { type: 'section', content: 'Chorus' },
      {
        type: 'line',
        lyrics: 'Welcome to the Hotel California',
        chords: [
          { chord: 'F', position: 0 },
          { chord: 'C', position: 15 },
        ],
      },
      {
        type: 'line',
        lyrics: "Such a lovely place, such a lovely face",
        chords: [
          { chord: 'E7', position: 0 },
          { chord: 'Am', position: 21 },
        ],
      },
    ],
  },
];
