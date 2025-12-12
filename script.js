const OMDB_API_KEY = "d2fd4c15";
const MAX_PAGES_TO_SCAN = 2; // will check through 2 pages of results
const MAX_DETAILS_TO_FETCH = 25; //sample size 20 films
const WM_API_KEY = "14XL20DMuUipuYpKF7YAmYSALjPBepRm66mkhgig";
const WATCHMODE_REGION = "US";

//pop-up box
const infoBtn = document.getElementById("infoBtn");
const modal = document.getElementById("infoMode");
const closeBtn = document.querySelector(".close");
const downloadTicketBtn = document.getElementById("download-ticket-btn");
infoBtn.addEventListener("click", () => {
  modal.style.display = "flex"; // show modal
});

closeBtn.addEventListener("click", () => {
  modal.style.display = "none";  //hide modal
});
// interaction: clicking outside modal closes it
window.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
  }
});
// ----------------------------------


// create varaibles for user search data from DOM
const keywordInput = document.getElementById("keyword-input");
const searchBtn = document.getElementById("search-btn");
const searchSound = document.getElementById("search-sound");
const filtersForm = document.getElementById("filters-form");
const clearFiltersBtn = document.getElementById("clear-filters-btn");
const shuffleBtn = document.getElementById("shuffle-btn");
const ticketTemplate = new Image();
ticketTemplate.src = "assets/large-ticket.png";

// need to update results here later 
const posterContainer = document.querySelector(".poster");
const textContentContainer = document.querySelector(".text-content");
let metaDataContainer = document.querySelector(".meta-data");
let directorCastContainer = document.querySelector(".director-cast");
let synopsisContainer = document.querySelector(".synopsis");


//Main logic: OPEN MOVIE DATABASE API ----------------------------------

//Event Listeners ---------
if (searchBtn && searchSound) {
    searchBtn.addEventListener("click", () => {
        handleSearch();
        searchSound.currentTime = 0; // rewind so it plays every click
        searchSound.play().catch(err => {
            console.warn("Audio play blocked or failed:", err);
        });
    }) 
}
    //accepts enter on keyboard
keywordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
});
if (clearFiltersBtn) {  //resets filter
    clearFiltersBtn.addEventListener("click", () => {
      filtersForm.reset();
    });
}
document.getElementById("download-ticket-btn").addEventListener("click", () => { //download ticket BTN
  downloadTicketPNG("movie-night-ticket.png");
});

// SHUFFLE feature ––––––––
const SHUFFLE_WORDS = ( //keyword bank
  "love,train,home,summer,house,spring,hotel,river,one,letter," +
  "garden,night,dear,away,shadow,secret,drive,dream,shop,hour," +
  "dream,hunt,lord,fight,forest,ocean,robot,witch,space,city," +
  "music,king,queen,friend,game,war,first,crime,escape,magic," +
  "wind,whisper,planet,bridge,angel,school,radio,signal,heist,"+
  "spy,voice,challenge,journey,club,spirit,tree,life,fast,face"
).split(",");

let lastShuffleWord = null; //start empty, need to store last word avoid repeats
function getRandomShuffleWord() {
  if (SHUFFLE_WORDS.length === 0) return "";
  let word = "";
  let attempts = 0;

  do {
    word = SHUFFLE_WORDS[Math.floor(Math.random() * SHUFFLE_WORDS.length)].trim();
    attempts++;
  } while (word === lastShuffleWord && attempts < 8);

  lastShuffleWord = word;
  return word;
}
//once shf btn clicked--> insert into auto search
if (shuffleBtn && keywordInput) {
  shuffleBtn.addEventListener("click", () => {
    const word = getRandomShuffleWord();
    if (!word) return;
    keywordInput.value = word;

    //same search sound
    if (searchSound) {
      searchSound.currentTime = 0;
      searchSound.play().catch(() => {});
    }
    handleSearch();
  });
}


//Main SEarchbar ---------
async function handleSearch() {
    const keyword = keywordInput.value.trim(); //delete extra spaces befor/after keywords
  
    if (!keyword) {
      alert("Please type a keyword before searching.");
      return;
    }
    const filters = collectFilters();
    setLoadingState(true);
    clearResults(); //erase old results while searching
    clearStreamingUI();

    try {
        const movie = await findFilteredRandomMovie(keyword, filters);
        if (!movie) {
            showNoResultsMessage(keyword, filters);
          } else {
            renderMovie(movie);
            await renderStreamingSites(movie.imdbID);
            // TO-DO later: add function to draw movie ticket
          }
        } catch (err) {
          console.error(err);
          showErrorMessage("Hmm...unable to find a film with this keyword. Please try again.");
        } finally {
          setLoadingState(false);
        }
}

// Collect user input from FILTERS 
function collectFilters() {
    const languageInput = document.getElementById("language-input");
    const language = languageInput ? languageInput.value.trim() : "";
  
    // GENRES (checkboxes)
    const genreCheckboxes = Array.from(
      filtersForm.querySelectorAll('input[name="genre"]:checked')
    );
    const genres = genreCheckboxes.map((cb) => cb.value.toLowerCase());
  
    // DECADES (checkboxes)
    const decadeCheckboxes = Array.from(
      filtersForm.querySelectorAll('input[name="decade"]:checked')
    );
    const decades = decadeCheckboxes.map((cb) => parseInt(cb.value, 10));
        //use array map to parse numbers
  
    // RATING (singel select)
    const ratingRadio = filtersForm.querySelector('input[name="rating"]:checked');
    const rating = ratingRadio ? ratingRadio.value.toUpperCase() : "";
  
    // RUNTIME (single select)
    const runtimeRadio = filtersForm.querySelector('input[name="runtime"]:checked');
    const runtime = runtimeRadio ? runtimeRadio.value : ""; // "under90" or "over90"
  
    return {
      language,
      genres,
      decades,
      rating,
      runtime,
    };
  }

// FETCH & FILTER----------
async function findFilteredRandomMovie(keyword, filters) {
    // pass thru 4 main functions
    // 1: fetch matching keyword results from limited sample
    const basicResults = await fetchSearchResults(keyword, MAX_PAGES_TO_SCAN);
    if (!basicResults.length) {
        return null;
    }
    //2: fetch movie details (metadata)
    const detailedMovies = await fetchMovieDetailsBatch(
        basicResults,
        MAX_DETAILS_TO_FETCH);
    if (!detailedMovies.length) {
        return null;
    }
    // 3. apply filters
    const matchingMovies = detailedMovies.filter((movie) =>
        passesFilters(movie, filters));
    
    if (!matchingMovies.length) {
        return null;
    }
    //4. selects random mvie from passed list
    const randomIndex = Math.floor(Math.random() * matchingMovies.length);
    return matchingMovies[randomIndex];
}
async function fetchSearchResults(keyword, maxPages) {
    const allResults = [];

    for (let page = 1; page <= maxPages; page++) {
        const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(
          keyword
        )}&type=movie&page=${page}`;
    
        const res = await fetch(url);
        const data = await res.json();
        if (data.Response === "False") {
            //no results left or err
            if (page === 1) {
              //zero results
              return [];
            }
            break;
          }
        
        if (Array.isArray(data.Search)) {
            allResults.push(...data.Search);
        } else {
            break;
          }
        }
    return allResults;
}
async function fetchMovieDetailsBatch(basicResults, maxDetails) {
    const subset = basicResults.slice(0, maxDetails);
  
    const detailPromises = subset.map((item) => fetchMovieDetails(item.imdbID));
  
    const results = await Promise.all(detailPromises);
    // filters out errors/failed fetches
    return results.filter((movie) => movie && movie.Response === "True");
}
async function fetchMovieDetails(imdbID) {
    const url =`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${encodeURIComponent(
      imdbID
    )}&plot=short`;
  
    try {
      const res = await fetch(url);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error("Error fetching details for", imdbID, err);
      return null;
    }
}

// FILTER LOGIC----------
function passesFilters(movie, filters) {
    // language filter
    if (filters.language) {
      const target = filters.language.toLowerCase();
      const langField = (movie.Language || "").toLowerCase();
      const langs = langField.split(",").map((s) => s.trim());
  
      const languageMatches = langs.some((lang) => lang.includes(target));
      if (!languageMatches) return false;
    }

    //genre (at least 1 must match)
    if (filters.genres.length > 0) {
        const genreField = (movie.Genre || "").toLowerCase();
        const movieGenres = genreField.split(",").map((s) => s.trim());

        const hasGenre = filters.genres.some((genre) =>
        movieGenres.includes(genre.toLowerCase())
        );
        if (!hasGenre) return false;
    }
    // decade
    if (filters.decades.length > 0) {
        const yearStr = movie.Year || "";
        const yearMatch = yearStr.match(/\d{4}/); // select 1st 4 digits
        if (yearMatch) {
        const year = parseInt(yearMatch[0], 10);
        const inAnyDecade = filters.decades.some((decadeStart) => {
            const start = decadeStart;
            const end = decadeStart + 9;
            return year >= start && year <= end;
        });
        if (!inAnyDecade) return false;
        } else {
        // If we can't parse a year --> fail
        return false;
        }
    }
    // Rating
    if (filters.rating) {
        const rated = (movie.Rated || "").toUpperCase();
        if (rated !== filters.rating) return false;
    }
    // Runtime
    if (filters.runtime) {
        const runtimeStr = movie.Runtime || "";
        const runtimeMatch = runtimeStr.match(/\d+/);
        if (runtimeMatch) {
        const minutes = parseInt(runtimeMatch[0], 10);

        if (filters.runtime === "under90" && !(minutes > 0 && minutes <= 90)) {
            return false;
        }

        if (filters.runtime === "over90" && !(minutes > 90)) {
            return false;
        }
        } else {
        // if runtime is unknown --> fail
        return false;
        }
    }
    return true;
}

// ----- DISPLAY RESULT ----------
function clearResults() {
  // refresh poster
  if (posterContainer) posterContainer.innerHTML = "";
  
  // clears all text
  if (textContentContainer) textContentContainer.innerHTML = "";
  
  // rebuild containers after clear to re-append in renderMovie()
  if (textContentContainer) {
    textContentContainer.innerHTML = `
      <div class="meta-data"></div>
      <div class="director-cast"></div>
      <div class="synopsis"></div>
      <div id="streaming-sites"></div>
    `;
    metaDataContainer = textContentContainer.querySelector(".meta-data");
    directorCastContainer = textContentContainer.querySelector(".director-cast");
    synopsisContainer = textContentContainer.querySelector(".synopsis");
  }
}  

function renderMovie(movie) {
    clearResults();

    // show POSTER
    if (movie.Poster && movie.Poster !== "N/A") {  // if poster exists or NOT n/a, create placeholder
        const img = document.createElement("img");
        img.src = movie.Poster;
        img.alt = `${movie.Title} poster`;
        posterContainer.appendChild(img); //use append to update DOM, must append to each div/ container
    } else {
        posterContainer.textContent = "No poster available.";
    }
    // Title
    const titleEl = document.createElement("h3");
    titleEl.textContent = movie.Title || "Untitled";
    if (textContentContainer) {
      textContentContainer.insertBefore(titleEl, textContentContainer.firstChild);
      //use insertBefore instead of append make sure appears before other meta data
    }

    // Meta (year, rating, genre)
    const metaEl = document.createElement("p");
    metaEl.className = "meta meta-basic";
    const year = movie.Year || "Unknown year";
    const rated = movie.Rated && movie.Rated !== "N/A" ? movie.Rated : "Unrated";
    const genre = movie.Genre || "Unknown genre";
    metaEl.textContent = `${year} · ${rated} · ${genre}`; //comvert to string

    //IMDb score:
    const imdbRating = movie.imdbRating && movie.imdbRating !== "N/A"
        ? `${movie.imdbRating}/10`
        : "N/A";

    //Rotten Tomatoes score:
    let rotten = "N/A"; //default value
    if (movie.Ratings && Array.isArray(movie.Ratings)) { 
        //searches array for RT score, select 1st match
        const rtEntry = movie.Ratings.find(r => r.Source === "Rotten Tomatoes");
        if (rtEntry) rotten = rtEntry.Value; 
    }
    // Elements for scores
    const ratingsEl = document.createElement("p");
    ratingsEl.className = "meta";
    ratingsEl.textContent = `⭐ IMDb: ${imdbRating}   ·   🍅 Rotten Tomatoes: ${rotten}`;

    if (metaDataContainer) {
      metaDataContainer.appendChild(metaEl);
      metaDataContainer.appendChild(ratingsEl);
    }

    // Cast/director
    const castEl = document.createElement("p");
    castEl.className = "meta meta-cast";
    const director = movie.Director && movie.Director !== "N/A"
        ? `Director: ${movie.Director}`
        : "";
    const actors = movie.Actors && movie.Actors !== "N/A"
        ? `Cast: ${movie.Actors}`
        : "";
    // put info into 1 array
    castEl.textContent = [director, actors].filter(Boolean).join(" · ");

    if (directorCastContainer) {
      directorCastContainer.appendChild(castEl);
    }
  

    //Synopsis
    const plotEl = document.createElement("p");
    plotEl.textContent =
        movie.Plot && movie.Plot !== "N/A"
        ? movie.Plot
        : "No synopsis available for this title.";
    
    if (synopsisContainer) {
      synopsisContainer.appendChild(plotEl);
    }


    const today = new Date();
    const dateText = `${today.toLocaleDateString()}`;
    renderTicket({
      title: movie.Title,
      posterUrl: movie.Poster,
      dateText: dateText,
      tagline: "Send this to a friend and make it a plan."
    });
}


// ERROR handling ---------- 
function showNoResultsMessage(keyword, filters) {
    clearResults();
    posterContainer.textContent = "— No match —";
  
    const msg = document.createElement("p");
    msg.textContent = `We couldn't find any movies for “${keyword}” with the current filters :( Adjust your filters or try a different keyword.`;
  
    textContentContainer.appendChild(msg);
}
function showErrorMessage(message) {
    clearResults();
    posterContainer.textContent = "Error";
  
    const msg = document.createElement("p");
    msg.textContent = message;
  
    textContentContainer.appendChild(msg);
}
// loading state
// TO-D0 later: make loading animation w/ delay
function setLoadingState(isLoading) {
    if (isLoading) {
      searchBtn.disabled = true;
      searchBtn.textContent = "Searching...";
    } else {
      searchBtn.disabled = false;
      searchBtn.textContent = "Search";
    }
  }
//
//
//
//
 /* STREAMING AVAILABILITY - use WatchMode API ---------------------------------- */

async function getWatchmodeTitleId(imdbID) {
  const url = `https://api.watchmode.com/v1/search/?apiKey=${WM_API_KEY}` +
                `&search_field=imdb_id&search_value=${encodeURIComponent(imdbID)}`;
    //convert IMBd ID --> WatchMode ID
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (!data || !Array.isArray(data.title_results) || data.title_results.length === 0) {
    return null;
  }
  return data.title_results[0].id; // returns Watchmode title id
}
  
async function getWatchmodeSources(titleId) {
  //fetch sites w/ links
  const url = `https://api.watchmode.com/v1/title/${titleId}/sources/?apiKey=${WM_API_KEY}` +
              `&regions=${WATCHMODE_REGION}`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (!Array.isArray(data)) return [];
    return data;
}

function clearStreamingUI() {
  const container = document.getElementById("streaming-sites");
  if (container) {
    container.innerHTML = "";
  }
}

function renderSourcesUI(sources) {
  const container = document.getElementById("streaming-sites");
  if (!container) return;
  
  container.innerHTML = ""; // clear old search
  container.classList.add("streaming-list");
  
  const title = document.createElement("p");
  title.className = "meta";
  title.textContent = sources.length ? "Streaming on:" : "No online streaming found :(";
  container.appendChild(title);
  
  sources.forEach((s) => {
    // style streaming buttosn
    const a = document.createElement("a");//style with CSS
      a.href = s.web_url || s.url || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = (s.name || s.source_name || "Streaming link").trim();
      a.className = "streaming-chip";

    if (a.href === "#") {
       a.classList.add("is-disabled");
    }
  
    container.appendChild(a);
    });
}

async function renderStreamingSites(imdbID) {

  const container = document.getElementById("streaming-sites");
    if (container) {
      container.innerHTML = `<p class="meta">Streaming on: loading…</p>`;
    }
  
    try {
      const titleId = await getWatchmodeTitleId(imdbID);
  
      if (!titleId) {
        renderSourcesUI([]);
        return;
      }
      const sources = await getWatchmodeSources(titleId);

      function filterSources(sources) {
        // Prefer free, rent, subscribe, then buy (customize order)
        const rank = (type) => {
          const t = (type || "").toLowerCase();
          if (t === "sub") return 1;
          if (t === "rent") return 2;
          if (t === "ads") return 3;
          if (t === "free") return 4;
          if (t === "buy") return 5;
          return 99;
        };
      
        const bestByName = new Map();
      
        for (const s of sources) {
          const name = (s.name || s.source_name || "").trim();
          if (!name) continue;
      
          const current = bestByName.get(name);
          if (!current) {
            bestByName.set(name, s);
            continue;
          }
      
          // keep the higher ran -- if tie, prefer web_url
          const better =
            rank(s.type) < rank(current.type) ||
            (rank(s.type) === rank(current.type) && !!s.web_url && !current.web_url);
      
          if (better) bestByName.set(name, s);
        }
      
        return Array.from(bestByName.values());
      }
      
      const uniqueSources = filterSources(sources);
      renderSourcesUI(uniqueSources);
    } 
    catch (err) {
      console.error("Watchmode error:", err);
      if (container) {
        container.innerHTML = `<p class="meta">Where to watch: error loading sources.</p>`;
      }
    }
  }


  // Attempted Ticket Download  :(----------------
const ticketCanvas = document.getElementById("ticket-canvas");
const ticketCtx = ticketCanvas.getContext("2d");


function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawPosterCover(ctx, img, x, y, w, h, cornerRadius = 18) {
  // object-fit: cover for canvas
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;

  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;

  ctx.save();
  roundRect(ctx, x, y, w, h, cornerRadius);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text).split(/\s+/);
  let line = "";
  let lines = 0;

  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines++;
      line = words[i];
      if (lines >= maxLines - 1) break;
    }
  }

  // last line formatting
  let lastLine = line;
  while (ctx.measureText(lastLine + "…").width > maxWidth && lastLine.length > 0) {
    lastLine = lastLine.slice(0, -1);
  }
  if (line !== lastLine) lastLine = lastLine + "…";
  ctx.fillText(lastLine, x, y + lines * lineHeight);
  return lines + 1;
}

async function renderTicket({
  title = "Unknown Title",
  posterUrl = "",
  dateText = ""
} = {}) {
  const W = ticketCanvas.width;
  const H = ticketCanvas.height;
  const ctx = ticketCtx;

  ctx.clearRect(0, 0, W, H);

  // template background 
  await new Promise((resolve, reject) => {
    if (ticketTemplate.complete && ticketTemplate.naturalWidth) return resolve();
    ticketTemplate.onload = resolve;
    ticketTemplate.onerror = reject;
  });
  ctx.drawImage(ticketTemplate, 0, 0, W, H);

  // poster frame
  const posterX = Math.round(W * 0.06);
  const posterY = Math.round(H * 0.18);
  const posterW = Math.round(W * 0.22);
  const posterH = Math.round(H * 0.64);

  // draw poster
  if (posterUrl && posterUrl !== "N/A") {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = posterUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      drawPosterCover(ctx, img, posterX, posterY, posterW, posterH, 22);
    } catch (e) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.font = "600 34px Roboto Mono, monospace";
      ctx.fillText("Poster blocked (CORS)", posterX + 20, posterY + 70);
    }
  }


  //text placement
  const textX = Math.round(W * 0.32);
  const textY = Math.round(H * 0.30);
  const textW = Math.round(W * 0.40);

  //ticket headline
  ctx.fillStyle = "#2b2019";
  ctx.font = "800 64px Roboto Mono, monospace";
  ctx.fillText("LET'S WATCH", textX, textY);

  //movie title (wrapped)
  ctx.font = "800 62px Roboto Mono, monospace";
  const quotedTitle = `“${String(title).toUpperCase()}”`;
  wrapText(ctx, quotedTitle, textX, textY + 80, textW, 72, 2);
  
  //date
  ctx.save();

  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.font = "600 34px Roboto Mono, monospace";
  ctx.fillStyle = "rgba(43,32,25,0.8)";

  // original textX + controlled offset
  const dateX = textX + Math.round(textW * 0.85);

  ctx.fillText(
    dateText,
    dateX,
    Math.round(H * 0.82)
  );

  ctx.restore();
}


// need proxy for imgs --> download failed
function downloadTicketPNG(filename = "movie-ticket.png") {
  try {
    ticketCanvas.toBlob((blob) => {
      if (!blob) {
        alert( //error msg
          "Download failed. This download of the poster image is blocked by CORS :( " +
          "Booo. [Right click on the image > Save As] to save or try a different movie. "
        );
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  } catch (err) {
    console.error("Ticket download error:", err);
    alert(
       "Download failed. This download of the poster image is blocked by CORS :( " +
        "Booo. [Right click on the image > Save As] to save or try a different movie. "
    );
  }
}

  

  





  