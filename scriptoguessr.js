const TRANSLATION = 'kjv';
const BOOKS = Object.keys(BIBLE_DATA);
const POS_WIDTH = 5;
const BIND_WIDTH = 20;
const MAX_ROUNDS = 5;

let currentVerse = null;
let selectedPosition = null;
let score = 0;
let rounds = 0;
let totalScore = 0;

let selectEnabled = false;


async function displayVerse(book, chapter, verse, text) {
   const response = await Promise.all([
       fetch(`https://bible-api.com/${book}+${chapter}:${verse-1}?translation=${TRANSLATION}`),
       fetch(`https://bible-api.com/${book}+${chapter}:${verse+1}?translation=${TRANSLATION}`)
   ]);
   
   const [prevData, nextData] = await Promise.all(response.map(r => r.json()));
   
   const verseDisplay = document.getElementById('verse-content');
   verseDisplay.innerHTML = `
       <div class="verse-reference">
           ${book} ${chapter}:${verse}
       </div>
       <div class="verse-text">
           <span class="verse-context">${prevData.error ? '' : prevData.text.trim()} </span>
           ${text}
           <span class="verse-context"> ${nextData.error ? '' : nextData.text.trim()}</span>
       </div>`;
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
           hidePositions();
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

       if (!selectEnabled) {
         console.warn("Select is not enabled");
         return;
       }

       const rect = svg.getBoundingClientRect();
       const x = e.clientX - rect.left;
       const svgWidth = svg.width.baseVal.value;
       const scaleX = svgWidth / rect.width;
       const svgX = x * scaleX;

       if (svgX < BIND_WIDTH || svgX > svgWidth-BIND_WIDTH) {
         console.warn("Click out of bounds");
         return;
       }

       const percentage = ((svgX - BIND_WIDTH) / (svgWidth-2*BIND_WIDTH)) * 100;
       selectedPosition = calculateBiblePosition(percentage);

       const marker = svg.querySelector('#position-marker');
       if (marker) {
           marker.setAttribute('x1', svgX);
           marker.setAttribute('x2', svgX);
           marker.setAttribute('stroke-width', POS_WIDTH);
           console.log('Marker updated to position:', svgX);
       }

       document.getElementById('reference-display').textContent = 
           `${selectedPosition.book} ${selectedPosition.chapter}:${selectedPosition.verse}`;
       
       openBible();
       document.getElementById('submit-guess').style.display = 'block';
   });
}

const TOTAL_VERSES = BOOKS.reduce((bookAcc, currentBook) => {
    const currentBookData = BIBLE_DATA[currentBook];
    return bookAcc + currentBookData.versesPerChapter.reduce((chapAcc, verses) => chapAcc + verses, 0);
}, 0);

const cumulativeVersesPerBook = [];
let cumulative = 0;
for (let book of BOOKS) {
    cumulativeVersesPerBook.push(cumulative);
    const bookData = BIBLE_DATA[book];
    cumulative += bookData.versesPerChapter.reduce((a, b) => a + b, 0);
}

const cumulativeVersesPerChapter = {};

BOOKS.forEach(book => {
    const bookData = BIBLE_DATA[book];
    cumulativeVersesPerChapter[book] = [];
    let cum = 0;
    bookData.versesPerChapter.forEach(verses => {
        cumulativeVersesPerChapter[book].push(cum);
        cum += verses;
    });
});


/**
 * Optimized function to calculate total percentage using precomputed caches.
 * @param {Object} reference - An object with properties: book, chapter, verse.
 * @returns {number} The total percentage (0 to 100) up to the reference.
 */
function calculateVersePercentage(reference) {
    const { book, chapter, verse } = reference;

    // Validate the book
    const bookIndex = BOOKS.indexOf(book);
    if (bookIndex === -1) {
        throw new Error(`Invalid book name: ${book}`);
    }

    const bookData = BIBLE_DATA[book];
    if (!bookData) {
        throw new Error(`No data found for book: ${book}`);
    }

    // Validate the chapter
    if (chapter < 1 || chapter > bookData.chapters) {
        throw new Error(`Invalid chapter number: ${chapter} for book ${book}`);
    }

    // Validate the verse
    const versesInChapter = bookData.versesPerChapter[chapter - 1];
    if (verse < 1 || verse > versesInChapter) {
        throw new Error(`Invalid verse number: ${verse} for ${book} Chapter ${chapter}`);
    }

    // Calculate verses up to reference using caches
    const versesUpToReference = cumulativeVersesPerBook[bookIndex] +
                                 cumulativeVersesPerChapter[book][chapter - 1] +
                                 verse;

    // Calculate percentage
    const percentage = (versesUpToReference / TOTAL_VERSES) * 100;

    // Round to two decimal places for readability
    return percentage;
}

function calculateBiblePosition(percentage) {
   // Step 1: Find the Book
   let cumulativePercentage = 0;
   let selectedBook = BOOKS[0];
   for (let book of BOOKS) {
       cumulativePercentage += BIBLE_DATA[book].percentage;
       if (percentage <= cumulativePercentage) {
           selectedBook = book;
           break;
       }
   }

   // Calculate the local percentage within the selected book
   const previousCumulative = cumulativePercentage - BIBLE_DATA[selectedBook].percentage;
   const localPercentage = ((percentage - previousCumulative) / BIBLE_DATA[selectedBook].percentage) * 100;

   // Step 2: Find the Chapter within the Book
   const versesPerChapter = BIBLE_DATA[selectedBook].versesPerChapter;
   const totalVerses = versesPerChapter.reduce((sum, verses) => sum + verses, 0);
   const targetVerseNumber = Math.floor((localPercentage / 100) * totalVerses) + 1;

   let cumulativeVerses = 0;
   let selectedChapter = 1;
   for (let i = 0; i < versesPerChapter.length; i++) {
       cumulativeVerses += versesPerChapter[i];
       if (targetVerseNumber <= cumulativeVerses) {
           selectedChapter = i + 1;
           break;
       }
   }

   // Calculate the verse number within the selected chapter
   const previousCumulativeVerses = cumulativeVerses - versesPerChapter[selectedChapter - 1];
   const verseInChapter = targetVerseNumber - previousCumulativeVerses;

   return {
       book: selectedBook,
       chapter: selectedChapter,
       verse: verseInChapter
   };
}

/**
 * Calculates the Bible reference (book, chapter, verse) based on the given percentage.
 * @param {number} percentage - A value between 0 and 100 representing the position in the Bible.
 * @returns {Object} An object containing the book, chapter, and verse.
 */
function calculateBiblePosition(percentage) {
    if (percentage < 0 || percentage > 100) {
        throw new Error("Percentage must be between 0 and 100.");
    }

    // Convert percentage to target verse number
    const targetVerseNumber = Math.floor((percentage / 100) * TOTAL_VERSES);

    // Find the book
    let selectedBookIndex = 0;
    for (let i = 0; i < cumulativeVersesPerBook.length; i++) {
        if (targetVerseNumber < cumulativeVersesPerBook[i + 1] || i === cumulativeVersesPerBook.length - 1) {
            selectedBookIndex = i;
            break;
        }
    }

    const selectedBook = BOOKS[selectedBookIndex];
    const bookData = BIBLE_DATA[selectedBook];

    // Calculate the verse number within the book
    const versesBeforeBook = cumulativeVersesPerBook[selectedBookIndex];
    const verseNumberInBook = targetVerseNumber - versesBeforeBook + 1; // +1 because verses start at 1

    // Find the chapter
    const versesPerChapter = bookData.versesPerChapter;
    let selectedChapter = 1;
    let cumulativeChapterVerses = 0;

    for (let i = 0; i < versesPerChapter.length; i++) {
        if (verseNumberInBook <= cumulativeChapterVerses + versesPerChapter[i]) {
            selectedChapter = i + 1;
            break;
        }
        cumulativeChapterVerses += versesPerChapter[i];
    }

    // Calculate the verse number within the chapter
    const verseInChapter = verseNumberInBook - cumulativeChapterVerses;

    return {
        book: selectedBook,
        chapter: selectedChapter,
        verse: verseInChapter
    };
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
       selectEnabled = true;
   } catch (error) {
       console.error('Error fetching verse:', error);
       document.getElementById('verse-content').textContent = 'Error loading verse';
   }
}

function openBible() {
   //document.getElementById('navigation-panel').classList.add('opened');
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

   // disable selection
   selectEnabled = false;

   const points = calculateScore(selectedPosition, currentVerse);
   score = points;
   totalScore += score;
   rounds += 1;
   document.querySelector('.score').textContent = `Score: ${points}/5000`;
   document.querySelector('.total-score').textContent = `Total: ${totalScore}/${5000*rounds}`;

   ansPercent = calculateVersePercentage(currentVerse);

   console.log("position: ", calculateBiblePosition(ansPercent));

   console.log("Answer percent: ", ansPercent);
   const svg = document.querySelector('#bible-svg');
   if (!svg) {
       console.error('SVG element not found');
       return;
   }
   const rect = svg.getBoundingClientRect();
   const svgWidth = svg.width.baseVal.value;
   const marker = svg.querySelector('#ans-position-marker');
   if (marker) {
      const svgX = (ansPercent / 100) * (svgWidth-2*BIND_WIDTH) + BIND_WIDTH;
      marker.setAttribute('x1', svgX);
      marker.setAttribute('x2', svgX);
      marker.setAttribute('stroke-width', POS_WIDTH);
      console.log('Marker updated to position:', svgX);
   }
   
   // Reveal verse ref and context
   document.querySelectorAll('.verse-reference').forEach(el => el.style.filter = 'none');
   document.querySelectorAll('.verse-context').forEach(el => el.style.filter = 'none');
   
   document.getElementById('submit-guess').style.display = 'none';
   document.getElementById('next-verse').style.display = 'inline-block';

   if (rounds === MAX_ROUNDS) {
      // Finish game
      alert("Game is finished");
   }
});

document.getElementById('next-verse').addEventListener('click', () => {
   document.getElementById('submit-guess').style.display = 'none';
   document.getElementById('next-verse').style.display = 'none';
   closeBible();
   hidePositions();
   fetchRandomVerse();
});

function hidePositions() {
   const svg = document.querySelector('#bible-svg');
   if (!svg) {
       console.error('SVG element not found');
       return;
   }
   const selMarker = svg.querySelector('#position-marker');
   if (selMarker) {
    selMarker.setAttribute('stroke-width', 0);
   }
   const ansMarker = svg.querySelector('#ans-position-marker');
   if (ansMarker) {
    ansMarker.setAttribute('stroke-width', 0);
   }
}

/**
 * Converts a Bible reference to its sequential verse number.
 * @param {Object} reference - An object with properties: book, chapter, verse.
 * @returns {number} The sequential verse number.
 */
function getSequentialVerseNumber(reference) {
    const { book, chapter, verse } = reference;

    // Validate the book
    const bookIndex = BOOKS.indexOf(book);
    if (bookIndex === -1) {
        throw new Error(`Invalid book name: ${book}`);
    }

    // Validate the chapter
    const bookData = BIBLE_DATA[book];
    if (chapter < 1 || chapter > bookData.chapters) {
        throw new Error(`Invalid chapter number: ${chapter} for book ${book}`);
    }

    // Validate the verse
    const versesInChapter = bookData.versesPerChapter[chapter - 1];
    if (verse < 1 || verse > versesInChapter) {
        throw new Error(`Invalid verse number: ${verse} for ${book} Chapter ${chapter}`);
    }

    let sequentialNumber = 0;

    // Sum all verses in preceding books
    for (let i = 0; i < bookIndex; i++) {
        const currentBook = BOOKS[i];
        const currentBookData = BIBLE_DATA[currentBook];
        sequentialNumber += currentBookData.versesPerChapter.reduce((a, b) => a + b, 0);
    }

    // Sum all verses in preceding chapters of the current book
    for (let c = 1; c < chapter; c++) {
        sequentialNumber += bookData.versesPerChapter[c - 1];
    }

    // Add the verse number
    sequentialNumber += verse;

    return sequentialNumber;
}

/**
 * Calculates the score based on the number of verses separating guess and actual.
 * @param {Object} guess - The guessed position with properties: book, chapter, verse.
 * @param {Object} actual - The actual position with properties: book, chapter, verse.
 * @returns {number} The calculated score.
 */
function calculateScore(guess, actual) {
    if (!guess || !actual) return 0;

    try {
        const guessSequential = getSequentialVerseNumber(guess);
        const actualSequential = getSequentialVerseNumber(actual);

        const distance = Math.abs(guessSequential - actualSequential);
        console.log("Distance: ", distance);

        // Determine the total number of verses in the Bible
        let totalVerses = 0;
        for (let book of BOOKS) {
            totalVerses += BIBLE_DATA[book].versesPerChapter.reduce((a, b) => a + b, 0);
        }
        console.log("Total verses: ", totalVerses);

        // Normalize the distance
        const normalizedDistance = distance / totalVerses;

        // Define a scoring formula
        // For example, using exponential decay:
        // Score decreases as distance increases
        // Adjust the decay rate (k) as needed
        const k = 10; // Decay rate
        const score = Math.round(5000 * Math.exp(-k * normalizedDistance));

        return score;
    } catch (error) {
        console.error(error.message);
        return 0;
    }
}

async function initGame() {
   console.log('Starting game initialization...');
   loadSVG();
   fetchRandomVerse();
}

$(document).ready(function() {
   console.log('Document ready, starting initialization...');
   initGame();
});