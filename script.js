const OMDB_API_KEY = "d2fd4c15";
const MAX_PAGES_TO_SCAN = 2;   // will check through 2 pages of results
const MAX_DETAILS_TO_FETCH = 25; //sample size 20 films

// create varaibles for user search data from DOM
const keywordInput = document.getElementById("keyword-input");
const searchBtn = document.getElementById("search-btn");
const searchSound = document.getElementById("search-sound");
const filtersForm = document.getElementById("filters-form");
const clearFiltersBtn = document.getElementById("clear-filters-btn");

// need to update results here later 
const posterContainer = document.querySelector(".poster");
const textContentContainer = document.querySelector(".text-content");

// TO DO --- need to add querySelector for all of the div classes within /text-content !!!!!!!!!!!!!!!!!!!!!!!
// ned to stylize grid & text for content using DOM

// movie ticket -- TO-DO LATER
const ticketCanvas = document.getElementById("ticket-canvas");
const downloadTicketBtn = document.getElementById("download-ticket-btn");

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

    try {
        const movie = await findFilteredRandomMovie(keyword, filters);
        if (!movie) {
            showNoResultsMessage(keyword, filters);
          } else {
            renderMovie(movie);
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
    posterContainer.innerHTML = "";
    textContentContainer.innerHTML = "";
}

function renderMovie(movie) {
    clearResults();

    // show POSTER
    if (movie.Poster && movie.Poster !== "N/A") {
        const img = document.createElement("img");
        img.src = movie.Poster;
        img.alt = `${movie.Title} poster`;
        posterContainer.appendChild(img);
    } else {
        posterContainer.textContent = "No poster available.";
    }
    // Title
    const titleEl = document.createElement("h3");
    titleEl.textContent = movie.Title || "Untitled";

    // Meta (year, rating, genre)
    const metaEl = document.createElement("p");
    metaEl.className = "meta";
    const year = movie.Year || "Unknown year";
    const rated = movie.Rated && movie.Rated !== "N/A" ? movie.Rated : "Unrated";
    const genre = movie.Genre || "Unknown genre";
    metaEl.textContent = `${year} · ${rated} · ${genre}`;

    //IMDb score:
    const imdbRating = movie.imdbRating && movie.imdbRating !== "N/A"
        ? `${movie.imdbRating}/10`
        : "N/A";

    //Rotten Tomatoes score:
    let rotten = "N/A";
    if (movie.Ratings && Array.isArray(movie.Ratings)) {
        const rtEntry = movie.Ratings.find(r => r.Source === "Rotten Tomatoes");
        if (rtEntry) rotten = rtEntry.Value; 
    }
    // Elements for scores
    const ratingsEl = document.createElement("p");
    ratingsEl.className = "meta";
    ratingsEl.textContent = `⭐ IMDb: ${imdbRating}   ·   🍅 Rotten Tomatoes: ${rotten}`;

    // Cast/director
    const castEl = document.createElement("p");
    castEl.className = "meta";
    const director = movie.Director && movie.Director !== "N/A"
        ? `Director: ${movie.Director}`
        : "";
    const actors = movie.Actors && movie.Actors !== "N/A"
        ? `Cast: ${movie.Actors}`
        : "";
    castEl.textContent = [director, actors].filter(Boolean).join(" · ");

    //Synopsis
    const plotEl = document.createElement("p");
    plotEl.textContent =
        movie.Plot && movie.Plot !== "N/A"
        ? movie.Plot
        : "No synopsis available for this title.";

    //update the DOM
    textContentContainer.appendChild(titleEl);
    textContentContainer.appendChild(metaEl);
    textContentContainer.appendChild(ratingsEl);
    textContentContainer.appendChild(castEl);
    textContentContainer.appendChild(plotEl);
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
  





  