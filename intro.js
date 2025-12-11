// Set up video intro for each visit
document.addEventListener("DOMContentLoaded", function () {
    const introOverlay = document.getElementById("tv-intro-overlay");
    const powerPrompt = document.getElementById("power-prompt");
    const video = document.getElementById("static-video");
    const audio = document.getElementById("static-audio");
    const content = document.getElementById("main-content");
  
    if (!introOverlay || !video || !content) return; // exit in case of failure
  
    // End the intro --> show site
    function endIntro() {
      introOverlay.style.display = "none";
      content.style.opacity = "1";
      content.style.pointerEvents = "auto";
  
      // Stop media if still playing
      if (!video.paused) video.pause();
      if (audio && !audio.paused) audio.pause();
    }
  
    // User must click to initialize intro
    function handlePowerOn() {
      // Only allow once
      introOverlay.removeEventListener("click", handlePowerOn);
  
      // Hide prompt, show video
      if (powerPrompt) {
        powerPrompt.style.display = "none";
      }
      video.style.display = "block";
      introOverlay.style.backgroundColor = "#000";
  
      // Make sure video/audio plays together
      video.play().catch(err => {
        console.warn("Video play failed:", err);
        endIntro();
      });
  
      if (audio) {
        audio.play().catch(err => {
          console.warn("Audio play failed (possibly muted by browser):", err);
        });
      }
  
      // When video ends, hide overlay and show content
      video.addEventListener("ended", endIntro);
  
      // Backup exit
      setTimeout(() => {
        if (introOverlay.style.display !== "none") {
          endIntro();
        }
      }, 8000);
    }
  
    // Attach click listener for anywhere on screen
    introOverlay.addEventListener("click", handlePowerOn);
  });