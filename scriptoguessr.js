const TRANSLATION = 'kjv';

let BIBLE_MAP = null;
const BOOKS = [
   'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
   'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
   '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
   'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms',
   'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah',
   'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea',
   'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum',
   'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
   'Matthew', 'Mark', 'Luke', 'John', 'Acts',
   'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
   'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
   '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus',
   'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
   '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

let currentVerse = null;
let selectedPosition = null;
let score = 0;

async function buildBibleMap() {
   const map = {};
   console.log('Building Bible map...');
   
   // Start with a simpler map for testing
   const commonVerses = {
       Genesis: { chapters: { 1: 31, 2: 25, 3: 24 }},
       Exodus: { chapters: { 1: 22, 2: 25, 3: 22 }},
       Psalms: { chapters: { 1: 6, 2: 12, 23: 6 }},
       Matthew: { chapters: { 1: 25, 2: 23, 3: 17 }},
       John: { chapters: { 1: 51, 2: 25, 3: 36 }},
       Revelation: { chapters: { 1: 20, 2: 29, 3: 22 }}
   };
   
   // Build basic map for all books
   for (const book of BOOKS) {
       map[book] = { chapters: { 1: 30 }}; // Default assumption
   }

   return {...map, ...commonVerses};
}

async function displayVerse(book, chapter, verse, text, reveal = false) {
   const response = await Promise.all([
       fetch(`https://bible-api.com/${book}+${chapter}:${verse-1}?translation=${TRANSLATION}`),
       fetch(`https://bible-api.com/${book}+${chapter}:${verse+1}?translation=${TRANSLATION}`)
   ]);
   
   const [prevData, nextData] = await Promise.all(response.map(r => r.json()));
   
   const verseDisplay = document.getElementById('verse-content');
   verseDisplay.innerHTML = `
       <div class="verse-reference" style="${reveal ? 'filter: none' : ''}">
           ${book} ${chapter}:${verse}
       </div>
       <div class="verse-text">
           <span class="verse-context">${prevData.error ? '' : prevData.text.trim()} </span>
           ${text}
           <span class="verse-context"> ${nextData.error ? '' : nextData.text.trim()}</span>
       </div>`;

   if (reveal) {
       document.querySelectorAll('.verse-context').forEach(el => el.style.filter = 'none');
   }
}

function loadSVG() {
   console.log('Attempting to load SVG...');
   $.ajax({
       url: 'book.svg',
       dataType: 'text',
       success: function(svgText) {
           console.log('SVG loaded successfully');
           document.getElementById('nav-container').innerHTML = svgText;
           const svg = document.querySelector('svg');
           svg.id = 'bible-svg';
           console.log('SVG added to DOM with id:', svg.id);
           initializeEventListeners();
       },
       error: function(error) {
           console.error('Error loading SVG:', error);
           document.getElementById('nav-container').innerHTML = 'Error loading Bible navigation';
       }
   });
}

function initializeEventListeners() {
   console.log('Initializing event listeners...');
   const svg = document.querySelector('#bible-svg');
   if (!svg) {
       console.error('SVG element not found');
       return;
   }

   svg.addEventListener('click', (e) => {
       console.log('SVG clicked');
       const rect = svg.getBoundingClientRect();
       const x = e.clientX - rect.left;
       const percentage = (x / rect.width) * 100;
       
       selectedPosition = calculateBiblePosition(percentage);
       console.log('Selected position:', selectedPosition);
       
       const marker = svg.querySelector('#position-marker');
       if (marker) {
           const svgX = (percentage / 100) * 260 + 20;
           marker.setAttribute('x1', svgX);
           marker.setAttribute('x2', svgX);
           console.log('Marker updated to position:', svgX);
       }

       document.getElementById('reference-display').textContent = 
           `${selectedPosition.book} ${selectedPosition.chapter}:${selectedPosition.verse}`;
       
       openBible();
       document.getElementById('submit-guess').style.display = 'block';
   });
}

function calculateBiblePosition(percentage) {
   const bookIndex = Math.floor((percentage / 100) * BOOKS.length);
   const book = BOOKS[bookIndex] || BOOKS[0];
   const chapters = Object.keys(BIBLE_MAP[book].chapters).length;
   const chapter = Math.floor(Math.random() * chapters) + 1;
   const maxVerse = BIBLE_MAP[book].chapters[chapter];
   const verse = Math.floor(Math.random() * maxVerse) + 1;
   
   return { book, chapter, verse };
}

async function fetchRandomVerse() {
   console.log('Fetching random verse...');
   try {
       const response = await fetch(
           `https://bible-api.com/data/${TRANSLATION}/random`
       );
       const data = await response.json();

       currentVerse = data.random_verse;
       await displayVerse(currentVerse.book, currentVerse.chapter, currentVerse.verse, currentVerse.text);
       
       closeBible();
       document.getElementById('submit-guess').style.display = 'none';
       document.getElementById('next-verse').style.display = 'none';
   } catch (error) {
       console.error('Error fetching verse:', error);
       document.getElementById('verse-content').textContent = 'Error loading verse';
   }
}

function openBible() {
   document.getElementById('navigation-panel').classList.add('opened');
   document.getElementById('reference-display').style.display = 'block';
}

function closeBible() {
   document.getElementById('navigation-panel').classList.remove('opened');
   document.getElementById('reference-display').style.display = 'none';
}

document.getElementById('submit-guess').addEventListener('click', async () => {
   if (!selectedPosition) {
       alert('Please select a position first');
       return;
   }

   const points = calculateScore(selectedPosition, currentVerse);
   score = points;
   document.querySelector('.score').textContent = `Score: ${points}/5000`;
   
   await displayVerse(currentVerse.book, currentVerse.chapter, currentVerse.verse, currentVerse.text, true);
   
   document.getElementById('submit-guess').style.display = 'none';
   document.getElementById('next-verse').style.display = 'inline-block';
});

document.getElementById('next-verse').addEventListener('click', () => {
   document.getElementById('submit-guess').style.display = 'none';
   document.getElementById('next-verse').style.display = 'none';
   closeBible();
   fetchRandomVerse();
});

function calculateScore(guess, actual) {
   if (!guess || !actual) return 0;

   const guessBookIndex = BOOKS.indexOf(guess.book);
   const actualBookIndex = BOOKS.indexOf(actual.book);
   
   const bookDistance = Math.abs(guessBookIndex - actualBookIndex);
   const chapterDistance = Math.abs(guess.chapter - actual.chapter);
   const verseDistance = Math.abs(guess.verse - actual.verse);
   
   const totalDistance = (bookDistance / BOOKS.length) + (chapterDistance / 150) + (verseDistance / 176);
   return Math.round(5000 * Math.exp(-5 * totalDistance));
}

async function initGame() {
   console.log('Starting game initialization...');
   BIBLE_MAP = await buildBibleMap();
   loadSVG();
   fetchRandomVerse();
}

$(document).ready(function() {
   console.log('Document ready, starting initialization...');
   initGame();
});